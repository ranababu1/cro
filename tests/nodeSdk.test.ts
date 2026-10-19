import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain } from './helpers';

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => null) }));

import { sql } from 'drizzle-orm';
import { db, getDb } from '@/lib/db';
import { generateId } from '@/lib/ids';
import { assignUserToVariation, hashUserToVariation as appHash } from '@/lib/assignment';
import { serverExperiment } from '@/lib/sdkFlows';
import type { Experiment, Variation } from '@/lib/types';
import { POST as serverAssign } from '@/app/api/server/assign/route';
import { POST as serverTrack } from '@/app/api/server/track/route';
import { GET as serverConfigRoute } from '@/app/api/server/config/route';
import { POST as browserAssign } from '@/app/api/assign/route';
// The package is plain ESM JavaScript so it runs without a build step.
import { FreeABTest, FreeABTestError, hashUserToVariation, pickVariation } from '../integrations/node/index.js';

let cleanup: () => void;
let secretKey: string;
let sdkKey: string;
let otherSecret: string;
let experimentId: string;
let goalId: string;
let projectId: string;

const routes: Record<string, (r: NextRequest) => Promise<Response>> = {
    'POST /api/server/assign': serverAssign,
    'POST /api/server/track': serverTrack,
    'GET /api/server/config': serverConfigRoute,
};
const calls: Array<{ method: string; path: string; body: unknown }> = [];

/** fetch that hands requests to the route handlers, like a server would. */
const routeFetch = (async (url: string, init: RequestInit) => {
    const u = new URL(url);
    const method = init.method ?? 'GET';
    calls.push({ method, path: u.pathname, body: init.body ? JSON.parse(String(init.body)) : null });
    const handler = routes[`${method} ${u.pathname}`];
    if (!handler) return new Response('{"error":"not found"}', { status: 404 });
    return handler(new NextRequest(url, { method, headers: init.headers as Record<string, string>, body: init.body as string | undefined }));
}) as unknown as typeof fetch;

const client = (key = secretKey) => new FreeABTest({ secretKey: key, apiUrl: 'http://localhost', fetch: routeFetch, flushIntervalMs: 0 });

beforeAll(async () => {
    cleanup = useTempDatabase();
    const u = await db.createUser({ email: 'node@example.com', name: 'Node' });
    const ws = await db.ensureWorkspace(u);
    projectId = ws.projectId;
    await seedProjectDomain(ws.projectId, 'localhost');
    const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'prod')!;
    secretKey = (await db.createApiKey({ environmentId: env.id, type: 'secret' })).key;
    sdkKey = (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key;
    experimentId = generateId('exp');
    await db.createExperiment(
        { id: experimentId, project_id: ws.projectId, user_id: u.id, name: 'Checkout copy', status: 'running', traffic_allocation: 100 },
        [{ name: 'Control', weight: 50, is_control: true }, { name: 'B', weight: 50, is_control: false }],
    );
    goalId = (await db.addGoal(experimentId, { name: 'Order', selector: 'order', type: 'event', is_primary: true, match_type: null })).id;

    const u2 = await db.createUser({ email: 'node2@example.com', name: 'Other' });
    const ws2 = await db.ensureWorkspace(u2);
    const env2 = (await db.getEnvironments(ws2.projectId)).find((e) => e.key === 'prod')!;
    otherSecret = (await db.createApiKey({ environmentId: env2.id, type: 'secret' })).key;
});
afterAll(() => cleanup());

describe('hashing parity', () => {
    it('matches the app hash and assignment for many visitors', () => {
        const variations = [
            { id: 'v1', name: 'A', weight: 34, paused: false },
            { id: 'v2', name: 'B', weight: 33, paused: false },
            { id: 'v3', name: 'C', weight: 33, paused: false },
        ];
        for (let i = 0; i < 2000; i++) {
            const user = `user-${i}`;
            expect(hashUserToVariation(user, 'exp_x')).toBe(appHash(user, 'exp_x'));
            const app = assignUserToVariation(user, 'exp_x', 70, variations as unknown as Variation[]);
            const local = pickVariation(user, { id: 'exp_x', traffic_allocation: 70, variations: variations.map((v) => ({ ...v, url: null, is_control: v.id === 'v1' })) });
            expect(local?.id ?? null).toBe(app?.id ?? null);
        }
    });
    it('skips paused and zero-weight variations like the server', () => {
        const vs = [
            { id: 'a', name: 'A', url: null, weight: 50, is_control: true, paused: true },
            { id: 'b', name: 'B', url: null, weight: 50, is_control: false, paused: false },
            { id: 'c', name: 'C', url: null, weight: 0, is_control: false, paused: false },
        ];
        for (let i = 0; i < 50; i++) expect(pickVariation(`u${i}`, { id: 'e', traffic_allocation: 100, variations: vs })?.id).toBe('b');
        expect(pickVariation('u1', { id: 'e', traffic_allocation: 0, variations: vs })).toBeNull();
    });
});

describe('server endpoints', () => {
    const call = (handler: (r: NextRequest) => Promise<Response>, p: string, key: string | null, body?: unknown, extra: Record<string, string> = {}) =>
        handler(new NextRequest(`http://localhost${p}`, {
            method: body === undefined ? 'GET' : 'POST',
            headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}), ...extra },
            body: body === undefined ? undefined : JSON.stringify(body),
        }));

    it('need a secret key and no Origin', async () => {
        expect((await call(serverConfigRoute, '/api/server/config', null)).status).toBe(401);
        expect((await call(serverConfigRoute, '/api/server/config', sdkKey)).status).toBe(401);
        expect((await call(serverAssign, '/api/server/assign', 'Bearer junk', { experiment_id: experimentId, user_id: 'x' })).status).toBe(401);
        const ok = await call(serverAssign, '/api/server/assign', secretKey, { experiment_id: experimentId, user_id: 'srv-1' });
        expect(ok.status).toBe(200);
        expect(ok.headers.get('access-control-allow-origin')).toBeNull();
    });
    it('the browser endpoint still refuses secret keys', async () => {
        const res = await browserAssign(new NextRequest('http://localhost/api/assign', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': secretKey, Origin: 'http://localhost' }, body: JSON.stringify({ experiment_id: experimentId, user_id: 'x' }) }));
        expect(res.status).toBe(401);
    });
    it('keeps projects apart', async () => {
        expect((await call(serverAssign, '/api/server/assign', otherSecret, { experiment_id: experimentId, user_id: 'x' })).status).toBe(404);
        const cfg = await (await call(serverConfigRoute, '/api/server/config', otherSecret)).json();
        expect(cfg.experiments).toEqual([]);
    });
    it('config lists running tests with variations and goals', async () => {
        const cfg = await (await call(serverConfigRoute, '/api/server/config', secretKey)).json();
        expect(cfg.ttl_seconds).toBe(60);
        const e = cfg.experiments.find((x: { id: string }) => x.id === experimentId);
        expect(e.traffic_allocation).toBe(100);
        expect(e.variations).toHaveLength(2);
        expect(e.goals[0]).toMatchObject({ id: goalId, type: 'event', selector: 'order' });
    });
});

describe('FreeABTest client', () => {
    it('rejects public keys up front', () => {
        expect(() => new FreeABTest({ secretKey: 'cro_pk_prod_x', fetch: routeFetch })).toThrow(FreeABTestError);
    });

    it('getVariation is sticky and stores the assignment', async () => {
        const ab = client();
        const a = await ab.getVariation(experimentId, 'visitor-1');
        const b = await ab.getVariation(experimentId, 'visitor-1');
        expect(a.assigned).toBe(true);
        expect(b.variationId).toBe(a.variationId);
        expect((await db.getAssignment(experimentId, 'visitor-1'))?.variation_id).toBe(a.variationId);
        await ab.close();
    });

    it('decide hashes locally, matches the server, and the first exposure stores the assignment', async () => {
        const ab = client();
        calls.length = 0;
        const local = await ab.decide(experimentId, 'visitor-2');
        await ab.decide(experimentId, 'visitor-2');
        expect(calls.filter((c) => c.path === '/api/server/config')).toHaveLength(1);
        expect(calls.some((c) => c.path === '/api/server/assign')).toBe(false);
        await ab.flush();
        const tracked = calls.filter((c) => c.path === '/api/server/track');
        expect(tracked).toHaveLength(1);
        expect((tracked[0].body as { events: unknown[] }).events).toHaveLength(1);
        expect((await db.getAssignment(experimentId, 'visitor-2'))?.variation_id).toBe(local.variationId);
        // The server agrees with the local pick.
        const server = await client().getVariation(experimentId, 'visitor-2', { track: false });
        expect(server.variationId).toBe(local.variationId);
        await ab.close();
    });

    it('tracks conversions once per goal and remembers the variation', async () => {
        const ab = client();
        const d = await ab.decide(experimentId, 'visitor-3');
        expect(await ab.trackConversion(experimentId, 'visitor-3', { goalId })).toBe(true);
        expect(await ab.trackConversion(experimentId, 'visitor-3', { goalId })).toBe(true);
        await ab.flush();
        const d2 = await getDb();
        const mine = (await d2.all(sql`select event_type, variation_id from events where experiment_id = ${experimentId} and user_id = 'visitor-3'`)) as Array<{ event_type: string; variation_id: string }>;
        expect(mine.filter((e) => e.event_type === 'conversion')).toHaveLength(1);
        expect(mine.filter((e) => e.event_type === 'page_view')).toHaveLength(1);
        expect(mine.every((e) => e.variation_id === d.variationId)).toBe(true);
        // A fresh process falls back to the local hash.
        const fresh = client();
        calls.length = 0;
        await fresh.trackConversion(experimentId, 'visitor-3', { eventName: 'order' });
        await fresh.flush();
        const sent = calls.find((c) => c.path === '/api/server/track')!.body as { events: Array<{ variation_id: string; event_type: string }> };
        expect(sent.events[0]).toMatchObject({ variation_id: d.variationId, event_type: 'conversion' });
        await ab.close();
        await fresh.close();
    });

    it('does not count an exposure for a variation other than the stored one', async () => {
        const assigned = await client().getVariation(experimentId, 'visitor-4', { track: false });
        const vars = await db.getVariations(experimentId);
        const other = vars.find((v) => v.id !== assigned.variationId)!;
        const res = await serverTrack(new NextRequest('http://localhost/api/server/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secretKey}` },
            body: JSON.stringify({ experiment_id: experimentId, variation_id: other.id, user_id: 'visitor-4', event_type: 'page_view' }),
        }));
        expect(res.status).toBe(409);
    });

    it('batches up to 50 events per request and every exposure stores an assignment', async () => {
        const ab = new FreeABTest({ secretKey, apiUrl: 'http://localhost', fetch: routeFetch, flushIntervalMs: 0, flushAt: 50 });
        const v = (await db.getVariations(experimentId))[0].id;
        calls.length = 0;
        for (let i = 0; i < 120; i++) ab.trackExposure(experimentId, v, `bulk-${i}`);
        ab.trackExposure(experimentId, v, 'bulk-0');
        await ab.flush();
        const sizes = calls.filter((c) => c.path === '/api/server/track').map((c) => (c.body as { events: unknown[] }).events.length);
        expect(sizes).toEqual([50, 50, 20]);
        const d = await getDb();
        const rows = (await d.all(sql`select count(*) as n from assignments where experiment_id = ${experimentId} and user_id like 'bulk-%'`)) as Array<{ n: number }>;
        expect(Number(rows[0].n)).toBe(120);
        await ab.close();
    });

    it('returns not assigned for unknown tests and validates user ids', async () => {
        const ab = client();
        expect(await ab.decide('exp_missing', 'v')).toMatchObject({ assigned: false, reason: 'not_running' });
        await expect(ab.decide(experimentId, 'has space')).rejects.toThrow(FreeABTestError);
        await expect(client(otherSecret).getVariation(experimentId, 'v')).rejects.toMatchObject({ status: 404 });
    });

    it('reports a rolled-out winner without counting', () => {
        const exp = { id: 'e', name: 'n', status: 'completed', traffic_allocation: 100, rollout_variation_id: 'b' } as unknown as Experiment;
        const vs = [{ id: 'a', name: 'A', url: null, weight: 50, is_control: true, paused: false }, { id: 'b', name: 'B', url: '/b', weight: 50, is_control: false, paused: false }] as unknown as Variation[];
        expect(serverExperiment(exp, vs, [])).toMatchObject({ traffic_allocation: 0, rollout_variation_id: 'b' });
    });
});

describe('package', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../integrations/node/package.json'), 'utf8'));
    it('is private so it cannot be published by accident', () => {
        expect(pkg.private).toBe(true);
        expect(pkg.dependencies).toBeUndefined();
    });
    it('keeps the same hash as the app', () => {
        const src = fs.readFileSync(path.join(__dirname, '../integrations/node/index.js'), 'utf8');
        expect(src).toContain("createHash('sha256').update(`${experimentId}:${userId}`)");
        expect(projectId).toBeTruthy();
    });
});
