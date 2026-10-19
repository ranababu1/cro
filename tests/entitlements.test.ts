import fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain } from './helpers';

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => null) }));

import { db } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import { computeEntitlements, getOrgEntitlements, GROWTH_FEATURES, HEAVY_FEATURES, isSuperAdminEmail } from '@/lib/entitlements';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';
import { POST as capture } from '@/app/api/capture/route';

let cleanup: () => void;
const orgs: Record<string, { orgId: string; key: string }> = {};

async function tenant(email: string, plan: string) {
    const u = await db.createUser({ email, name: email });
    const ws = await db.ensureWorkspace(u);
    await db.updateOrganization(ws.orgId, { plan });
    await seedProjectDomain(ws.projectId, 'localhost');
    const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'dev')!;
    return { orgId: ws.orgId, key: (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key };
}

const post = (path: string, key: string, body: unknown) => new NextRequest(`http://localhost${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': key, origin: 'http://localhost' }, body: JSON.stringify(body),
});

beforeAll(async () => {
    cleanup = useTempDatabase();
    process.env.PLATFORM_ADMIN_EMAILS = 'ops@example.com';
    orgs.free = await tenant('free@example.com', 'free');
    orgs.paid = await tenant('paid@example.com', 'starter');
    orgs.owner = await tenant('imrn.dev@gmail.com', 'free');
    orgs.ops = await tenant('ops@example.com', 'free');
});
afterAll(() => { delete process.env.PLATFORM_ADMIN_EMAILS; cleanup(); });

describe('entitlement rule', () => {
    it('gives heavy features to paid plans only', () => {
        expect(computeEntitlements({ plan: 'free' }, ['a@x.com']).features).toEqual({ heatmaps: false, recordings: false, raw_capture: false, wordpress_plugin: false, funnels: false, revenue_goals: false, auto_shift: false, traffic: false, visual_editor: false, error_tracking: false });
        expect(computeEntitlements({ plan: null }, []).features.heatmaps).toBe(false);
        for (const plan of ['starter', 'growth', 'enterprise', 'team']) {
            const e = computeEntitlements({ plan }, []);
            expect(HEAVY_FEATURES.filter((f) => !GROWTH_FEATURES.includes(f)).every((f) => e.features[f])).toBe(true);
            expect(e.features.auto_shift).toBe(plan === 'growth' || plan === 'enterprise');
            expect(e.unlimited).toBe(false);
        }
    });

    it('gives admins, and imrn.dev@gmail.com in particular, every feature with no caps', () => {
        expect(isSuperAdminEmail('IMRN.DEV@gmail.com')).toBe(true);
        const e = computeEntitlements({ plan: 'free' }, ['imrn.dev@gmail.com']);
        expect(e.unlimited).toBe(true);
        expect(HEAVY_FEATURES.every((f) => e.features[f])).toBe(true);
    });

    it('reads orgs from the database and refreshes after a plan change', async () => {
        expect((await getOrgEntitlements(orgs.free.orgId)).features.heatmaps).toBe(false);
        expect((await getOrgEntitlements(orgs.paid.orgId)).features.recordings).toBe(true);
        expect((await getOrgEntitlements(orgs.owner.orgId)).unlimited).toBe(true);
        expect((await getOrgEntitlements(orgs.ops.orgId)).unlimited).toBe(true);
        await db.updateOrganization(orgs.free.orgId, { plan: 'starter' });
        expect((await getOrgEntitlements(orgs.free.orgId)).features.heatmaps).toBe(true);
        await db.updateOrganization(orgs.free.orgId, { plan: 'free' });
        expect((await getOrgEntitlements(orgs.free.orgId)).features.heatmaps).toBe(false);
    });
});

describe('server enforcement', () => {
    it('bootstrap sends a capture config only to entitled orgs', async () => {
        clearConfigCache();
        const body = { url: 'http://localhost/page', user_id: 'v1' };
        expect((await (await bootstrap(post('/api/sdk/bootstrap', orgs.free.key, body))).json()).capture).toBeUndefined();
        // Paid orgs get a capture config on matched experiment pages (see tests/heatmaps.test.ts).
    });

    it('capture ingest rejects free orgs', async () => {
        const res = await capture(post('/api/capture', orgs.free.key, { events: [] }));
        expect(res.status).toBe(403);
        expect((await capture(post('/api/capture', orgs.paid.key, { events: [] }))).status).toBe(400);
    });
});

describe('pricing page', () => {
    it('lists heatmaps and recordings as paid only with coming soon tags', () => {
        const src = fs.readFileSync('app/pricing/page.tsx', 'utf8');
        expect(src).toMatch(/'Heatmaps on paid plans/);
        expect(src).toMatch(/name: 'Session recordings', p: 4, tier: 1/);
        expect(src).toContain('paid plans only (Starter and up)');
        expect(src).not.toContain('—');
    });
});
