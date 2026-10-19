import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';
import { computeFunnel, computeFunnelTrend, funnelSchema, periodOf, pickBucket, MAX_TREND_POINTS } from '@/lib/funnels';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import { POST as create } from '@/app/api/experiments/route';
import { GET as list, POST as add, DELETE as remove } from '@/app/api/experiments/[id]/funnels/route';

describe('computeFunnel', () => {
    const steps = [{ id: 'g1', name: 'View pricing' }, { id: 'g2', name: 'Start signup' }, { id: 'g3', name: 'Finish signup' }];
    const vars = [{ id: 'c', name: 'Control', is_control: true }, { id: 'v', name: 'B', is_control: false }];
    const hit = (variation_id: string, user_id: string, goal_id: string, t: string) => ({ variation_id, user_id, goal_id, t });
    it('counts each step only after the previous one, using first completion times', () => {
        const r = computeFunnel(steps, vars, new Map([['c', 10], ['v', 10]]), [
            hit('c', 'a', 'g1', '01'), hit('c', 'a', 'g2', '02'), hit('c', 'a', 'g3', '03'),
            hit('c', 'b', 'g1', '01'), hit('c', 'b', 'g3', '02'), // skipped step 2
            hit('c', 'd', 'g2', '01'), hit('c', 'd', 'g1', '02'), // step 2 before step 1
            hit('v', 'e', 'g1', '01'), hit('v', 'e', 'g2', '05'), hit('v', 'e', 'g2', '00'), // earliest g2 is before g1
        ]);
        expect(r[0].steps.map((s) => s.users)).toEqual([3, 1, 1]);
        expect(r[0].steps[1].of_previous).toBeCloseTo(1 / 3);
        expect(r[0].completion).toBeCloseTo(0.1);
        expect(r[1].steps.map((s) => s.users)).toEqual([1, 0, 0]);
        expect(r[1].steps[2].of_previous).toBe(0);
    });
    it('validates funnel definitions', () => {
        expect(funnelSchema.safeParse({ name: 'F', steps: ['a'] }).success).toBe(false);
        expect(funnelSchema.safeParse({ name: 'F', steps: ['a', 'a'] }).success).toBe(false);
        expect(funnelSchema.safeParse({ name: '', steps: ['a', 'b'] }).success).toBe(false);
        expect(funnelSchema.safeParse({ name: 'F', steps: Array.from({ length: 11 }, (_, i) => `g${i}`) }).success).toBe(false);
        expect(funnelSchema.safeParse({ name: 'F', steps: ['a', 'b'] }).success).toBe(true);
    });
});

describe('computeFunnelTrend', () => {
    const steps = [{ id: 'g1' }, { id: 'g2' }];
    const vars = [{ id: 'c', name: 'Control', is_control: true }, { id: 'v', name: 'B', is_control: false }];
    const hit = (variation_id: string, user_id: string, goal_id: string, t: string) => ({ variation_id, user_id, goal_id, t });
    it('buckets by UTC day or Monday week', () => {
        expect(periodOf('2026-10-14T23:59:00.000Z', 'day')).toBe('2026-10-14');
        expect(periodOf('2026-10-14T10:00:00.000Z', 'week')).toBe('2026-10-12'); // Wednesday -> Monday
        expect(periodOf('2026-10-18T10:00:00.000Z', 'week')).toBe('2026-10-12'); // Sunday -> Monday
        expect(periodOf('2026-10-19T00:00:00.000Z', 'week')).toBe('2026-10-19');
        expect(pickBucket('2026-01-01T00:00:00Z', '2026-02-15T00:00:00Z')).toBe('day');
        expect(pickBucket('2026-01-01T00:00:00Z', '2026-04-15T00:00:00Z')).toBe('week');
        expect(pickBucket('2026-01-01T00:00:00Z', '2026-04-15T00:00:00Z', 'day')).toBe('day');
        expect(pickBucket(null, null)).toBe('day');
    });
    it('counts starters by first step period and completions in order, filling gaps', () => {
        const r = computeFunnelTrend(steps, vars, [
            hit('c', 'a', 'g1', '2026-10-10T09:00:00Z'), hit('c', 'a', 'g2', '2026-10-12T09:00:00Z'), // finished later, counted on the 10th
            hit('c', 'b', 'g1', '2026-10-10T10:00:00Z'),
            hit('c', 'd', 'g2', '2026-10-11T08:00:00Z'), hit('c', 'd', 'g1', '2026-10-12T09:00:00Z'), // out of order
            hit('v', 'e', 'g1', '2026-10-12T09:00:00Z'), hit('v', 'e', 'g2', '2026-10-12T09:30:00Z'),
            hit('c', 'z', 'g2', '2026-10-09T09:00:00Z'), // never started
        ], 'day', new Date('2026-10-13T12:00:00Z'));
        expect(r.periods).toEqual(['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13']);
        expect(r.variations[0].points.map((p) => [p.started, p.completed])).toEqual([[2, 1], [0, 0], [1, 0], [0, 0]]);
        expect(r.variations[0].points[0].rate).toBe(0.5);
        expect(r.variations[1].points[2]).toEqual({ period: '2026-10-12', started: 1, completed: 1, rate: 1 });
    });
    it('keeps only the latest periods and handles no data', () => {
        const r = computeFunnelTrend(steps, vars, [hit('c', 'a', 'g1', '2026-01-01T00:00:00Z')], 'day', new Date('2026-10-01T00:00:00Z'));
        expect(r.periods).toHaveLength(MAX_TREND_POINTS);
        expect(r.periods[r.periods.length - 1]).toBe('2026-10-01');
        expect(computeFunnelTrend(steps, vars, [], 'week').periods).toEqual([]);
    });
});

describe('funnel routes', () => {
    let cleanup: () => void;
    const t: Record<string, { userId: string; orgId: string; expId: string; goals: string[]; vars: string[] }> = {};
    const req = (method: string, url: string, body?: unknown) => new NextRequest(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const p = (id: string) => ({ params: Promise.resolve({ id }) });

    async function tenant(name: string, plan: string) {
        const u = await db.createUser({ email: `${name}@example.com`, name });
        const ws = await db.ensureWorkspace(u);
        await db.updateOrganization(ws.orgId, { plan });
        await seedProjectDomain(ws.projectId, 'localhost');
        session.current = { user: { id: u.id } };
        const body = flowExperimentBody({ goals: [{ name: 'Pricing', selector: '#pricing', is_primary: true }, { name: 'Signup start', selector: '#start', is_primary: false }, { name: 'Signup done', selector: '#done', is_primary: false }] });
        const data = await (await create(req('POST', '/api/experiments', body))).json();
        const goals = (await db.getGoals(data.experiment.id)).map((g) => g.id);
        return { userId: u.id, orgId: ws.orgId, expId: data.experiment.id, goals, vars: data.variations.map((v: { id: string }) => v.id) };
    }
    beforeAll(async () => {
        cleanup = useTempDatabase();
        t.free = await tenant('ffree', 'free');
        t.paid = await tenant('fpaid', 'starter');
        clearConfigCache();
    });
    afterAll(() => cleanup());

    it('is paid only', async () => {
        session.current = { user: { id: t.free.userId } };
        const res = await list(req('GET', `/api/experiments/${t.free.expId}/funnels`), p(t.free.expId));
        expect(res.status).toBe(403);
        expect((await res.json()).upgrade).toMatch(/paid plans/);
        expect((await add(req('POST', `/api/experiments/${t.free.expId}/funnels`, { name: 'F', steps: t.free.goals.slice(0, 2) }), p(t.free.expId))).status).toBe(403);
    });

    it('creates, computes per variation and removes funnels', async () => {
        session.current = { user: { id: t.paid.userId } };
        const { expId, goals, vars } = t.paid;
        // Another test's goal cannot be a step.
        expect((await add(req('POST', `/api/experiments/${expId}/funnels`, { name: 'Bad', steps: [goals[0], t.free.goals[1]] }), p(expId))).status).toBe(400);
        const ok = await add(req('POST', `/api/experiments/${expId}/funnels`, { name: 'Signup', steps: goals }), p(expId));
        expect(ok.status).toBe(201);
        const ev = (user: string, variation: string, type: 'page_view' | 'conversion', goal: string | null) =>
            db.createEvent({ experiment_id: expId, variation_id: variation, environment_id: null, user_id: user, event_type: type, event_name: null, goal_id: goal, metadata: null });
        for (const u of ['u1', 'u2', 'u3', 'u4']) await ev(u, vars[0], 'page_view', null);
        await ev('u1', vars[0], 'conversion', goals[0]); await ev('u1', vars[0], 'conversion', goals[1]); await ev('u1', vars[0], 'conversion', goals[2]);
        await ev('u2', vars[0], 'conversion', goals[0]); await ev('u2', vars[0], 'conversion', goals[1]);
        await ev('u3', vars[0], 'conversion', goals[0]);
        const res = await list(req('GET', `/api/experiments/${expId}/funnels`), p(expId));
        expect(res.status).toBe(200);
        const f = (await res.json()).funnels[0];
        expect(f.name).toBe('Signup');
        const v0 = f.variations.find((v: { variation_id: string }) => v.variation_id === vars[0]);
        expect(v0.visitors).toBe(4);
        expect(v0.steps.map((s: { users: number }) => s.users)).toEqual([3, 2, 1]);
        expect(v0.completion).toBeCloseTo(0.25);
        const today = new Date().toISOString().slice(0, 10);
        expect(f.trend.bucket).toBe('day');
        const tp = f.trend.variations.find((v: { variation_id: string }) => v.variation_id === vars[0]).points.find((x: { period: string }) => x.period === today);
        expect(tp).toMatchObject({ started: 3, completed: 1 });
        const weekly = (await (await list(req('GET', `/api/experiments/${expId}/funnels?trend=week`), p(expId))).json()).funnels[0];
        expect(weekly.trend.bucket).toBe('week');

        // Removing a goal drops it from the funnel and says so.
        await db.deleteGoal(expId, goals[1]);
        const after = (await (await list(req('GET', `/api/experiments/${expId}/funnels`), p(expId))).json()).funnels[0];
        expect(after.removed_steps).toBe(1);
        expect(after.steps.map((s: { id: string }) => s.id)).toEqual([goals[0], goals[2]]);

        expect((await remove(req('DELETE', `/api/experiments/${expId}/funnels?funnel=${f.id}`), p(expId))).status).toBe(200);
        expect((await (await list(req('GET', `/api/experiments/${expId}/funnels`), p(expId))).json()).funnels).toEqual([]);
        expect((await remove(req('DELETE', `/api/experiments/${expId}/funnels?funnel=${f.id}`), p(expId))).status).toBe(404);
    });

    it('migration 0018 is newer than every earlier one', () => {
        const j = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json', 'utf8')).entries as { tag: string; when: number }[];
        const i = j.findIndex((e) => e.tag === '0018_funnels');
        expect(i).toBeGreaterThan(0);
        expect(j.slice(0, i).every((e) => e.when < j[i].when)).toBe(true);
    });
});
