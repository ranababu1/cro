import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { useTempDatabase, flowExperimentBody, resetFreeTestUsage } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { getDb } from '@/lib/db/client';
import { clearConfigCache } from '@/lib/configCache';
import { getLedgerEntry } from '@/lib/domainLedger';
import { testsCreatedThisMonth } from '@/lib/freeTests';
import { checkStart } from '@/lib/experimentStatus';
import { clearSeenThrottle, recordSdkSeen, siteCheck, SITE_SEEN_WINDOW_DAYS } from '@/lib/siteVerification';
import { POST as addDomain } from '@/app/api/domains/route';
import { POST as createExperiment } from '@/app/api/experiments/route';
import { PATCH as patchExperiment } from '@/app/api/experiments/[id]/route';
import { GET as siteCheckRoute } from '@/app/api/experiments/[id]/site-check/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';

let cleanup: () => void;
type T = { user: { id: string; email: string }; orgId: string; projectId: string; devKey: string; prodKey: string };
const t: Record<string, T> = {};

async function tenant(email: string, plan = 'free'): Promise<T> {
    const u = await db.createUser({ email, name: email });
    const ws = await db.ensureWorkspace(u);
    await db.updateOrganization(ws.orgId, { plan });
    const envs = await db.getEnvironments(ws.projectId);
    const key = async (k: string) => (await db.createApiKey({ environmentId: envs.find((e) => e.key === k)!.id, type: 'sdk' })).key;
    return { user: { id: u.id, email }, orgId: ws.orgId, projectId: ws.projectId, devKey: await key('dev'), prodKey: await key('prod') };
}
const json = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) => new NextRequest(`http://localhost${url}`, {
    method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
});
const p = (id: string) => ({ params: Promise.resolve({ id }) });
const as = (who: T) => { session.current = { user: who.user }; };
const body = (host: string) => flowExperimentBody({
    control_url: `https://${host}/pricing`,
    variations: [
        { name: 'Control', url: `https://${host}/pricing`, weight: 50, is_control: true },
        { name: 'Variation 1', url: `https://${host}/pricing-b`, weight: 50, is_control: false },
    ],
});
async function draft(who: T, host: string): Promise<string> {
    as(who);
    await resetFreeTestUsage();
    const res = await createExperiment(json('POST', '/api/experiments', body(host)));
    expect(res.status, JSON.stringify(await res.clone().json())).toBe(201);
    return (await res.json()).experiment.id;
}
const start = (who: T, id: string) => { as(who); return patchExperiment(json('PATCH', `/api/experiments/${id}`, { status: 'running' }), p(id)); };
const boot = (key: string, origin: string, url = `${origin}/pricing`) => bootstrap(json('POST', '/api/sdk/bootstrap', { url, user_id: 'v1' }, { 'X-API-Key': key, origin }));
const seenAt = async (projectId: string, host: string) => (await db.listDomains(projectId)).find((d) => d.host === host)?.last_seen_at ?? null;

beforeAll(async () => {
    cleanup = useTempDatabase();
    process.env.PLATFORM_ADMIN_EMAILS = 'root@example.com';
    t.free = await tenant('free@example.com');
    t.other = await tenant('other@example.com');
    t.paid = await tenant('paid@example.com', 'starter');
    t.friend = await tenant('friend@example.com');
    await db.updateOrganization(t.friend.orgId, { special_friend: true });
    t.admin = await tenant('root@example.com');
    for (const [who, host] of [[t.free, 'shop.example.com'], [t.paid, 'paid-site.com'], [t.friend, 'friend-site.com'], [t.admin, 'admin-site.com'], [t.other, 'localhost']] as const) {
        as(who);
        expect((await addDomain(json('POST', '/api/domains', { host }))).status).toBe(201);
    }
    clearConfigCache();
});
afterAll(() => { delete process.env.PLATFORM_ADMIN_EMAILS; cleanup(); });
beforeEach(() => clearSeenThrottle());

describe('free tests need the script seen live on the domain', () => {
    let id: string;

    it('refuses to start before the SDK has been seen, with the install-snippet message', async () => {
        id = await draft(t.free, 'shop.example.com');
        const res = await start(t.free, id);
        expect(res.status).toBe(403);
        const b = await res.json();
        expect(b.reason).toBe('site_not_verified');
        expect(b.error).toMatch(/^Install the snippet to verify your site\. .*example\.com/);
        as(t.free);
        expect(await (await siteCheckRoute(json('GET', `/api/experiments/${id}/site-check`), p(id))).json()).toEqual({ site: { required: true, verified: false, domain: 'example.com', lastSeenAt: null } });
    });

    it('a request from another origin or with no origin does not verify the site', async () => {
        await boot(t.free.prodKey, 'https://evil.example.net');
        await bootstrap(json('POST', '/api/sdk/bootstrap', { url: 'https://shop.example.com/pricing', user_id: 'v1' }, { 'X-API-Key': t.free.prodKey }));
        expect(await seenAt(t.free.projectId, 'shop.example.com')).toBeNull();
        expect((await start(t.free, id)).status).toBe(403);
    });

    it('a dev key on localhost does not verify the live site', async () => {
        await boot(t.free.devKey, 'http://localhost:3000');
        expect(await seenAt(t.free.projectId, 'shop.example.com')).toBeNull();
    });

    it('starts once the SDK called in from the registered domain (Re-check shows it verified)', async () => {
        const r = await boot(t.free.prodKey, 'https://shop.example.com');
        expect(r.status).toBe(200);
        await new Promise((res) => setTimeout(res, 20)); // the seen write happens in the background
        expect(await seenAt(t.free.projectId, 'shop.example.com')).not.toBeNull();
        as(t.free);
        const check = (await (await siteCheckRoute(json('GET', `/api/experiments/${id}/site-check`), p(id))).json()).site;
        expect(check).toMatchObject({ required: true, verified: true, domain: 'example.com' });
        expect((await start(t.free, id)).status).toBe(200);
        // Verifying and starting does not count a second free test for the domain.
        expect(await testsCreatedThisMonth('domain', 'example.com')).toBe(1);
    });

    it('the seen time must be recent', async () => {
        const e = (await db.getExperiment(id))!;
        const d = await getDb();
        const old = new Date(Date.now() - (SITE_SEEN_WINDOW_DAYS + 1) * 86_400_000).toISOString();
        await d.run(sql`update project_domains set last_seen_at = ${old} where host = 'shop.example.com'`);
        expect((await siteCheck(e)).verified).toBe(false);
        expect(await checkStart(e, null)).toMatchObject({ ok: false, reason: 'site_not_verified' }); // scheduled starts use the same check
        const fresh = new Date(Date.now() - (SITE_SEEN_WINDOW_DAYS - 1) * 86_400_000).toISOString();
        await d.run(sql`update project_domains set last_seen_at = ${fresh} where host = 'shop.example.com'`);
        expect((await siteCheck(e)).verified).toBe(true);
    });

    it('writes the seen time at most every 5 minutes per host', async () => {
        const t0 = new Date('2030-01-01T00:00:00Z');
        await recordSdkSeen(t.free.projectId, 'shop.example.com', t0);
        expect(await seenAt(t.free.projectId, 'shop.example.com')).toBe(t0.toISOString());
        clearSeenThrottle();
        await recordSdkSeen(t.free.projectId, 'shop.example.com', new Date(t0.getTime() + 60_000));
        expect(await seenAt(t.free.projectId, 'shop.example.com')).toBe(t0.toISOString());
        await recordSdkSeen(t.free.projectId, 'shop.example.com', new Date(t0.getTime() + 6 * 60_000));
        expect(await seenAt(t.free.projectId, 'shop.example.com')).toBe(new Date(t0.getTime() + 6 * 60_000).toISOString());
    });
});

describe('who skips the check', () => {
    it('paid plans, special friends and platform admins start without verification', async () => {
        for (const [who, host] of [[t.paid, 'paid-site.com'], [t.friend, 'friend-site.com'], [t.admin, 'admin-site.com']] as const) {
            const id = await draft(who, host);
            const res = await start(who, id);
            expect(res.status, `${who.user.email}: ${JSON.stringify(await res.clone().json())}`).toBe(200);
        }
    });

    it('a test page on localhost is not checked', async () => {
        as(t.other);
        await resetFreeTestUsage();
        const res = await createExperiment(json('POST', '/api/experiments', flowExperimentBody()));
        const id = (await res.json()).experiment.id;
        expect((await siteCheck((await db.getExperiment(id))!)).required).toBe(false);
        expect((await start(t.other, id)).status).toBe(200);
    });
});

describe('the domain ledger still holds', () => {
    it('another free account still cannot add the verified domain, and the claim is unchanged', async () => {
        expect((await getLedgerEntry('example.com'))?.org_id).toBe(t.free.orgId);
        as(t.other);
        const res = await addDomain(json('POST', '/api/domains', { host: 'www.example.com' }));
        expect(res.status).toBe(403);
        expect((await res.json()).reason).toMatch(/domain_taken|domain_exhausted/);
    });

    it('the other free account cannot verify the domain through its own key', async () => {
        await boot(t.other.prodKey, 'https://shop.example.com');
        expect((await db.listDomains(t.other.projectId)).every((d) => !d.last_seen_at)).toBe(true);
    });
});

describe('docs describe the site check', () => {
    it('quick start and experiments docs match the window and the button label', async () => {
        const fs = await import('node:fs');
        const qs = fs.readFileSync('lib/docs/content/quickStart.ts', 'utf8');
        const ex = fs.readFileSync('lib/docs/content/experiments.ts', 'utf8');
        for (const doc of [qs, ex]) expect(doc).toContain(`in the last ${SITE_SEEN_WINDOW_DAYS} days`);
        expect(qs).toContain('Install the snippet to verify your site');
        expect(fs.readFileSync('app/(app)/experiments/[id]/SiteVerifyCard.tsx', 'utf8')).toMatch(/Install the snippet to verify your site[\s\S]*Re-check/);
    });
});
