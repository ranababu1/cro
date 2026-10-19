import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { generateId } from '@/lib/ids';
import { planEstimate, estimateText, MAX_IDEAS } from '@/lib/planner';
import { GET as list, POST as create } from '@/app/api/ideas/route';
import { GET as getOne, PATCH as patchOne, DELETE as deleteOne } from '@/app/api/ideas/[id]/route';
import fs from 'node:fs';

let cleanup: () => void;
type T = { user: { id: string; email: string }; projectId: string; orgId: string };
const t: Record<string, T> = {};
async function tenant(email: string): Promise<T> {
    const u = await db.createUser({ email, name: email });
    const ws = await db.ensureWorkspace(u);
    return { user: { id: u.id, email }, projectId: ws.projectId, orgId: ws.orgId };
}
const as = (who: T) => { session.current = { user: who.user }; };
const req = (url: string, method: string, body?: unknown) => new NextRequest(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
const p = (id: string) => ({ params: Promise.resolve({ id }) });
async function experiment(who: T) {
    const id = generateId('exp');
    await db.createExperiment({ id, project_id: who.projectId, user_id: who.user.id, name: 'From idea', status: 'draft', traffic_allocation: 100, control_url: 'https://example.com/signup' },
        [{ name: 'Control', weight: 50, is_control: true, url: 'https://example.com/signup' }, { name: 'B', weight: 50, is_control: false, url: 'https://example.com/signup-b' }]);
    return id;
}

beforeAll(async () => {
    cleanup = useTempDatabase();
    t.a = await tenant('planner-a@example.com');
    t.b = await tenant('planner-b@example.com');
});
afterAll(() => cleanup());

describe('duration estimate', () => {
    it('matches the sample size table in the docs for two versions', () => {
        expect(planEstimate({ baseline_rate: 2, expected_lift: 10, daily_visitors: null, variations: 2 })?.per_variation).toBe(80683);
        expect(planEstimate({ baseline_rate: 5, expected_lift: 20, daily_visitors: null, variations: 2 })?.per_variation).toBe(8159);
        expect(planEstimate({ baseline_rate: 10, expected_lift: 30, daily_visitors: null, variations: 2 })?.per_variation).toBe(1776);
    });

    it('turns visitors into days, with the peeking-safe range at 2 to 3 times', () => {
        const e = planEstimate({ baseline_rate: 5, expected_lift: 20, daily_visitors: 1000, variations: 2 })!;
        expect(e.total).toBe(16318);
        expect(e.fixed_days).toBe(17);
        expect(e.sequential_days).toEqual([34, 51]);
        expect(estimateText(e)).toBe('About 8,159 visitors per version (16,318 in total): 17 days if you look once at the end, or about 34 to 51 days to call it with the peeking-safe test.');
    });

    it('splits 5% across comparisons with more versions, so each version needs more visitors', () => {
        const two = planEstimate({ baseline_rate: 5, expected_lift: 20, daily_visitors: null, variations: 2 })!;
        const four = planEstimate({ baseline_rate: 5, expected_lift: 20, daily_visitors: null, variations: 4 })!;
        expect(four.alpha).toBeCloseTo(0.05 / 3);
        expect(four.per_variation).toBeGreaterThan(two.per_variation);
        expect(four.total).toBe(four.per_variation * 4);
    });

    it('needs a rate and a lift, and refuses impossible ones', () => {
        expect(planEstimate({ baseline_rate: null, expected_lift: 10, daily_visitors: 100, variations: 2 })).toBeNull();
        expect(planEstimate({ baseline_rate: 60, expected_lift: 100, daily_visitors: 100, variations: 2 })).toBeNull();
        expect(estimateText(null)).toMatch(/Add the conversion rate/);
        expect(estimateText(planEstimate({ baseline_rate: 5, expected_lift: 20, daily_visitors: null, variations: 2 }))).toMatch(/Add daily visitors/);
    });
});

describe('ideas API', () => {
    let id = '';
    it('creates, validates and lists ideas on any plan', async () => {
        as(t.a);
        expect((await create(req('/api/ideas', 'POST', { title: '' }))).status).toBe(400);
        expect((await create(req('/api/ideas', 'POST', { title: 'x', baseline_rate: 0 }))).status).toBe(400);
        expect((await create(req('/api/ideas', 'POST', { title: 'x', page_url: 'javascript:alert(1)' }))).status).toBe(400);
        expect((await create(req('/api/ideas', 'POST', { title: 'x', variations: 1 }))).status).toBe(400);
        const res = await create(req('/api/ideas', 'POST', { title: 'Shorter signup form', hypothesis: 'Fewer fields, more signups.', page_url: 'https://example.com/signup', baseline_rate: 5, expected_lift: 20, daily_visitors: 1000, priority: 'high' }));
        expect(res.status).toBe(201);
        const j = await res.json();
        id = j.idea.id;
        expect(j.idea).toMatchObject({ status: 'idea', priority: 'high', variations: 2, estimate: { per_variation: 8159, fixed_days: 17 } });
        const l = await (await list(req('/api/ideas', 'GET'))).json();
        expect(l.ideas).toHaveLength(1);
        expect(l.max).toBe(MAX_IDEAS);
    });

    it('moves between columns and edits fields', async () => {
        as(t.a);
        const j = await (await patchOne(req(`/api/ideas/${id}`, 'PATCH', { status: 'planned', daily_visitors: 500 }), p(id))).json();
        expect(j.idea).toMatchObject({ status: 'planned', estimate: { fixed_days: 33 } });
        expect((await patchOne(req(`/api/ideas/${id}`, 'PATCH', { status: 'archived' }), p(id))).status).toBe(400);
    });

    it('links the test made from it, only within the same project', async () => {
        as(t.a);
        const other = await experiment(t.b);
        expect((await patchOne(req(`/api/ideas/${id}`, 'PATCH', { experiment_id: other }), p(id))).status).toBe(400);
        const mine = await experiment(t.a);
        const j = await (await patchOne(req(`/api/ideas/${id}`, 'PATCH', { experiment_id: mine }), p(id))).json();
        expect(j.idea).toMatchObject({ status: 'started', experiment_id: mine });
        // Deleting the test keeps the idea and clears the link.
        await db.deleteExperiment(mine);
        expect((await (await getOne(req(`/api/ideas/${id}`, 'GET'), p(id))).json()).idea.experiment_id).toBeNull();
    });

    it('never reaches another account\'s idea', async () => {
        as(t.b);
        expect((await getOne(req(`/api/ideas/${id}`, 'GET'), p(id))).status).toBe(404);
        expect((await patchOne(req(`/api/ideas/${id}`, 'PATCH', { title: 'mine now' }), p(id))).status).toBe(404);
        expect((await deleteOne(req(`/api/ideas/${id}`, 'DELETE'), p(id))).status).toBe(404);
        expect((await (await list(req('/api/ideas', 'GET'))).json()).ideas).toHaveLength(0);
    });

    it('deletes, with audit entries', async () => {
        as(t.a);
        expect((await deleteOne(req(`/api/ideas/${id}`, 'DELETE'), p(id))).status).toBe(200);
        const acts = (await db.listAuditForOrg(t.a.orgId, { since: '2000-01-01', entity: 'idea', limit: 50 })).map((a) => a.action);
        expect(acts).toEqual(expect.arrayContaining(['create', 'update', 'idea:start', 'delete']));
    });

    it('signed-out requests get 401', async () => {
        session.current = null;
        expect((await list(req('/api/ideas', 'GET'))).status).toBe(401);
    });
});

describe('wizard link', () => {
    it('the new test wizard reads ?idea= and links the idea after creating the test', () => {
        const src = fs.readFileSync('app/(app)/experiments/new/page.tsx', 'utf8');
        expect(src).toContain("new URLSearchParams(window.location.search).get('idea')");
        expect(src).toContain('JSON.stringify({ experiment_id: data.experiment.id })');
    });
});
