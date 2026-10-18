import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';
import { computeFunnel, funnelSchema } from '@/lib/funnels';

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
