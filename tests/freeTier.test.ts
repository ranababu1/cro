import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db, getDb } from '@/lib/db';
import { computeEntitlements } from '@/lib/entitlements';
import { checkVisitorQuota, clearVisitorCache, recordNewVisitor } from '@/lib/quotas';
import { currentMonth } from '@/lib/pageviewQuota';
import { clearConfigCache } from '@/lib/configCache';
import { POST as createExperiment } from '@/app/api/experiments/route';
import { PATCH as patchExperiment, DELETE as deleteExperiment } from '@/app/api/experiments/[id]/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';

let cleanup: () => void;
type T = { user: { id: string; email: string }; orgId: string; projectId: string; key: string };
const t: Record<string, T> = {};

async function tenant(email: string, plan = 'free'): Promise<T> {
    const u = await db.createUser({ email, name: email });
    const ws = await db.ensureWorkspace(u);
    await db.updateOrganization(ws.orgId, { plan });
    await seedProjectDomain(ws.projectId, 'localhost');
    const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'dev')!;
    return { user: { id: u.id, email }, orgId: ws.orgId, projectId: ws.projectId, key: (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key };
}
const json = (method: string, url: string, body?: unknown) => new NextRequest(`http://localhost${url}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
});
const p = (id: string) => ({ params: Promise.resolve({ id }) });
let n = 0;
async function newTest(who: T) {
    session.current = { user: who.user };
    n++;
    const res = await createExperiment(json('POST', '/api/experiments', flowExperimentBody({
        name: `T${n}`, control_url: `http://localhost/c${n}.html`,
        variations: [
            { name: 'Control', url: `http://localhost/c${n}.html`, weight: 50, is_control: true },
            { name: 'B', url: `http://localhost/b${n}.html`, weight: 50, is_control: false },
        ],
    })));
    return { res, id: res.status === 201 ? (await res.json()).experiment?.id ?? (await db.getExperiments([who.projectId]))[0].id : null };
}
const setStatus = async (who: T, id: string, status: string) => {
    session.current = { user: who.user };
    return patchExperiment(json('PATCH', `/api/experiments/${id}`, { status }), p(id));
};

beforeAll(async () => {
    cleanup = useTempDatabase();
    process.env.PLATFORM_ADMIN_EMAILS = 'root@example.com';
    t.free = await tenant('free@example.com');
    t.paid = await tenant('paid@example.com', 'starter');
    t.admin = await tenant('imrn.dev@gmail.com');
    t.friend = await tenant('friend@example.com');
});
afterAll(() => { delete process.env.PLATFORM_ADMIN_EMAILS; cleanup(); });

describe('free plan defaults', () => {
    it('come from the entitlement helper; paid, admins and special friends differ', () => {
        expect(computeEntitlements({ plan: 'free' }, []).limits).toMatchObject({
            monthlyVisitors: 10_000, dailyVisitors: 300, activeExperiments: 1, lifetimeExperiments: 10, projects: 1, maxVariations: 1, monthlyPageviews: null,
        });
        expect(computeEntitlements({ plan: 'starter' }, []).limits).toMatchObject({
            monthlyVisitors: null, dailyVisitors: null, activeExperiments: null, lifetimeExperiments: null, projects: null, maxVariations: 50,
        });
        const admin = computeEntitlements({ plan: 'free' }, ['imrn.dev@gmail.com']).limits;
        expect(Object.values(admin).every((v) => v === null)).toBe(true);
        expect(computeEntitlements({ plan: 'free', special_friend: true, custom_allowances: JSON.stringify({ daily_visitors: null, lifetime_experiments: 100 }) }, []).limits)
            .toMatchObject({ dailyVisitors: null, lifetimeExperiments: 100, monthlyVisitors: 10_000 });
    });
});

describe('tested visitor caps', () => {
    it('blocks new visitors past 300 a day, but not visitors already counted', async () => {
        clearVisitorCache();
        for (let i = 0; i < 300; i++) await recordNewVisitor(t.free.orgId, `d${i}`);
        clearVisitorCache();
        const q = await checkVisitorQuota(t.free.orgId, 'someone_new');
        expect(q).toMatchObject({ allowed: false, reason: 'daily_visitors', limit: 300 });
        expect((await checkVisitorQuota(t.free.orgId, 'd5')).allowed).toBe(true);
        expect((await checkVisitorQuota(t.paid.orgId, 'x')).allowed).toBe(true);
    });

    it('blocks past 10,000 a month', async () => {
        const d = await getDb();
        await d.run(sql`update usage_monthly set visitors = 10000 where org_id = ${t.free.orgId} and month = ${currentMonth()}`);
        await d.run(sql`delete from usage_daily where org_id = ${t.free.orgId}`);
        clearVisitorCache();
        expect(await checkVisitorQuota(t.free.orgId, 'brand_new')).toMatchObject({ allowed: false, reason: 'monthly_visitors' });
    });

    it('at the cap, bootstrap shows new visitors the control and does not count them; enrolled visitors keep their variant', async () => {
        const d = await getDb();
        await d.run(sql`update usage_monthly set visitors = 0 where org_id = ${t.free.orgId}`);
        await d.run(sql`delete from usage_daily where org_id = ${t.free.orgId}`);
        clearVisitorCache();
        const { id } = await newTest(t.free);
        expect((await setStatus(t.free, id!, 'running')).status).toBe(200);
        const boot = async (user: string) => (await bootstrap(new NextRequest('http://localhost/api/sdk/bootstrap', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': t.free.key, origin: 'http://localhost' },
            body: JSON.stringify({ url: `http://localhost/c${n}.html`, user_id: user }),
        }))).json();
        const enrolled = await boot('early_bird');
        expect(enrolled.variation_id).toBeTruthy();
        await d.run(sql`update usage_daily set visitors = 300 where org_id = ${t.free.orgId}`);
        clearVisitorCache();
        const before = await db.getMonthlyVisitors(t.free.orgId, currentMonth());
        const late = await boot('late_comer');
        expect(late).toMatchObject({ action: 'stay', reason: 'quota_exceeded' });
        expect(late.variation_id).toBeUndefined();
        expect(await db.getMonthlyVisitors(t.free.orgId, currentMonth())).toBe(before);
        expect((await boot('early_bird')).variation_id).toBe(enrolled.variation_id);
        await setStatus(t.free, id!, 'paused');
        await d.run(sql`delete from usage_daily where org_id = ${t.free.orgId}`);
        clearVisitorCache();
    });
});

describe('experiment limits', () => {
    it('allows 1 running test at a time on free, with a clear message', async () => {
        const a = await newTest(t.free);
        const b = await newTest(t.free);
        expect((await setStatus(t.free, a.id!, 'running')).status).toBe(200);
        const res = await setStatus(t.free, b.id!, 'running');
        expect(res.status).toBe(403);
        expect((await res.json()).error).toMatch(/1 running test at a time/);
        expect((await setStatus(t.free, a.id!, 'paused')).status).toBe(200);
        expect((await setStatus(t.free, b.id!, 'running')).status).toBe(200);
        // Resuming also respects the running limit.
        expect((await setStatus(t.free, a.id!, 'running')).status).toBe(403);
        await setStatus(t.free, b.id!, 'completed');
    });

    it('counts 10 started tests over the lifetime; deleting does not reset it', async () => {
        const before = (await db.getOrganization(t.free.orgId))!.experiments_started_total;
        const x = await newTest(t.free);
        await setStatus(t.free, x.id!, 'running');
        await setStatus(t.free, x.id!, 'completed');
        session.current = { user: t.free.user };
        await deleteExperiment(json('DELETE', `/api/experiments/${x.id}`), p(x.id!));
        expect((await db.getOrganization(t.free.orgId))!.experiments_started_total).toBe(before + 1);

        const d = await getDb();
        await d.run(sql`update organizations set experiments_started_total = 9 where id = ${t.free.orgId}`);
        clearConfigCache();
        const last = await newTest(t.free);
        expect(last.res.status).toBe(201);
        expect((await setStatus(t.free, last.id!, 'running')).status).toBe(200);
        await setStatus(t.free, last.id!, 'completed');
        const over = await newTest(t.free);
        expect(over.res.status).toBe(403);
        expect((await over.res.json()).error).toMatch(/all 10 tests/);
    });

    it('does not apply to paid orgs, admins or special friends with an override', async () => {
        for (const who of [t.paid, t.admin]) {
            const a = await newTest(who);
            const b = await newTest(who);
            expect((await setStatus(who, a.id!, 'running')).status).toBe(200);
            expect((await setStatus(who, b.id!, 'running')).status).toBe(200);
        }
        await db.updateOrganization(t.friend.orgId, { special_friend: true, custom_allowances: JSON.stringify({ active_experiments: 3 }) });
        const a = await newTest(t.friend);
        const b = await newTest(t.friend);
        expect((await setStatus(t.friend, a.id!, 'running')).status).toBe(200);
        expect((await setStatus(t.friend, b.id!, 'running')).status).toBe(200);
    });

    it('free is A/B only: a second variation is refused', async () => {
        session.current = { user: t.free.user };
        const d = await getDb();
        await d.run(sql`update organizations set experiments_started_total = 0 where id = ${t.free.orgId}`);
        clearConfigCache();
        const res = await createExperiment(json('POST', '/api/experiments', flowExperimentBody({
            name: 'ABn', control_url: 'http://localhost/abn.html',
            variations: [
                { name: 'Control', url: 'http://localhost/abn.html', weight: 34, is_control: true },
                { name: 'B', url: 'http://localhost/abn-b.html', weight: 33, is_control: false },
                { name: 'C', url: 'http://localhost/abn-c.html', weight: 33, is_control: false },
            ],
        })));
        expect(res.status).toBe(403);
        expect((await res.json()).error).toMatch(/A\/B only/);
    });
});
