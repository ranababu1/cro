import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody, resetFreeTestUsage } from './helpers';
import { rampAllocation, effectiveAllocation, pastStop, rampFullAt, runSchedules } from '@/lib/schedule';
import type { Experiment } from '@/lib/types';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { POST as create } from '@/app/api/experiments/route';
import { PATCH as patch } from '@/app/api/experiments/[id]/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';
import { POST as assign } from '@/app/api/assign/route';
import { GET as getSchedule, PUT as putSchedule, DELETE as clearSchedule } from '@/app/api/experiments/[id]/schedule/route';

const H = 3_600_000;
const json = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
    new NextRequest(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const p = (id: string) => ({ params: Promise.resolve({ id }) });
const iso = (ms: number) => new Date(ms).toISOString();

describe('ramp and stop math', () => {
    const e = (x: Partial<Experiment>) => ({ status: 'running', traffic_allocation: 80, started_at: iso(Date.now()), schedule_stop_at: null, ramp_start: null, ramp_step: null, ramp_every_hours: null, ...x }) as Experiment;
    it('uses the full traffic setting without a ramp', () => {
        expect(rampAllocation(e({}))).toBe(80);
        expect(rampFullAt(e({}))).toBeNull();
    });
    it('steps up from the first start and caps at the traffic setting', () => {
        const t0 = Date.parse('2026-10-01T00:00:00Z');
        const r = e({ started_at: iso(t0), ramp_start: 10, ramp_step: 20, ramp_every_hours: 6 });
        expect(rampAllocation(r, t0)).toBe(10);
        expect(rampAllocation(r, t0 + 6 * H - 1)).toBe(10);
        expect(rampAllocation(r, t0 + 6 * H)).toBe(30);
        expect(rampAllocation(r, t0 + 18 * H)).toBe(70);
        expect(rampAllocation(r, t0 + 24 * H)).toBe(80);
        expect(rampFullAt(r)).toBe(iso(t0 + 24 * H));
    });
    it('lets nobody in past the stop time', () => {
        const now = Date.now();
        expect(pastStop(e({ schedule_stop_at: iso(now - 1) }), now)).toBe(true);
        expect(effectiveAllocation(e({ schedule_stop_at: iso(now - 1) }), now)).toBe(0);
        expect(effectiveAllocation(e({ schedule_stop_at: iso(now + H) }), now)).toBe(80);
    });
});

describe('scheduled start, stop and ramp', () => {
    let cleanup: () => void;
    let userId = '', otherId = '', orgId = '', sdkKey = '';
    let clock = Date.now() + 10 * 60_000;
    // Each run is a minute after the last, so the once-a-minute claim is always free.
    const run = () => { clock += 61_000; return runSchedules(new Date(clock)); };
    const as = (id: string | null) => { session.current = id ? { user: { id } } : null; };
    const newTest = async (name: string) => {
        as(userId);
        await resetFreeTestUsage();
        const r = await create(json('POST', '/api/experiments', flowExperimentBody({ name })));
        return (await r.json()).experiment.id as string;
    };
    const put = (id: string, body: unknown) => putSchedule(json('PUT', `/api/experiments/${id}/schedule`, body), p(id));
    const boot = (user: string) => bootstrap(json('POST', '/api/sdk/bootstrap', { url: 'http://localhost/demo/control.html', user_id: user }, { 'X-API-Key': sdkKey }));
    const actions = async (id: string) => (await db.getAuditLog(orgId, 200)).filter((a) => a.entity_id === id).map((a) => a.action);

    beforeAll(async () => {
        cleanup = useTempDatabase();
        const u = await db.createUser({ email: 'sched@example.com', name: 'Sched' });
        userId = u.id;
        const ws = await db.ensureWorkspace(u);
        orgId = ws.orgId;
        await seedProjectDomain(ws.projectId, 'localhost');
        const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'dev')!;
        sdkKey = (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key;
        otherId = (await db.createUser({ email: 'other-sched@example.com', name: 'Other' })).id;
        await db.ensureWorkspace((await db.getUser(otherId))!);
    });
    afterAll(() => cleanup());

    it('validates the schedule and keeps it to the owner', async () => {
        const id = await newTest('Validate');
        const now = Date.now();
        expect((await put(id, { start_at: iso(now - 60_000), stop_at: null, ramp: null })).status).toBe(400);
        expect((await put(id, { start_at: iso(now + 2 * H), stop_at: iso(now + H), ramp: null })).status).toBe(400);
        expect((await put(id, { start_at: null, stop_at: iso(now + H), ramp: null })).status).toBe(400);
        expect((await put(id, { start_at: iso(now + H), stop_at: null, ramp: { start: 0, step: 10, every_hours: 1 } })).status).toBe(400);
        expect((await put(id, { start_at: iso(now + H), stop_at: null, ramp: null, extra: 1 })).status).toBe(400);
        as(otherId);
        expect((await put(id, { start_at: iso(now + H), stop_at: null, ramp: null })).status).toBe(404);
        as(null);
        expect((await put(id, { start_at: iso(now + H), stop_at: null, ramp: null })).status).toBe(401);
        as(userId);
        const ok = await put(id, { start_at: iso(now + H), stop_at: iso(now + 3 * H), ramp: { start: 10, step: 10, every_hours: 24 } });
        expect(ok.status).toBe(200);
        expect((await ok.json()).schedule).toMatchObject({ ramp: { start: 10, step: 10, every_hours: 24 }, error: null });
        expect(await actions(id)).toContain('schedule:set');
        const cleared = await (await clearSchedule(json('DELETE', '/'), p(id))).json();
        expect(cleared.schedule).toMatchObject({ start_at: null, stop_at: null, ramp: null });
        expect(await actions(id)).toContain('schedule:clear');
        await db.deleteExperiment(id);
    });

    it('starts a draft when its start time arrives, with the same counters as a manual start', async () => {
        const id = await newTest('Starts later');
        expect((await put(id, { start_at: iso(Date.now() + H), stop_at: null, ramp: null })).status).toBe(200);
        expect((await run())?.started).not.toContain(id);
        const before = (await db.getOrganization(orgId))!.experiments_started_total;
        await db.updateExperiment(id, { schedule_start_at: iso(clock) });
        const out = await run();
        expect(out?.started).toContain(id);
        const e = (await db.getExperiment(id))!;
        expect(e.status).toBe('running');
        expect(e.started_at).toBeTruthy();
        expect(e.schedule_start_at).toBeNull();
        expect((await db.getOrganization(orgId))!.experiments_started_total).toBe(before + 1);
        expect(await actions(id)).toContain('schedule:start');
        expect((await (await boot('v-start')).json()).matched).toBe(true);
    });

    it('cancels a scheduled start that would break a plan limit, and says why', async () => {
        // Free plan: one running test at a time, and the previous test is still running.
        const id = await newTest('Blocked');
        const res = await (await put(id, { start_at: iso(Date.now() + H), stop_at: null, ramp: null })).json();
        expect(res.warning).toMatch(/cancelled/);
        await db.updateExperiment(id, { schedule_start_at: iso(clock) });
        expect((await run())?.failed).toContain(id);
        const e = (await db.getExperiment(id))!;
        expect(e.status).toBe('draft');
        expect(e.schedule_start_at).toBeNull();
        expect(e.schedule_error).toBeTruthy();
        expect(await actions(id)).toContain('schedule:start_failed');
        // Not retried every minute.
        expect((await run())?.failed).not.toContain(id);
        await db.deleteExperiment(id);
    });

    it('stops assigning at the stop time, then completes the test', async () => {
        const running = (await db.getExperiments([(await db.getProjectsForUser(userId))[0].id])).find((e) => e.status === 'running')!;
        expect((await put(running.id, { start_at: null, stop_at: iso(Date.now() + H), ramp: null })).status).toBe(200);
        await db.updateExperiment(running.id, { schedule_stop_at: iso(Date.now() - 1000) });
        const b = await (await boot('v-after-stop')).json();
        expect(b.reason).toBe('not_running');
        const a = await (await assign(json('POST', '/api/assign', { experiment_id: running.id, user_id: 'v-start' }, { 'X-API-Key': sdkKey }))).json();
        expect(a.assigned).toBe(false);
        expect((await run())?.stopped).toContain(running.id);
        const e = (await db.getExperiment(running.id))!;
        expect(e.status).toBe('completed');
        expect(e.ended_at).toBeTruthy();
        expect(await actions(running.id)).toContain('schedule:stop');
    });

    it('ramps new visitors in step by step and keeps people already in the test', async () => {
        const id = await newTest('Ramp');
        as(userId);
        expect((await patch(json('PATCH', '/', { status: 'running' }), p(id))).status).toBe(200);
        expect((await put(id, { start_at: null, stop_at: null, ramp: { start: 10, step: 30, every_hours: 1 } })).status).toBe(200);
        const inTest = async (prefix: string) => {
            let n = 0;
            for (let i = 0; i < 300; i++) {
                const r = await (await boot(`${prefix}-${i}`)).json();
                if (r.reason !== 'outside_traffic') n++;
            }
            return n;
        };
        const first = await inTest('r1');
        expect(first).toBeGreaterThan(10);
        expect(first).toBeLessThan(60);
        expect((await (await getSchedule(json('GET', '/'), p(id))).json()).schedule.traffic_now).toBe(10);
        // Two hours after the first start: 10 + 2 x 30 = 70%.
        await db.updateExperiment(id, { started_at: iso(Date.now() - 2 * H - 1000) });
        const later = await inTest('r2');
        expect(later).toBeGreaterThan(170);
        expect(later).toBeLessThan(250);
        // Visitors already in keep their version.
        const kept = await (await boot('r1-0')).json();
        const again = await (await boot('r1-0')).json();
        expect(again.variation_id ?? null).toBe(kept.variation_id ?? null);
    }, 30_000); // many bootstraps; slow CI runners need more than the 5s default

    it('a manual start clears a pending scheduled start', async () => {
        const id = await newTest('Manual');
        // Complete the ramp test first so a running slot is free.
        const ramp = (await db.getExperiments([(await db.getProjectsForUser(userId))[0].id])).find((e) => e.status === 'running')!;
        expect((await patch(json('PATCH', '/', { status: 'completed' }), p(ramp.id))).status).toBe(200);
        await put(id, { start_at: iso(Date.now() + H), stop_at: null, ramp: null });
        expect((await patch(json('PATCH', '/', { status: 'running' }), p(id))).status).toBe(200);
        expect((await db.getExperiment(id))!.schedule_start_at).toBeNull();
    });
});
