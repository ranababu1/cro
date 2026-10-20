import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db, getDb } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import { checkNewTest, monthResetAt, formatResetDate, testsCreatedThisMonth, recordNewTest } from '@/lib/freeTests';
import { goalPlanError } from '@/lib/goals';
import { POST as createExperiment } from '@/app/api/experiments/route';
import { PATCH as patchExperiment, DELETE as deleteExperiment } from '@/app/api/experiments/[id]/route';
import { POST as addGoal, DELETE as removeGoal } from '@/app/api/experiments/[id]/goals/route';
import { POST as track } from '@/app/api/track/route';
import { POST as sdkEvent } from '@/app/api/sdk/event/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';

let cleanup: () => void;
type T = { user: { id: string; email: string }; orgId: string; projectId: string; key: string };
const t: Record<string, T> = {};

async function tenant(email: string, plan = 'free', host = 'localhost'): Promise<T> {
    const u = await db.createUser({ email, name: email });
    const ws = await db.ensureWorkspace(u);
    await db.updateOrganization(ws.orgId, { plan });
    await seedProjectDomain(ws.projectId, host);
    const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'dev')!;
    return { user: { id: u.id, email }, orgId: ws.orgId, projectId: ws.projectId, key: (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key };
}
const json = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) => new NextRequest(`http://localhost${url}`, {
    method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
});
const p = (id: string) => ({ params: Promise.resolve({ id }) });
let n = 0;
async function create(who: T, overrides: Record<string, unknown> = {}, host = 'localhost') {
    session.current = { user: who.user };
    n++;
    const proto = host === 'localhost' ? 'http' : 'https';
    const res = await createExperiment(json('POST', '/api/experiments', flowExperimentBody({
        name: `M${n}`, control_url: `${proto}://${host}/m${n}.html`,
        variations: [
            { name: 'Control', url: `${proto}://${host}/m${n}.html`, weight: 50, is_control: true },
            { name: 'B', url: `${proto}://${host}/m${n}b.html`, weight: 50, is_control: false },
        ],
        ...overrides,
    })));
    const body = await res.json();
    return { res, body, id: (body.experiment?.id as string | undefined) ?? null };
}
const resetMonthly = async () => (await getDb()).run(sql`delete from free_test_usage`);

beforeAll(async () => {
    cleanup = useTempDatabase();
    process.env.PLATFORM_ADMIN_EMAILS = 'root@example.com';
    t.free = await tenant('free@example.com');
    t.free2 = await tenant('free2@example.com');
    t.paid = await tenant('paid@example.com', 'starter');
    t.owner = await tenant('imrn.dev@gmail.com');
    t.platform = await tenant('root@example.com');
    t.friend = await tenant('friend@example.com');
});
afterAll(() => { delete process.env.PLATFORM_ADMIN_EMAILS; cleanup(); });

describe('reset date', () => {
    it('is the 1st of next month, UTC, including across a year end', () => {
        expect(monthResetAt(new Date('2026-10-20T10:00:00Z'))).toBe('2026-11-01T00:00:00.000Z');
        expect(monthResetAt(new Date('2026-12-31T23:59:59Z'))).toBe('2027-01-01T00:00:00.000Z');
        expect(formatResetDate('2026-11-01T00:00:00.000Z')).toBe('1 November 2026');
    });
});

describe('free: 1 new test per calendar month', () => {
    it('allows the first test, then refuses the next with an upgrade message and the reset date', async () => {
        await resetMonthly();
        const first = await create(t.free);
        expect(first.res.status).toBe(201);
        expect(await testsCreatedThisMonth('org', t.free.orgId)).toBe(1);
        const second = await create(t.free);
        expect(second.res.status).toBe(403);
        expect(second.body.reason).toBe('monthly_tests');
        expect(second.body.resets_at).toBe(monthResetAt());
        expect(second.body.error).toContain(formatResetDate(monthResetAt()));
        expect(second.body.error).toMatch(/1 new test a month/);
        expect(second.body.error).toMatch(/upgrade to Starter/);
        expect(second.body.error).not.toMatch(/\u2014/);
    });

    it('deleting the test does not give the allowance back', async () => {
        const [e] = await db.getExperiments([t.free.projectId]);
        session.current = { user: t.free.user };
        expect((await deleteExperiment(json('DELETE', `/api/experiments/${e.id}`), p(e.id))).status).toBe(200);
        const again = await create(t.free);
        expect(again.res.status).toBe(403);
        expect(await testsCreatedThisMonth('org', t.free.orgId)).toBe(1);
    });

    it('counts per account: another free account still has its own test this month', async () => {
        expect((await create(t.free2)).res.status).toBe(201);
    });

    it('comes back next month', async () => {
        const next = new Date(monthResetAt());
        expect((await checkNewTest(t.free.orgId, 'http://localhost/x.html')).ok).toBe(false);
        expect((await checkNewTest(t.free.orgId, 'http://localhost/x.html', next)).ok).toBe(true);
    });

    it('counts per domain across free accounts', async () => {
        const a = await tenant('dom-a@example.com', 'free', 'shared.io');
        const b = await tenant('dom-b@example.com', 'free', 'www.shared.io');
        expect((await create(a, {}, 'shared.io')).res.status).toBe(201);
        expect(await testsCreatedThisMonth('domain', 'shared.io')).toBe(1);
        const refused = await create(b, {}, 'www.shared.io');
        expect(refused.res.status).toBe(403);
        expect(refused.body.reason).toBe('domain_monthly_tests');
        expect(refused.body.error).toMatch(/^shared\.io has already had its 1 new test a month/);
    });
});

describe('free: exactly 1 goal, a click on a CSS selector', () => {
    it('goalPlanError: free allows one click goal only; paid allows any', () => {
        const free = { maxGoals: 1, advancedGoals: false };
        expect(goalPlanError(free, [{ type: 'click' }])).toBeNull();
        expect(goalPlanError(free, [{}])).toBeNull();
        expect(goalPlanError(free, [{ type: 'click' }, { type: 'click' }])).toMatch(/1 goal per test/);
        for (const type of ['form', 'page', 'event']) expect(goalPlanError(free, [{ type }])).toMatch(/click on a CSS selector/);
        expect(goalPlanError(free, [{ type: 'click' }], 1)).toMatch(/1 goal per test/);
        expect(goalPlanError({ maxGoals: null, advancedGoals: true }, [{ type: 'event' }, { type: 'page' }, { type: 'form' }], 3)).toBeNull();
    });

    it('create refuses a second goal or a non-click goal on free', async () => {
        await resetMonthly();
        const two = await create(t.free, { goals: [{ name: 'A', selector: '#a', is_primary: true }, { name: 'B', selector: '#b', is_primary: false }] });
        expect(two.res.status).toBe(403);
        expect(two.body.reason).toBe('goals');
        const form = await create(t.free, { goals: [{ name: 'Signup', type: 'form', selector: 'form#s', is_primary: true }] });
        expect(form.res.status).toBe(403);
        const event = await create(t.free, { goals: [{ name: 'Buy', type: 'event', selector: 'purchase', is_primary: true }] });
        expect(event.res.status).toBe(403);
        // Refused creates do not use the monthly allowance.
        expect(await testsCreatedThisMonth('org', t.free.orgId)).toBe(0);
    });

    it('the goals route refuses a second goal; a draft can swap its one goal for another click goal only', async () => {
        await resetMonthly();
        const { id } = await create(t.free);
        session.current = { user: t.free.user };
        const add = (g: Record<string, unknown>) => addGoal(json('POST', `/api/experiments/${id}/goals`, g), p(id!));
        expect((await add({ name: 'Second', selector: '#second', is_primary: false })).status).toBe(403);
        const [goal] = await db.getGoals(id!);
        expect((await removeGoal(json('DELETE', `/api/experiments/${id}/goals?goal=${goal.id}`), p(id!))).status).toBe(200);
        expect((await patchExperiment(json('PATCH', `/api/experiments/${id}`, { status: 'running' }), p(id!))).status).toBe(403);
        expect((await add({ name: 'Thanks', type: 'page', selector: 'http://localhost/thanks', match_type: 'equals', is_primary: true })).status).toBe(403);
        const ok = await add({ name: 'Buy click', selector: '#buy', is_primary: false });
        expect(ok.status).toBe(201);
        const goals = await db.getGoals(id!);
        expect(goals).toHaveLength(1);
        expect(goals[0]).toMatchObject({ type: 'click', is_primary: true });
    });

    it('paid plans add other goal types and several goals', async () => {
        const res = await create(t.paid, { goals: [
            { name: 'Click', selector: '#a', is_primary: true },
            { name: 'Form', type: 'form', selector: 'form#s', is_primary: false },
            { name: 'Event', type: 'event', selector: 'signup', is_primary: false },
        ] });
        expect(res.res.status).toBe(201);
    });
});

describe('free: no custom conversions, click goal still counts', () => {
    it('refuses custom events and conversions without the click goal, and records the click goal', async () => {
        await resetMonthly();
        clearConfigCache();
        const { id } = await create(t.free);
        session.current = { user: t.free.user };
        // free has one running test slot; pause anything else first.
        for (const e of await db.getExperiments([t.free.projectId])) if (e.status === 'running') await patchExperiment(json('PATCH', `/api/experiments/${e.id}`, { status: 'paused' }), p(e.id));
        expect((await patchExperiment(json('PATCH', `/api/experiments/${id}`, { status: 'running' }), p(id!))).status).toBe(200);
        const exp = (await db.getExperiment(id!))!;
        const boot = await (await bootstrap(json('POST', '/api/sdk/bootstrap', { url: exp.control_url, user_id: 'vis1' }, { 'X-API-Key': t.free.key, origin: 'http://localhost' }))).json();
        expect(boot.variation_id).toBeTruthy();
        const [goal] = await db.getGoals(id!);
        const send = (body: Record<string, unknown>) => track(json('POST', '/api/track', { experiment_id: id, variation_id: boot.variation_id, user_id: 'vis1', ...body }, { 'X-API-Key': t.free.key, origin: 'http://localhost' }));

        const custom = await send({ event_type: 'conversion', event_name: 'purchase' });
        expect(custom.status).toBe(403);
        expect((await custom.json()).reason).toBe('custom_conversion');
        const event = await sdkEvent(json('POST', '/api/sdk/event', { user_id: 'vis1', event_name: 'purchase', revenue: 10 }, { 'X-API-Key': t.free.key, origin: 'http://localhost' }));
        expect(event.status).toBe(403);
        expect((await send({ event_type: 'conversion', goal_id: goal.id })).status).toBe(201);
        // A batch: the click goal is kept, a custom conversion in the same batch is refused.
        const batch = await (await track(json('POST', '/api/track', { events: [
            { experiment_id: id, variation_id: boot.variation_id, user_id: 'vis2', event_type: 'conversion', event_name: 'x' },
            { experiment_id: id, variation_id: boot.variation_id, user_id: 'vis2', event_type: 'page_view' },
        ] }, { 'X-API-Key': t.free.key, origin: 'http://localhost' }))).json();
        expect(batch.results.map((r: { status: number }) => r.status)).toEqual([403, 201]);
        const conversions = (await (await getDb()).all<{ c: number }>(sql`select count(*) as c from events where experiment_id = ${id} and event_type = 'conversion'`))[0].c;
        expect(Number(conversions)).toBe(1);
        await patchExperiment(json('PATCH', `/api/experiments/${id}`, { status: 'paused' }), p(id!));
    });

    it('paid plans accept custom events', async () => {
        const res = await sdkEvent(json('POST', '/api/sdk/event', { user_id: 'v', event_name: 'signup' }, { 'X-API-Key': t.paid.key, origin: 'http://localhost' }));
        expect(res.status).toBe(200);
    });
});

describe('admins, platform admins and special friends bypass the limits', () => {
    const rich = { goals: [
        { name: 'Click', selector: '#a', is_primary: true },
        { name: 'Thanks', type: 'page', selector: 'http://localhost/thanks', match_type: 'equals', is_primary: false },
    ] };
    it('the owner account and platform admins create several tests with any goals and no counting', async () => {
        for (const who of [t.owner, t.platform]) {
            for (let i = 0; i < 3; i++) expect((await create(who, rich)).res.status).toBe(201);
            expect(await testsCreatedThisMonth('org', who.orgId)).toBe(0);
            const ev = await sdkEvent(json('POST', '/api/sdk/event', { user_id: 'v', event_name: 'signup' }, { 'X-API-Key': who.key, origin: 'http://localhost' }));
            expect(ev.status).toBe(200);
        }
    });

    it('special friend overrides set the new limits', async () => {
        await db.updateOrganization(t.friend.orgId, { special_friend: true, custom_allowances: JSON.stringify({ monthly_tests: 2, max_goals: 5, advanced_goals: true }) });
        clearConfigCache();
        expect((await create(t.friend, rich)).res.status).toBe(201);
        expect((await create(t.friend, rich)).res.status).toBe(201);
        const third = await create(t.friend, rich);
        expect(third.res.status).toBe(403);
        expect(third.body.error).toMatch(/2 new tests a month/);
        await db.updateOrganization(t.friend.orgId, { custom_allowances: JSON.stringify({ monthly_tests: null, max_goals: null, advanced_goals: true }) });
        clearConfigCache();
        expect((await create(t.friend, rich)).res.status).toBe(201);
    });

    it('recordNewTest keeps counting up (never decreases)', async () => {
        const before = await testsCreatedThisMonth('org', 'org_x');
        await recordNewTest('org_x', null);
        await recordNewTest('org_x', null);
        expect(await testsCreatedThisMonth('org', 'org_x')).toBe(before + 2);
    });
});
