import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody, makePaid } from './helpers';
import { checkGoalSelector, MAX_GOALS } from '@/lib/goals';
import { createExperimentSchema } from '@/lib/validation';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { POST as create } from '@/app/api/experiments/route';
import { POST as addGoal, PATCH as patchGoals, DELETE as removeGoal } from '@/app/api/experiments/[id]/goals/route';
import { buildExperimentResults } from '@/lib/results';

const req = (method: string, url: string, body?: unknown) =>
    new NextRequest(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' }, body: body === undefined ? undefined : JSON.stringify(body) });
const p = (id: string) => ({ params: Promise.resolve({ id }) });

describe('checkGoalSelector', () => {
    it('accepts one selector', () => {
        for (const s of ['#headerCTA', '.btn.primary', 'form#signup button[type="submit"]', 'nav > a:nth-child(2)', 'a[href*="pricing"]']) expect(checkGoalSelector(s)).toBeNull();
    });
    it('refuses lists, HTML and invalid selectors', () => {
        expect(checkGoalSelector('#a, .b')).toMatch(/one CSS selector per goal/);
        expect(checkGoalSelector('<div>')).toMatch(/not HTML/);
        expect(checkGoalSelector('#a[')).toMatch(/not a valid/);
        expect(checkGoalSelector('')).toBeTruthy();
    });
});

describe('create schema goals', () => {
    const goal = (i: number) => ({ name: `Goal ${i}`, selector: `#g${i}`, is_primary: i === 0 });
    it(`allows ${MAX_GOALS} goals and not more`, () => {
        expect(MAX_GOALS).toBe(50);
        expect(createExperimentSchema.safeParse(flowExperimentBody({ goals: Array.from({ length: 50 }, (_, i) => goal(i)) })).success).toBe(true);
        expect(createExperimentSchema.safeParse(flowExperimentBody({ goals: Array.from({ length: 51 }, (_, i) => goal(i)) })).success).toBe(false);
    });
    it('needs a name and a single valid selector', () => {
        expect(createExperimentSchema.safeParse(flowExperimentBody({ goals: [{ name: ' ', selector: '#a', is_primary: true }] })).success).toBe(false);
        expect(createExperimentSchema.safeParse(flowExperimentBody({ goals: [{ name: 'A', selector: '#a, #b', is_primary: true }] })).success).toBe(false);
    });
});

describe('goal routes', () => {
    let cleanup: () => void;
    let expId: string;
    beforeAll(async () => {
        cleanup = useTempDatabase();
        const u = await db.createUser({ email: 'g@example.com', name: 'G' });
        const ws = await db.ensureWorkspace(u);
        await makePaid(ws.orgId); // several goals per test are a paid feature
        await seedProjectDomain(ws.projectId, 'localhost');
        session.current = { user: { id: u.id } };
        expId = (await (await create(req('POST', '/api/experiments', flowExperimentBody()))).json()).experiment.id;
    });
    afterAll(() => cleanup());

    const add = (body: unknown) => addGoal(req('POST', `/api/experiments/${expId}/goals`, body), p(expId));

    it('adds goals in order, validates and caps at 50', async () => {
        expect((await add({ name: '', selector: '#x', is_primary: false })).status).toBe(400);
        expect((await add({ name: 'List', selector: '#x, #y', is_primary: false })).status).toBe(400);
        expect((await add({ name: 'Bad', selector: 'div[', is_primary: false })).status).toBe(400);
        for (let i = 1; i < 50; i++) expect((await add({ name: `G${i}`, selector: `#g${i}`, is_primary: false })).status).toBe(201);
        const goals = await db.getGoals(expId);
        expect(goals).toHaveLength(50);
        expect(goals.map((g) => g.position)).toEqual(Array.from({ length: 50 }, (_, i) => i));
        expect(goals[1].name).toBe('G1');
        const over = await add({ name: 'One more', selector: '#more', is_primary: false });
        expect(over.status).toBe(400);
        expect((await over.json()).error).toMatch(/50/);
    });

    it('reorders, changes primary and removes', async () => {
        const goals = await db.getGoals(expId);
        const order = [...goals.map((g) => g.id)].reverse();
        expect((await patchGoals(req('PATCH', `/api/experiments/${expId}/goals`, { order: order.slice(1) }), p(expId))).status).toBe(400);
        const ok = await patchGoals(req('PATCH', `/api/experiments/${expId}/goals`, { order }), p(expId));
        expect(ok.status).toBe(200);
        expect((await db.getGoals(expId)).map((g) => g.id)).toEqual(order);

        const primary = goals.find((g) => g.is_primary)!;
        const other = goals.find((g) => !g.is_primary)!;
        await patchGoals(req('PATCH', `/api/experiments/${expId}/goals`, { primary: other.id }), p(expId));
        expect((await db.getGoals(expId)).filter((g) => g.is_primary).map((g) => g.id)).toEqual([other.id]);

        // Removing the primary promotes the first remaining goal.
        const del = await removeGoal(req('DELETE', `/api/experiments/${expId}/goals?goal=${other.id}`), p(expId));
        expect(del.status).toBe(200);
        const after = await db.getGoals(expId);
        expect(after).toHaveLength(49);
        expect(after[0].is_primary).toBe(true);
        expect(after.map((g) => g.position)).toEqual(Array.from({ length: 49 }, (_, i) => i));
        expect(after.some((g) => g.id === primary.id)).toBe(true);
        expect((await removeGoal(req('DELETE', `/api/experiments/${expId}/goals?goal=nope`), p(expId))).status).toBe(404);
    });

    it('will not remove the last goal once the test has started (a draft may, to swap it)', async () => {
        await db.updateExperiment(expId, { status: 'paused' });
        const goals = await db.getGoals(expId);
        for (const g of goals.slice(1)) await removeGoal(req('DELETE', `/api/experiments/${expId}/goals?goal=${g.id}`), p(expId));
        const last = await removeGoal(req('DELETE', `/api/experiments/${expId}/goals?goal=${goals[0].id}`), p(expId));
        expect(last.status).toBe(400);
        expect(await db.getGoals(expId)).toHaveLength(1);
        await db.updateExperiment(expId, { status: 'draft' });
    });

    it('results list every named goal with its own conversions, from grouped stats', async () => {
        await add({ name: 'Pricing click', selector: '#pricing', is_primary: false });
        const exp = (await db.getExperiment(expId))!;
        const vars = await db.getVariations(expId);
        const goals = await db.getGoals(expId);
        await db.createEvent({ experiment_id: expId, variation_id: vars[0].id, user_id: 'u1', event_type: 'view', environment_id: null, event_name: null, goal_id: null, metadata: null } as never);
        await db.createEvent({ experiment_id: expId, variation_id: vars[0].id, user_id: 'u1', event_type: 'conversion', environment_id: null, event_name: null, goal_id: goals[1].id, metadata: null } as never);
        const spy = vi.spyOn(db, 'getEventStats');
        const r = await buildExperimentResults(exp);
        expect(spy).not.toHaveBeenCalled();
        expect(r.goals.map((g) => g.goal_name)).toEqual(goals.map((g) => g.name));
        const pricing = r.goals.find((g) => g.goal_name === 'Pricing click')!;
        expect(pricing.variations.find((v) => v.variation_id === vars[0].id)!.conversions).toBe(1);
        expect(r.goals[0].variations.every((v) => v.conversions === 0)).toBe(true);
        for (const g of goals) {
            const raw = await db.getEventStatsRaw(expId, undefined, g.id);
            const grouped = (await db.getEventStatsByGoal(expId, undefined, [g.id])).get(g.id)!;
            expect(grouped.map((s) => [s.variation_id, Number(s.total_users), Number(s.conversions)]).sort()).toEqual(raw.map((s) => [s.variation_id, Number(s.total_users), Number(s.conversions)]).sort());
        }
    });
});

describe('migration 0016_goal_position', () => {
    it('backfills position per experiment, primary first then by age', async () => {
        const c = createClient({ url: ':memory:' });
        await c.execute('create table goals (id text primary key, experiment_id text, is_primary integer, created_at text)');
        await c.execute(`insert into goals values ('a','e1',0,'2024-01-01'),('b','e1',1,'2024-01-03'),('c','e1',0,'2024-01-02'),('d','e2',1,'2024-01-01')`);
        for (const stmt of readFileSync('drizzle/0016_goal_position.sql', 'utf8').split('--> statement-breakpoint')) await c.execute(stmt);
        const rows = (await c.execute('select id, position from goals order by experiment_id, position')).rows.map((r) => `${r.id}${r.position}`);
        expect(rows).toEqual(['b0', 'a1', 'c2', 'd0']);
        const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')).entries as { tag: string; when: number }[];
        const mine = journal.find((e) => e.tag === '0016_goal_position')!;
        expect(journal.slice(0, journal.indexOf(mine)).every((e) => e.when < mine.when)).toBe(true);
    });
});

describe('sdk goal binding', () => {
    it('splits goals by kind once and drops fired goals', () => {
        const src = readFileSync('sdk-src/sdk.js', 'utf8');
        expect(src).toMatch(/var pending = \{ click: \[\], form: \[\] \}/);
        expect(src).toMatch(/list\.splice\(i, 1\);\s*track\(/);
    });
});
