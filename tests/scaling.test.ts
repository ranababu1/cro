import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { useTempDatabase, seedProjectDomain } from './helpers';

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => null) }));

import { db, getDb } from '@/lib/db';
import { generateId } from '@/lib/ids';
import { cached, clearConfigCache, configCacheSize } from '@/lib/configCache';
import { checkVisitorQuota, clearVisitorCache, recordNewVisitor } from '@/lib/quotas';
import { ensureRolledUp } from '@/lib/rollups';
import { bumpMetric, flushTelemetry, METRICS, pendingTelemetry, utcDay } from '@/lib/telemetry';
import { POST as track } from '@/app/api/track/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';

let cleanup: () => void;
let orgId: string;
let projectId: string;
let userId: string;
let devEnv: string;
let prodEnv: string;
let sdkKey: string;

beforeAll(async () => {
    cleanup = useTempDatabase();
    const u = await db.createUser({ email: 'scale@example.com', name: 'Scale' });
    userId = u.id;
    const ws = await db.ensureWorkspace(u);
    orgId = ws.orgId;
    projectId = ws.projectId;
    await seedProjectDomain(projectId, 'localhost');
    const envs = await db.getEnvironments(projectId);
    devEnv = envs.find((e) => e.key === 'dev')!.id;
    prodEnv = envs.find((e) => e.key === 'prod')!.id;
    sdkKey = (await db.createApiKey({ environmentId: devEnv, type: 'sdk' })).key;
});
afterAll(() => cleanup());

async function makeExperiment() {
    const id = generateId('exp');
    await db.createExperiment(
        { id, project_id: projectId, user_id: userId, name: 'E', status: 'running', traffic_allocation: 100, control_url: 'http://localhost/c' },
        [{ name: 'Control', weight: 50, is_control: true, url: 'http://localhost/c' }, { name: 'B', weight: 50, is_control: false, url: 'http://localhost/b' }],
        [{ name: 'G1', selector: '#a', is_primary: true }, { name: 'G2', selector: '#b', is_primary: false }],
    );
    return { id, variations: await db.getVariations(id), goals: await db.getGoals(id) };
}

async function rawEvent(e: { exp: string; v: string; env: string | null; user: string; type: string; goal?: string | null; at: string }) {
    const d = await getDb();
    await d.run(sql`insert into events (id, experiment_id, variation_id, environment_id, user_id, event_type, goal_id, created_at)
        values (${generateId('evt')}, ${e.exp}, ${e.v}, ${e.env}, ${e.user}, ${e.type}, ${e.goal ?? null}, ${e.at})`);
}

const sortBy = <T,>(rows: T[]) => [...rows].map((r) => JSON.stringify(r, Object.keys(r as object).sort())).sort();

describe('config cache', () => {
    it('reuses values within the TTL and reloads after', async () => {
        clearConfigCache();
        let loads = 0;
        const load = async () => ++loads;
        expect(await cached('k', load, 1000)).toBe(1);
        expect(await cached('k', load, 1000)).toBe(1);
        vi.useFakeTimers();
        vi.setSystemTime(Date.now() + 2000);
        expect(await cached('k', load, 1000)).toBe(2);
        vi.useRealTimers();
    });

    it('caches key lookups and drops them on revoke', async () => {
        const k = await db.createApiKey({ environmentId: prodEnv, type: 'sdk' });
        expect(await db.authenticateApiKey(k.key)).not.toBeNull();
        expect(configCacheSize()).toBeGreaterThan(0);
        await db.revokeApiKey(k.id);
        expect(await db.authenticateApiKey(k.key)).toBeNull();
    });

    it('sees a new running test right after it is created', async () => {
        expect((await db.getRunningConfig(projectId)).length).toBe(0);
        const { id } = await makeExperiment();
        expect((await db.getRunningConfig(projectId)).map((r) => r.experiment.id)).toContain(id);
        await db.updateExperiment(id, { status: 'paused' });
        expect((await db.getRunningConfig(projectId)).map((r) => r.experiment.id)).not.toContain(id);
    });
});

describe('monthly visitor counters', () => {
    it('counts each visitor once per month and enforces the limit without scanning', async () => {
        await db.updateOrganization(orgId, { monthly_visitor_limit: 2 });
        clearVisitorCache();
        await recordNewVisitor(orgId, 'a');
        await recordNewVisitor(orgId, 'a');
        expect((await checkVisitorQuota(orgId)).used).toBe(1);
        await recordNewVisitor(orgId, 'b');
        const q = await checkVisitorQuota(orgId);
        expect(q).toMatchObject({ used: 2, allowed: false });
        await db.updateOrganization(orgId, { monthly_visitor_limit: null });
    });

    it('bootstrap enrolment bumps the counter', async () => {
        const { id } = await makeExperiment();
        const before = await db.getMonthlyVisitors(orgId, new Date().toISOString().slice(0, 7));
        const res = await bootstrap(new NextRequest('http://localhost/api/sdk/bootstrap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': sdkKey, origin: 'http://localhost' },
            body: JSON.stringify({ url: 'http://localhost/c', user_id: 'boot_visitor' }),
        }));
        expect(res.status).toBe(200);
        expect((await res.json()).experiment_id).toBeTruthy();
        expect(await db.getMonthlyVisitors(orgId, new Date().toISOString().slice(0, 7))).toBe(before + 1);
        await db.updateExperiment(id, { status: 'paused' });
    });
});

describe('results rollups', () => {
    it('match the raw-event queries exactly, before and after rollup, for every scope and goal', async () => {
        const { id, variations, goals } = await makeExperiment();
        const [c, b] = variations;
        const today = utcDay();
        const day = (n: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
        const users = ['u1', 'u2', 'u3', 'u4', 'u5'];
        let i = 0;
        for (const n of [5, 3, 2, 1, 0]) {
            for (const u of users.slice(0, 2 + (n % 4))) {
                const v = (i++ % 3 === 0) ? b : c;
                const env = i % 4 === 0 ? prodEnv : i % 5 === 0 ? null : devEnv;
                const at = n === 0 ? new Date().toISOString() : `${day(n)}T1${i % 10}:00:00.000Z`;
                await rawEvent({ exp: id, v: v.id, env, user: u, type: 'page_view', at });
                if (i % 2 === 0) await rawEvent({ exp: id, v: v.id, env, user: u, type: 'redirect', at });
                if (i % 3 === 0) await rawEvent({ exp: id, v: v.id, env, user: u, type: 'conversion', goal: goals[i % 2].id, at });
                if (i % 7 === 0) await rawEvent({ exp: id, v: v.id, env, user: u, type: 'conversion', goal: null, at });
            }
        }
        const compare = async () => {
            for (const env of [undefined, devEnv, prodEnv]) {
                for (const goal of [undefined, goals[0].id, goals[1].id]) {
                    expect(sortBy(await db.getEventStats(id, env, goal))).toEqual(sortBy(await db.getEventStatsRaw(id, env, goal)));
                }
                const a = await db.getLiveCounts(id, env);
                const r = await db.getLiveCountsRaw(id, env);
                expect(sortBy(a.byType)).toEqual(sortBy(r.byType));
                expect(sortBy(a.visitors)).toEqual(sortBy(r.visitors));
                expect(sortBy(a.goals)).toEqual(sortBy(r.goals));
                expect(sortBy(a.daily)).toEqual(sortBy(r.daily));
            }
        };
        await compare();
        const d = await getDb();
        const [state] = await d.all<{ rolled_through: string }>(sql`select rolled_through from rollup_state where experiment_id = ${id}`);
        expect(state.rolled_through < today).toBe(true);
        expect((await d.all(sql`select 1 from experiment_stats_daily where experiment_id = ${id}`)).length).toBeGreaterThan(0);
        // New raw events today keep numbers identical, and repeated rollups are idempotent.
        await rawEvent({ exp: id, v: c.id, env: devEnv, user: 'u9', type: 'page_view', at: new Date().toISOString() });
        await ensureRolledUp(id);
        await compare();
        // Rolling up today as a closed day (as tomorrow would) still matches.
        const tomorrow = new Date(Date.now() + 86_400_000);
        await ensureRolledUp(id, tomorrow);
        await compare();
    });
});

describe('telemetry batching', () => {
    it('merges bumps in memory and writes them in one flush', async () => {
        process.env.TELEMETRY_SYNC = '0';
        const before = await db.sumTelemetry({ from: utcDay(), to: utcDay(), scopeType: 'org', scopeId: orgId, metric: METRICS.sdk_bootstrap });
        for (let n = 0; n < 5; n++) await bumpMetric(METRICS.sdk_bootstrap, { orgId, projectId });
        expect(pendingTelemetry()).toBe(3);
        await flushTelemetry();
        expect(pendingTelemetry()).toBe(0);
        expect(await db.sumTelemetry({ from: utcDay(), to: utcDay(), scopeType: 'org', scopeId: orgId, metric: METRICS.sdk_bootstrap })).toBe(before + 5);
        process.env.TELEMETRY_SYNC = '1';
    });
});

describe('batched track ingest', () => {
    it('accepts a batch, inserts valid events and dedupes conversions inside the batch', async () => {
        const { id, variations, goals } = await makeExperiment();
        const v = variations[1].id;
        const ev = (type: string, goal?: string) => ({ experiment_id: id, variation_id: v, user_id: 'batch_user', event_type: type, ...(goal ? { goal_id: goal } : {}) });
        const res = await track(new NextRequest(`http://localhost/api/track?key=${sdkKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain', origin: 'http://localhost' },
            body: JSON.stringify({ events: [ev('page_view'), ev('conversion', goals[0].id), ev('conversion', goals[0].id), { ...ev('page_view'), variation_id: 'var_nope' }] }),
        }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.accepted).toBe(2);
        expect(body.results.map((r: { status: number }) => r.status)).toEqual([201, 201, 200, 404]);
        const stats = await db.getEventStats(id, undefined, goals[0].id);
        expect(stats.find((s) => s.variation_id === v)).toMatchObject({ total_users: 1, conversions: 1 });
    });

    it('rejects oversized batches', async () => {
        const res = await track(new NextRequest(`http://localhost/api/track?key=${sdkKey}`, {
            method: 'POST', headers: { origin: 'http://localhost' },
            body: JSON.stringify({ events: Array.from({ length: 51 }, () => ({ experiment_id: 'exp_x', variation_id: 'var_x', user_id: 'u', event_type: 'page_view' })) }),
        }));
        expect(res.status).toBe(400);
    });
});
