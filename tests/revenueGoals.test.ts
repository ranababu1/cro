import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';
import { computeRevenue, perVisitorMoments, welchPValue, MAX_REVENUE_EVENTS_PER_VISITOR } from '@/lib/revenue';
import { customEventSchema } from '@/lib/validation';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import { POST as create } from '@/app/api/experiments/route';
import { PATCH as patch } from '@/app/api/experiments/[id]/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';
import { POST as customEvent } from '@/app/api/sdk/event/route';
import { GET as revenueRoute } from '@/app/api/experiments/[id]/revenue/route';

const json = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
    new NextRequest(`http://localhost${url}`, {
        method,
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
const p = (id: string) => ({ params: Promise.resolve({ id }) });

describe('revenue statistics', () => {
    it('computes per-visitor mean and variance with non-buyers as zero', () => {
        // 4 visitors: 10, 0, 0, 30 -> mean 10, variance ((0)+(100)+(100)+(400))/3 = 200
        const m = perVisitorMoments(4, 40, 100 + 900);
        expect(m.mean).toBe(10);
        expect(m.variance).toBeCloseTo(200);
    });
    it('Welch test separates clear differences and not noise', () => {
        expect(welchPValue({ mean: 10, variance: 4, n: 1000 }, { mean: 10, variance: 4, n: 1000 })).toBeCloseTo(1);
        expect(welchPValue({ mean: 12, variance: 4, n: 1000 }, { mean: 10, variance: 4, n: 1000 })).toBeLessThan(0.001);
        expect(welchPValue({ mean: 10.1, variance: 400, n: 100 }, { mean: 10, variance: 400, n: 100 })).toBeGreaterThan(0.5);
        expect(welchPValue({ mean: 5, variance: 1, n: 1 }, { mean: 1, variance: 1, n: 50 })).toBe(1);
    });
    it('reports revenue per visitor, average order and lift, with a verdict only after 30 visitors each', () => {
        const vars = [{ id: 'c', name: 'Control', is_control: true }, { id: 'b', name: 'B', is_control: false }];
        const rows = [
            { variation_id: 'c', buyers: 10, orders: 12, revenue: 600, sumsq: 10 * 3600 },
            { variation_id: 'b', buyers: 20, orders: 20, revenue: 1200, sumsq: 20 * 3600 },
        ];
        const r = computeRevenue(vars, new Map([['c', 100], ['b', 100]]), rows);
        const [c, b] = r.variations;
        expect(c.per_visitor).toBe(6);
        expect(c.average_order).toBe(50);
        expect(b.per_visitor).toBe(12);
        expect(b.lift).toBeCloseTo(1);
        expect(c.lift).toBeNull();
        expect(r.verdict?.variation_id).toBe('b');
        expect(r.verdict?.significant).toBe(true);
        expect(computeRevenue(vars, new Map([['c', 20], ['b', 20]]), rows).verdict).toBeNull();
        const empty = computeRevenue(vars, new Map([['c', 50], ['b', 50]]), []);
        expect(empty.variations.every((v) => v.revenue === 0 && v.average_order === 0)).toBe(true);
    });
    it('validates revenue amounts', () => {
        expect(customEventSchema.parse({ user_id: 'v1', event_name: 'purchase', revenue: 19.999 }).revenue).toBe(20);
        expect(customEventSchema.parse({ user_id: 'v1', event_name: 'purchase' }).revenue).toBeUndefined();
        expect(customEventSchema.safeParse({ user_id: 'v1', event_name: 'purchase', revenue: -1 }).success).toBe(false);
        expect(customEventSchema.safeParse({ user_id: 'v1', event_name: 'purchase', revenue: 2_000_000 }).success).toBe(false);
        expect(customEventSchema.safeParse({ user_id: 'v1', event_name: 'purchase', revenue: '10' }).success).toBe(false);
    });
});

describe('revenue goals end to end', () => {
    let cleanup: () => void;
    const t: Record<string, { expId: string; userId: string; sdkKey: string; goalId: string }> = {};

    async function tenant(name: string, plan: string) {
        const u = await db.createUser({ email: `${name}@example.com`, name });
        const ws = await db.ensureWorkspace(u);
        await db.updateOrganization(ws.orgId, { plan });
        await seedProjectDomain(ws.projectId, 'localhost');
        const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'dev')!;
        const sdkKey = (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key;
        session.current = { user: { id: u.id } };
        const data = await (await create(json('POST', '/api/experiments', flowExperimentBody({
            goals: [
                { name: 'CTA', type: 'click', selector: '#cta', is_primary: true },
                { name: 'Purchase', type: 'event', selector: 'purchase', is_primary: false },
            ],
        })))).json();
        const expId = data.experiment.id;
        await patch(json('PATCH', `/api/experiments/${expId}`, { status: 'running' }), p(expId));
        const goalId = data.goals.find((g: { type: string }) => g.type === 'event').id;
        return { expId, userId: u.id, sdkKey, goalId };
    }
    const boot = (key: string, user: string) => bootstrap(json('POST', '/api/sdk/bootstrap', { url: 'http://localhost/demo/control.html', user_id: user }, { 'X-API-Key': key }));
    const track = (key: string, body: unknown) => customEvent(json('POST', '/api/sdk/event', body, { 'X-API-Key': key }));

    beforeAll(async () => {
        cleanup = useTempDatabase();
        t.free = await tenant('rfree', 'free');
        t.paid = await tenant('rpaid', 'starter');
        clearConfigCache();
    });
    afterAll(() => cleanup());

    it('free plans count the conversion but drop the amount, and cannot read revenue', async () => {
        await boot(t.free.sdkKey, 'f1');
        const res = await track(t.free.sdkKey, { user_id: 'f1', event_name: 'purchase', revenue: 50 });
        expect((await res.json()).recorded).toBe(1);
        expect((await track(t.free.sdkKey, { user_id: 'f1', event_name: 'purchase', revenue: 50 })).status).toBe(200);
        expect(await db.getRevenueStats(t.free.expId, undefined, [t.free.goalId])).toEqual([]);
        expect(await db.countRevenueEvents(t.free.expId, 'f1', t.free.goalId)).toBe(0);
        session.current = { user: { id: t.free.userId } };
        const r = await revenueRoute(json('GET', `/api/experiments/${t.free.expId}/revenue`), p(t.free.expId));
        expect(r.status).toBe(403);
        expect((await r.json()).upgrade).toMatch(/paid plans/);
    });

    it('paid plans record every order and report revenue per variation', async () => {
        for (const u of ['p1', 'p2', 'p3']) await boot(t.paid.sdkKey, u);
        expect((await (await track(t.paid.sdkKey, { user_id: 'p1', event_name: 'purchase', revenue: 40 })).json()).recorded).toBe(1);
        expect((await (await track(t.paid.sdkKey, { user_id: 'p1', event_name: 'purchase', revenue: 10.5 })).json()).recorded).toBe(1);
        // Without an amount, a repeat is still ignored.
        expect((await (await track(t.paid.sdkKey, { user_id: 'p1', event_name: 'purchase' })).json()).recorded).toBe(0);
        await track(t.paid.sdkKey, { user_id: 'p2', event_name: 'purchase', revenue: 25 });
        // Visitors not in the test are ignored.
        expect((await (await track(t.paid.sdkKey, { user_id: 'stranger', event_name: 'purchase', revenue: 999 })).json()).recorded).toBe(0);

        session.current = { user: { id: t.paid.userId } };
        const res = await revenueRoute(json('GET', `/api/experiments/${t.paid.expId}/revenue`), p(t.paid.expId));
        expect(res.status).toBe(200);
        const { goals } = await res.json();
        expect(goals).toHaveLength(1);
        const g = goals[0];
        expect(g.goal_name).toBe('Purchase');
        expect(g.has_revenue).toBe(true);
        const total = g.variations.reduce((a: number, v: { revenue: number }) => a + v.revenue, 0);
        const orders = g.variations.reduce((a: number, v: { orders: number }) => a + v.orders, 0);
        const buyers = g.variations.reduce((a: number, v: { buyers: number }) => a + v.buyers, 0);
        expect(total).toBeCloseTo(75.5);
        expect(orders).toBe(3);
        expect(buyers).toBe(2);
        expect(g.verdict).toBeNull();
        // The visitor still counts once as a conversion.
        const counts = await db.getLiveCounts(t.paid.expId);
        expect(counts.goals.filter((x) => x.goal_id === t.paid.goalId).reduce((a, x) => a + x.users, 0)).toBe(2);
    });

    it('caps revenue events per visitor and goal', async () => {
        const a = await db.getAssignment(t.paid.expId, 'p3');
        expect(a).toBeTruthy();
        for (let i = 0; i < MAX_REVENUE_EVENTS_PER_VISITOR; i++) {
            await db.createEvent({ experiment_id: t.paid.expId, variation_id: a!.variation_id, environment_id: null, user_id: 'p3', event_type: 'conversion', event_name: 'Purchase', goal_id: t.paid.goalId, metadata: null, revenue: 1 });
        }
        expect((await (await track(t.paid.sdkKey, { user_id: 'p3', event_name: 'purchase', revenue: 5 })).json()).recorded).toBe(0);
    });

    it('needs a signed in user who can see the test', async () => {
        session.current = null;
        expect((await revenueRoute(json('GET', `/api/experiments/${t.paid.expId}/revenue`), p(t.paid.expId))).status).toBe(401);
        session.current = { user: { id: t.free.userId } };
        expect((await revenueRoute(json('GET', `/api/experiments/${t.paid.expId}/revenue`), p(t.paid.expId))).status).toBe(404);
    });
});

describe('revenue goals wiring', () => {
    const root = path.join(__dirname, '..');
    const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
    it('SDK sends the amount with ABTest.track', () => {
        const code = read('sdk-src/sdk.js');
        expect(code).toMatch(/function trackEvent\(name, options\)/);
        expect(code).toMatch(/body\.revenue = revenue/);
    });
    it('pricing lists revenue goals as available on paid plans', () => {
        const pricing = read('app/pricing/page.tsx');
        expect(pricing).toMatch(/\['Revenue goals', 'Not included', 'Included'/);
        expect(pricing).not.toMatch(/\{ name: 'Revenue goals'/);
    });
    it('migration adds the revenue column with a newer timestamp', () => {
        const j = JSON.parse(read('drizzle/meta/_journal.json')) as { entries: { tag: string; when: number }[] };
        const i = j.entries.findIndex((e) => e.tag === '0019_event_revenue');
        expect(i).toBeGreaterThan(0);
        for (const e of j.entries.slice(0, i)) expect(j.entries[i].when).toBeGreaterThan(e.when);
        expect(read('drizzle/0019_event_revenue.sql')).toMatch(/ADD `revenue` real/);
    });
});
