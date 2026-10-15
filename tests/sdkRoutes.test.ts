import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain } from './helpers';

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => null) }));

import { db } from '@/lib/db';
import { generateId } from '@/lib/ids';
import { POST as assign, OPTIONS as assignOptions } from '@/app/api/assign/route';
import { POST as track } from '@/app/api/track/route';

let cleanup: () => void;
let sdkKey: string;
let secretKey: string;
let otherProjectKey: string;
let experimentId: string;
let otherExperimentId: string;

function req(path: string, body: unknown, key?: string, ip = '1.1.1.1') {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-forwarded-for': ip, Origin: 'http://localhost' };
    if (key) headers['X-API-Key'] = key;
    return new NextRequest(`http://localhost${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
}

async function makeExperiment(projectId: string, userId: string, status: 'draft' | 'running') {
    const id = generateId('exp');
    await db.createExperiment(
        { id, project_id: projectId, user_id: userId, name: 'E', status, traffic_allocation: 100 },
        [{ name: 'Control', weight: 50, is_control: true }, { name: 'B', weight: 50, is_control: false }],
    );
    return id;
}

beforeAll(async () => {
    cleanup = useTempDatabase();
    const u1 = await db.createUser({ email: 'one@example.com', name: 'One' });
    const ws1 = await db.ensureWorkspace(u1);
    await seedProjectDomain(ws1.projectId, 'localhost');
    const env1 = (await db.getEnvironments(ws1.projectId)).find((e) => e.key === 'dev')!;
    sdkKey = (await db.createApiKey({ environmentId: env1.id, type: 'sdk' })).key;
    secretKey = (await db.createApiKey({ environmentId: env1.id, type: 'secret' })).key;
    experimentId = await makeExperiment(ws1.projectId, u1.id, 'running');

    const u2 = await db.createUser({ email: 'two@example.com', name: 'Two' });
    const ws2 = await db.ensureWorkspace(u2);
    await seedProjectDomain(ws2.projectId, 'localhost');
    const env2 = (await db.getEnvironments(ws2.projectId)).find((e) => e.key === 'prod')!;
    otherProjectKey = (await db.createApiKey({ environmentId: env2.id, type: 'sdk' })).key;
    otherExperimentId = await makeExperiment(ws2.projectId, u2.id, 'running');
});
afterAll(() => cleanup());

describe('POST /api/assign', () => {
    it('rejects requests without a key', async () => {
        const res = await assign(req('/api/assign', { experiment_id: experimentId, user_id: 'v1' }));
        expect(res.status).toBe(401);
    });

    it('rejects secret keys', async () => {
        const res = await assign(req('/api/assign', { experiment_id: experimentId, user_id: 'v1' }, secretKey));
        expect(res.status).toBe(401);
    });

    it('rejects unknown keys', async () => {
        const res = await assign(req('/api/assign', { experiment_id: experimentId, user_id: 'v1' }, 'cro_pk_dev_' + 'Z'.repeat(32)));
        expect(res.status).toBe(401);
    });

    it('assigns with a valid key and is sticky', async () => {
        const first = await assign(req('/api/assign', { experiment_id: experimentId, user_id: 'v1' }, sdkKey));
        expect(first.status).toBe(200);
        expect(first.headers.get('access-control-allow-origin')).toBe('*');
        const a = await first.json();
        expect(a.assigned).toBe(true);
        const b = await (await assign(req('/api/assign', { experiment_id: experimentId, user_id: 'v1' }, sdkKey))).json();
        expect(b.variation_id).toBe(a.variation_id);
    });

    it('hides experiments from other projects', async () => {
        const res = await assign(req('/api/assign', { experiment_id: otherExperimentId, user_id: 'v1' }, sdkKey));
        expect(res.status).toBe(404);
        const ok = await assign(req('/api/assign', { experiment_id: otherExperimentId, user_id: 'v1' }, otherProjectKey));
        expect(ok.status).toBe(200);
    });

    it('validates input', async () => {
        const res = await assign(req('/api/assign', { experiment_id: experimentId }, sdkKey));
        expect(res.status).toBe(400);
    });

    it('answers CORS preflight', () => {
        const res = assignOptions();
        expect(res.status).toBe(204);
        expect(res.headers.get('access-control-allow-headers')).toContain('X-API-Key');
    });
});

describe('POST /api/track', () => {
    it('records events with a valid key', async () => {
        const a = await (await assign(req('/api/assign', { experiment_id: experimentId, user_id: 'v2' }, sdkKey))).json();
        const res = await track(req('/api/track', { experiment_id: experimentId, variation_id: a.variation_id, user_id: 'v2', event_type: 'conversion' }, sdkKey));
        expect(res.status).toBe(201);
        const stats = await db.getEventStats(experimentId);
        expect(stats.reduce((n, s) => n + Number(s.conversions), 0)).toBe(1);
    });

    it('rejects missing keys and cross-project writes', async () => {
        const vars = await db.getVariations(otherExperimentId);
        const body = { experiment_id: otherExperimentId, variation_id: vars[0].id, user_id: 'v3', event_type: 'page_view' };
        expect((await track(req('/api/track', body))).status).toBe(401);
        expect((await track(req('/api/track', body, sdkKey))).status).toBe(404);
    });

    it('rejects bad event types', async () => {
        const vars = await db.getVariations(experimentId);
        const res = await track(req('/api/track', { experiment_id: experimentId, variation_id: vars[0].id, user_id: 'v2', event_type: 'click' }, sdkKey));
        expect(res.status).toBe(400);
    });
});

describe('rate limiting', () => {
    it('returns 429 with Retry-After once the limit is hit', async () => {
        const { RateLimiter } = await import('@/lib/rateLimit');
        const { authenticateSdkRequest } = await import('@/lib/requestAuth');
        const limiter = new RateLimiter(2, 60_000);
        const make = () => req('/api/assign', {}, sdkKey, '9.9.9.9');
        expect('ctx' in (await authenticateSdkRequest(make(), limiter))).toBe(true);
        expect('ctx' in (await authenticateSdkRequest(make(), limiter))).toBe(true);
        const third = await authenticateSdkRequest(make(), limiter);
        expect('error' in third && third.error.status).toBe(429);
        expect('error' in third && third.error.headers.get('retry-after')).toBeTruthy();
    });
});
