import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { computeEntitlements, getOrgEntitlements } from '@/lib/entitlements';
import { parseAllowances } from '@/lib/allowances';
import { getPageviewStatus } from '@/lib/pageviewQuota';
import { checkVisitorQuota } from '@/lib/quotas';
import { PUT as putAllowances } from '@/app/api/admin/orgs/[id]/allowances/route';
import { GET as planApi } from '@/app/api/plan/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';
import { POST as capture } from '@/app/api/capture/route';
import { POST as createExperiment } from '@/app/api/experiments/route';
import { flowExperimentBody } from './helpers';

let cleanup: () => void;
let admin: { id: string; email: string };
let tenant: { id: string; email: string };
let orgId: string;
let sdkKey: string;

const put = (body: unknown) => putAllowances(new NextRequest(`http://localhost/api/admin/orgs/${orgId}/allowances`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}), { params: Promise.resolve({ id: orgId }) });
const sdk = (path: string, body: unknown) => new NextRequest(`http://localhost${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': sdkKey, origin: 'http://localhost' }, body: JSON.stringify(body),
});

beforeAll(async () => {
    cleanup = useTempDatabase();
    process.env.PLATFORM_ADMIN_EMAILS = 'root@example.com';
    const a = await db.createUser({ email: 'root@example.com', name: 'Root' });
    admin = { id: a.id, email: a.email };
    await db.ensureWorkspace(a);
    const t = await db.createUser({ email: 'friend@example.com', name: 'Friend' });
    tenant = { id: t.id, email: t.email };
    const ws = await db.ensureWorkspace(t);
    orgId = ws.orgId;
    await seedProjectDomain(ws.projectId, 'localhost');
    const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'dev')!;
    sdkKey = (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key;
});
afterAll(() => { delete process.env.PLATFORM_ADMIN_EMAILS; cleanup(); });

describe('special friend rule', () => {
    it('ignores allowances unless the org is a special friend', () => {
        const allowances = JSON.stringify({ heatmaps: true, max_variations: 5 });
        expect(computeEntitlements({ plan: 'free', custom_allowances: allowances }, []).features.heatmaps).toBe(false);
        const e = computeEntitlements({ plan: 'free', special_friend: true, custom_allowances: allowances }, []);
        expect(e.features.heatmaps).toBe(true);
        expect(e.features.raw_capture).toBe(true);
        expect(e.features.recordings).toBe(false);
        expect(e.limits.maxVariations).toBe(5);
    });

    it('can turn a paid feature off and set unlimited caps', () => {
        const e = computeEntitlements({ plan: 'starter', special_friend: true, custom_allowances: JSON.stringify({ heatmaps: false, monthly_pageviews: null, flags: { beta_x: true } }) }, []);
        expect(e.features.heatmaps).toBe(false);
        expect(e.limits.monthlyPageviews).toBeNull();
        expect(e.flags).toEqual({ beta_x: true });
    });

    it('treats bad stored JSON as no overrides', () => {
        expect(parseAllowances('{nope')).toEqual({});
        expect(parseAllowances(JSON.stringify({ seats: -5 }))).toEqual({});
    });
});

describe('admin allowances API', () => {
    it('is hidden from tenants', async () => {
        session.current = { user: tenant };
        expect((await put({ special_friend: true, allowances: {} })).status).toBe(404);
        session.current = null;
        expect((await put({ special_friend: true, allowances: {} })).status).toBe(404);
    });

    it('validates input', async () => {
        session.current = { user: admin };
        expect((await put({ special_friend: true, allowances: { seats: 'lots' } })).status).toBe(400);
        expect((await put({ special_friend: true, allowances: { unknown_field: 1 } })).status).toBe(400);
    });

    it('saves, audits, and every path respects the overrides', async () => {
        session.current = { user: admin };
        const res = await put({ special_friend: true, allowances: { heatmaps: true, monthly_pageviews: 3, monthly_visitors: 7, max_variations: 3 } });
        expect(res.status).toBe(200);
        const org = await db.getOrganization(orgId);
        expect(org?.special_friend).toBe(true);
        const log = await db.getAuditLog(orgId);
        expect(log.find((l) => l.action === 'admin:special_friend')?.diff).toContain('"monthly_pageviews":3');

        const ent = await getOrgEntitlements(orgId);
        expect(ent.limits).toMatchObject({ monthlyPageviews: 3, monthlyVisitors: 7, maxVariations: 3 });
        expect((await getPageviewStatus(orgId, { fresh: true })).limit).toBe(3);
        expect((await checkVisitorQuota(orgId)).limit).toBe(7);
        // SDK and ingest
        expect((await (await bootstrap(sdk('/api/sdk/bootstrap', { url: 'http://localhost/x', user_id: 'v1' }))).json()).capture).toMatchObject({ heatmaps: true });
        expect((await capture(sdk('/api/capture', { events: [] }))).status).toBe(202);
        // UI: tenant sees effective values but not the flag
        session.current = { user: tenant };
        const plan = await (await planApi(new NextRequest('http://localhost/api/plan'))).json();
        expect(plan.features.heatmaps).toBe(true);
        expect(plan.max_variations).toBe(3);
        expect(JSON.stringify(plan)).not.toMatch(/special|friend|allowance/i);
        // API: create with 3 variations is allowed for this free org
        const body = flowExperimentBody({ variations: [
            { name: 'Control', url: 'http://localhost/demo/control.html', weight: 25, is_control: true },
            { name: 'A', url: 'http://localhost/a', weight: 25, is_control: false },
            { name: 'B', url: 'http://localhost/b', weight: 25, is_control: false },
            { name: 'C', url: 'http://localhost/d', weight: 25, is_control: false },
        ] });
        const created = await createExperiment(new NextRequest('http://localhost/api/experiments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
        expect(created.status, JSON.stringify(await created.clone().json())).toBe(201);
    });

    it('turning special friend off restores the plan', async () => {
        session.current = { user: admin };
        expect((await put({ special_friend: false, allowances: { heatmaps: true } })).status).toBe(200);
        expect((await getOrgEntitlements(orgId)).features.heatmaps).toBe(false);
        expect((await capture(sdk('/api/capture', { events: [] }))).status).toBe(403);
    });
});
