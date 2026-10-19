import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';
import { planShift, probabilityBest, seededRandom, shiftFloor, weightsFromProbabilities, AUTO_SHIFT_MIN_VISITORS } from '@/lib/autoShift';
import { computeEntitlements } from '@/lib/entitlements';
import { planTier } from '@/lib/plans';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import { POST as create } from '@/app/api/experiments/route';
import { PATCH as patch } from '@/app/api/experiments/[id]/route';
import { GET as getShift, PATCH as setShift } from '@/app/api/experiments/[id]/auto-shift/route';
import { maybeAutoShift } from '@/lib/autoShiftRun';
import { buildExperimentResults } from '@/lib/results';

const json = (method: string, url: string, body?: unknown) =>
    new NextRequest(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' }, body: body === undefined ? undefined : JSON.stringify(body) });
const p = (id: string) => ({ params: Promise.resolve({ id }) });

describe('auto-shift math', () => {
    it('ranks plans and gates auto-shift to Growth and above', () => {
        expect([planTier('free'), planTier('starter'), planTier('growth'), planTier('enterprise'), planTier('team')]).toEqual([0, 1, 2, 3, 1]);
        expect(computeEntitlements({ plan: 'starter' }, []).features.auto_shift).toBe(false);
        expect(computeEntitlements({ plan: 'growth' }, []).features.auto_shift).toBe(true);
        expect(computeEntitlements({ plan: 'free', special_friend: true, custom_allowances: JSON.stringify({ auto_shift: true }) }, []).features.auto_shift).toBe(true);
        expect(computeEntitlements({ plan: 'free' }, ['imrn.dev@gmail.com']).features.auto_shift).toBe(true);
    });
    it('weights always sum to 100 with a floor for every arm', () => {
        expect(weightsFromProbabilities([1, 0])).toEqual([90, 10]);
        expect(weightsFromProbabilities([0.5, 0.5])).toEqual([50, 50]);
        for (const probs of [[0.2, 0.3, 0.5], [0.97, 0.01, 0.01, 0.01], Array(8).fill(1 / 8), [1, ...Array(49).fill(0)]]) {
            const w = weightsFromProbabilities(probs);
            expect(w.reduce((a, b) => a + b, 0)).toBe(100);
            expect(Math.min(...w)).toBeGreaterThanOrEqual(shiftFloor(probs.length));
        }
        expect(shiftFloor(2)).toBe(10);
        expect(shiftFloor(8)).toBe(6);
        expect(shiftFloor(50)).toBe(1);
    });
    it('Thompson sampling favours the clear winner and splits a tie', () => {
        const clear = probabilityBest([{ id: 'a', visitors: 1000, conversions: 50 }, { id: 'b', visitors: 1000, conversions: 100 }], seededRandom(1));
        expect(clear[1]).toBeGreaterThan(0.99);
        const tie = probabilityBest([{ id: 'a', visitors: 1000, conversions: 80 }, { id: 'b', visitors: 1000, conversions: 80 }], seededRandom(2));
        expect(tie[0]).toBeGreaterThan(0.4);
        expect(tie[0]).toBeLessThan(0.6);
    });
    it('waits for enough visitors in every arm', () => {
        expect(planShift([{ id: 'a', visitors: 500, conversions: 10 }, { id: 'b', visitors: AUTO_SHIFT_MIN_VISITORS - 1, conversions: 50 }], seededRandom(3))).toEqual({ ok: false, reason: 'not_enough_data' });
        expect(planShift([{ id: 'a', visitors: 500, conversions: 10 }], seededRandom(3))).toEqual({ ok: false, reason: 'too_few_arms' });
        const r = planShift([{ id: 'a', visitors: 500, conversions: 10 }, { id: 'b', visitors: 500, conversions: 60 }], seededRandom(3));
        expect(r.ok && r.weights.get('b')).toBe(90);
    });
});

describe('auto-shift routes and rebalancing', () => {
    let cleanup: () => void;
    const t: Record<string, { userId: string; orgId: string; expId: string; vars: { id: string; is_control: boolean }[] }> = {};
    async function tenant(name: string, plan: string) {
        const u = await db.createUser({ email: `${name}@example.com`, name });
        const ws = await db.ensureWorkspace(u);
        await db.updateOrganization(ws.orgId, { plan });
        await seedProjectDomain(ws.projectId, 'localhost');
        session.current = { user: { id: u.id } };
        const data = await (await create(json('POST', '/api/experiments', flowExperimentBody()))).json();
        return { userId: u.id, orgId: ws.orgId, expId: data.experiment.id as string, vars: data.variations as { id: string; is_control: boolean }[] };
    }
    async function traffic(expId: string, vars: { id: string; is_control: boolean }[], perVar: number, rates: number[]) {
        const goal = (await db.getGoals(expId))[0];
        const list = [];
        for (const v of vars) {
            for (let i = 0; i < perVar; i++) {
                const user = `${v.id}-${i}`;
                list.push({ experiment_id: expId, variation_id: v.id, environment_id: null, user_id: user, event_type: 'page_view' as const, event_name: null, goal_id: null, metadata: null });
                if (i < perVar * rates[v.is_control ? 0 : 1]) list.push({ experiment_id: expId, variation_id: v.id, environment_id: null, user_id: user, event_type: 'conversion' as const, event_name: 'CTA', goal_id: goal.id, metadata: null });
            }
        }
        await db.createEvents(list);
    }
    beforeAll(async () => {
        cleanup = useTempDatabase();
        t.starter = await tenant('astarter', 'starter');
        t.growth = await tenant('agrowth', 'growth');
        clearConfigCache();
    });
    afterAll(() => cleanup());

    it('is off by default and needs Growth to turn on', async () => {
        session.current = { user: { id: t.starter.userId } };
        const g = await (await getShift(json('GET', `/api/experiments/${t.starter.expId}/auto-shift`), p(t.starter.expId))).json();
        expect(g).toMatchObject({ allowed: false, enabled: false });
        expect(g.upgrade).toMatch(/Growth/);
        const r = await setShift(json('PATCH', `/api/experiments/${t.starter.expId}/auto-shift`, { enabled: true }), p(t.starter.expId));
        expect(r.status).toBe(403);
        expect((await setShift(json('PATCH', `/api/experiments/${t.starter.expId}/auto-shift`, { enabled: 'yes' }), p(t.starter.expId))).status).toBe(400);
        session.current = { user: { id: t.growth.userId } };
        expect((await setShift(json('PATCH', `/api/experiments/${t.starter.expId}/auto-shift`, { enabled: true }), p(t.starter.expId))).status).toBe(404);
        session.current = null;
        expect((await getShift(json('GET', `/api/experiments/${t.growth.expId}/auto-shift`), p(t.growth.expId))).status).toBe(401);
    });

    it('shifts new traffic toward the winner at most once per interval', async () => {
        session.current = { user: { id: t.growth.userId } };
        const on = await setShift(json('PATCH', `/api/experiments/${t.growth.expId}/auto-shift`, { enabled: true }), p(t.growth.expId));
        expect(on.status).toBe(200);
        expect((await on.json()).enabled).toBe(true);
        // rates[0] is the control, rates[1] the variation.
        // Not running yet: nothing to do.
        expect(await maybeAutoShift(t.growth.expId, t.growth.orgId, new Date(), { skipLocalMemo: true })).toBe('not_due');
        await patch(json('PATCH', `/api/experiments/${t.growth.expId}`, { status: 'running' }), p(t.growth.expId));
        await traffic(t.growth.expId, t.growth.vars, 50, [0.05, 0.2]);
        expect(await maybeAutoShift(t.growth.expId, t.growth.orgId, new Date(), { skipLocalMemo: true })).toBe('not_enough_data');
        // Add enough visitors: control 5%, variation 20%.
        const more = t.growth.vars.map((v) => ({ ...v }));
        for (const v of more) {
            const goal = (await db.getGoals(t.growth.expId))[0];
            const list = [];
            for (let i = 0; i < 200; i++) {
                const user = `more-${v.id}-${i}`;
                list.push({ experiment_id: t.growth.expId, variation_id: v.id, environment_id: null, user_id: user, event_type: 'page_view' as const, event_name: null, goal_id: null, metadata: null });
                if (i < 200 * (v.is_control ? 0.05 : 0.2)) list.push({ experiment_id: t.growth.expId, variation_id: v.id, environment_id: null, user_id: user, event_type: 'conversion' as const, event_name: 'CTA', goal_id: goal.id, metadata: null });
            }
            await db.createEvents(list);
        }
        // The previous check claimed this hour; an hour later it runs.
        expect(await maybeAutoShift(t.growth.expId, t.growth.orgId, new Date(), { skipLocalMemo: true })).toBe('not_due');
        const later = new Date(Date.now() + 61 * 60 * 1000);
        expect(await maybeAutoShift(t.growth.expId, t.growth.orgId, later, { skipLocalMemo: true })).toBe('shifted');
        const vars = await db.getVariations(t.growth.expId);
        const control = vars.find((v) => v.is_control)!;
        const variant = vars.find((v) => !v.is_control)!;
        expect(control.weight).toBe(10);
        expect(variant.weight).toBe(90);
        const log = await db.getAuditLog(t.growth.orgId);
        expect(log.some((e: { action: string }) => e.action === 'allocation:auto')).toBe(true);
        // The results skip the visitor split warning while auto-shift is on.
        const exp = (await db.getExperiment(t.growth.expId))!;
        const results = await buildExperimentResults(exp);
        expect(results.srm).toBeUndefined();
        const evenLater = new Date(later.getTime() + 61 * 60 * 1000);
        expect(await maybeAutoShift(t.growth.expId, t.growth.orgId, evenLater, { skipLocalMemo: true })).toBe('unchanged');
    });

    it('stops shifting after a downgrade and keeps the split when turned off', async () => {
        await db.updateOrganization(t.growth.orgId, { plan: 'starter' });
        clearConfigCache();
        const far = new Date(Date.now() + 10 * 60 * 60 * 1000);
        expect(await maybeAutoShift(t.growth.expId, t.growth.orgId, far, { skipLocalMemo: true })).toBe('not_entitled');
        session.current = { user: { id: t.growth.userId } };
        const off = await setShift(json('PATCH', `/api/experiments/${t.growth.expId}/auto-shift`, { enabled: false }), p(t.growth.expId));
        expect(off.status).toBe(200);
        expect((await off.json()).enabled).toBe(false);
        expect((await db.getVariations(t.growth.expId)).find((v) => !v.is_control)!.weight).toBe(90);
        expect(await maybeAutoShift(t.growth.expId, t.growth.orgId, new Date(far.getTime() * 2), { skipLocalMemo: true })).toBe('not_due');
    });
});

describe('auto-shift wiring', () => {
    const read = (f: string) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    it('runs from the SDK entry points after the response', () => {
        expect(read('app/api/sdk/bootstrap/route.ts')).toMatch(/scheduleAutoShift\(experiment, auth\.ctx\.orgId\)/);
        expect(read('lib/sdkFlows.ts')).toMatch(/scheduleAutoShift\(experiment, ctx\.orgId\)/);
        expect(read('lib/autoShiftRun.ts')).toMatch(/after\(run\)/);
    });
    it('pricing lists auto-shift as available on Growth and above', () => {
        const pricing = read('app/pricing/page.tsx');
        expect(pricing).toMatch(/\['Auto-shift traffic to the winner', 'Not included', 'Not included', 'Included', 'Included'\]/);
        expect(pricing).not.toMatch(/\{ name: 'Auto-shift[^}]*p: \d/); // not under coming soon
        expect(pricing).toContain("{ name: 'Auto-shift traffic to the winner on Growth and above', tier: 2 }");
    });
    it('migration is newer than every earlier one', () => {
        const j = JSON.parse(read('drizzle/meta/_journal.json')) as { entries: { tag: string; when: number }[] };
        const i = j.entries.findIndex((e) => e.tag === '0020_auto_shift');
        expect(i).toBeGreaterThan(0);
        for (const e of j.entries.slice(0, i)) expect(j.entries[i].when).toBeGreaterThan(e.when);
    });
});
