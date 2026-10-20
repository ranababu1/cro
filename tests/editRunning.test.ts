import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody, makePaid } from './helpers';
import { checkAllocation } from '@/lib/allocation';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { POST as create } from '@/app/api/experiments/route';
import { PATCH as patch } from '@/app/api/experiments/[id]/route';
import { PATCH as allocate } from '@/app/api/experiments/[id]/variations/route';
import { POST as addGoal } from '@/app/api/experiments/[id]/goals/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';

const req = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
    new NextRequest(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });

describe('checkAllocation', () => {
    const cur = [{ id: 'c', is_control: true }, { id: 'a', is_control: false }, { id: 'b', is_control: false }];
    it('accepts a valid split and zeroes paused weights', () => {
        const r = checkAllocation(cur, [{ id: 'c', weight: 50, paused: false }, { id: 'a', weight: 50, paused: false }, { id: 'b', weight: 30, paused: true }]);
        expect(r.ok && r.rows.find((x) => x.id === 'b')!.weight).toBe(0);
    });
    it('rejects bad edits', () => {
        expect(checkAllocation(cur, [{ id: 'c', weight: 50, paused: false }, { id: 'a', weight: 50, paused: false }]).ok).toBe(false);
        expect(checkAllocation(cur, [{ id: 'c', weight: 100, paused: true }, { id: 'a', weight: 0, paused: false }, { id: 'b', weight: 0, paused: false }]).ok).toBe(false);
        expect(checkAllocation(cur, [{ id: 'c', weight: 100, paused: false }, { id: 'a', weight: 0, paused: true }, { id: 'b', weight: 0, paused: true }]).ok).toBe(false);
        const r = checkAllocation(cur, [{ id: 'c', weight: 40, paused: false }, { id: 'a', weight: 40, paused: false }, { id: 'b', weight: 0, paused: false }]);
        expect(r.ok).toBe(false);
        expect(!r.ok && r.error).toMatch(/Currently 80/);
        expect(checkAllocation(cur, [{ id: 'c', weight: 50, paused: false }, { id: 'a', weight: 50, paused: false }, { id: 'x', weight: 0, paused: false }]).ok).toBe(false);
    });
});

describe('editing a running test', () => {
    let cleanup: () => void;
    let sdkKey: string;
    let expId: string;
    let vars: { id: string; is_control: boolean }[];
    const p = (id: string) => ({ params: Promise.resolve({ id }) });
    const boot = (user: string) => bootstrap(req('POST', '/api/sdk/bootstrap', { url: 'http://localhost/demo/control.html', user_id: user }, { 'X-API-Key': sdkKey })).then((r) => r.json());

    beforeAll(async () => {
        cleanup = useTempDatabase();
        const u = await db.createUser({ email: 'e@example.com', name: 'E' });
        const ws = await db.ensureWorkspace(u);
        await makePaid(ws.orgId); // several goals per test are a paid feature
        await seedProjectDomain(ws.projectId, 'localhost');
        const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'dev')!;
        sdkKey = (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key;
        session.current = { user: { id: u.id } };
        const data = await (await create(req('POST', '/api/experiments', flowExperimentBody()))).json();
        expId = data.experiment.id;
        vars = data.variations;
        await patch(req('PATCH', `/api/experiments/${expId}`, { status: 'running' }), p(expId));
    });
    afterAll(() => cleanup());

    it('pausing a variation sends new visitors to control and keeps existing ones', async () => {
        const variation = vars.find((v) => !v.is_control)!;
        const control = vars.find((v) => v.is_control)!;
        // Find a visitor bucketed into the variation before the pause.
        let early = '';
        for (let i = 0; i < 50 && !early; i++) {
            const b = await boot(`pre${i}`);
            if (b.variation_id === variation.id) early = `pre${i}`;
        }
        expect(early).not.toBe('');
        // Pausing the only variation is not allowed.
        const bad = await allocate(req('PATCH', `/api/experiments/${expId}/variations`, { variations: [{ id: control.id, weight: 100, paused: false }, { id: variation.id, weight: 0, paused: true }] }), p(expId));
        expect(bad.status).toBe(400);
        const res = await allocate(req('PATCH', `/api/experiments/${expId}/variations`, { variations: [{ id: control.id, weight: 80, paused: false }, { id: variation.id, weight: 20, paused: false }] }), p(expId));
        expect(res.status).toBe(200);
        const after = (await res.json()).variations;
        expect(after.find((v: { id: string }) => v.id === control.id).weight).toBe(80);
        expect((await boot(early)).variation_id).toBe(variation.id);
    });

    it('adds a goal while running and moves primary', async () => {
        const res = await addGoal(req('POST', `/api/experiments/${expId}/goals`, { name: 'Thanks', type: 'page', selector: '/thanks', match_type: 'contains', is_primary: true }), p(expId));
        expect(res.status).toBe(201);
        const { goals } = await res.json();
        expect(goals).toHaveLength(2);
        expect(goals.filter((g: { is_primary: boolean }) => g.is_primary)).toHaveLength(1);
        expect(goals.find((g: { is_primary: boolean }) => g.is_primary).name).toBe('Thanks');
        const bad = await addGoal(req('POST', `/api/experiments/${expId}/goals`, { name: 'x', type: 'click', selector: '<b>', is_primary: false }), p(expId));
        expect(bad.status).toBe(400);
    });

    it('blocks edits on completed tests and for other users', async () => {
        session.current = { user: { id: (await db.createUser({ email: 'other@example.com', name: 'O' })).id } };
        const r = await addGoal(req('POST', `/api/experiments/${expId}/goals`, { name: 'x', type: 'click', selector: '#x', is_primary: false }), p(expId));
        expect(r.status).toBe(404);
        session.current = { user: { id: (await db.getUserByEmail('e@example.com'))!.id } };
        await patch(req('PATCH', `/api/experiments/${expId}`, { status: 'completed' }), p(expId));
        const r2 = await addGoal(req('POST', `/api/experiments/${expId}/goals`, { name: 'x', type: 'click', selector: '#x', is_primary: false }), p(expId));
        expect(r2.status).toBe(400);
    });
});
