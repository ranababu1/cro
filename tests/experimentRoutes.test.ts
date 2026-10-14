import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { GET as list, POST as create } from '@/app/api/experiments/route';
import { GET as getOne, PATCH, DELETE } from '@/app/api/experiments/[id]/route';
import { GET as results } from '@/app/api/experiments/[id]/results/route';

let cleanup: () => void;
let alice: string;
let bob: string;
let aliceSecret: string;

const json = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
    new NextRequest(`http://localhost${url}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

const validBody = flowExperimentBody();

beforeAll(async () => {
    cleanup = useTempDatabase();
    const a = await db.createUser({ email: 'alice@example.com', name: 'Alice' });
    const b = await db.createUser({ email: 'bob@example.com', name: 'Bob' });
    const wsA = await db.ensureWorkspace(a);
    await db.ensureWorkspace(b);
    await seedProjectDomain(wsA.projectId, 'localhost');
    alice = a.id;
    bob = b.id;
    const env = (await db.getEnvironments(wsA.projectId))[0];
    aliceSecret = (await db.createApiKey({ environmentId: env.id, type: 'secret' })).key;
});
afterAll(() => cleanup());

describe('experiment API', () => {
    it('requires auth and ignores the old userId query bypass', async () => {
        session.current = null;
        expect((await list(json('GET', `/api/experiments?userId=${alice}`))).status).toBe(401);
    });

    it('creates, scopes, transitions and audits experiments', async () => {
        session.current = { user: { id: alice } };
        const res = await create(json('POST', '/api/experiments', validBody));
        expect(res.status).toBe(201);
        const { experiment } = await res.json();

        const mine = await (await list(json('GET', '/api/experiments'))).json();
        expect(mine.experiments).toHaveLength(1);

        // Bob cannot see or change Alice's experiment.
        session.current = { user: { id: bob } };
        expect((await (await list(json('GET', '/api/experiments'))).json()).experiments).toHaveLength(0);
        expect((await getOne(json('GET', `/api/experiments/${experiment.id}`), params(experiment.id))).status).toBe(404);
        expect((await PATCH(json('PATCH', `/api/experiments/${experiment.id}`, { status: 'running' }), params(experiment.id))).status).toBe(404);
        expect((await results(json('GET', `/api/experiments/${experiment.id}/results`), params(experiment.id))).status).toBe(404);

        session.current = { user: { id: alice } };
        const started = await PATCH(json('PATCH', `/api/experiments/${experiment.id}`, { status: 'running' }), params(experiment.id));
        expect(started.status).toBe(200);
        expect((await started.json()).experiment.started_at).toBeTruthy();
        expect((await PATCH(json('PATCH', `/api/experiments/${experiment.id}`, { status: 'draft' }), params(experiment.id))).status).toBe(400);
        expect((await DELETE(json('DELETE', `/api/experiments/${experiment.id}`), params(experiment.id))).status).toBe(400);

        const r = await results(json('GET', `/api/experiments/${experiment.id}/results?environment=prod`), params(experiment.id));
        expect(r.status).toBe(200);
        expect((await r.json()).variations).toHaveLength(2);

        const orgId = (await db.getProjectsForUser(alice))[0].org_id;
        const actions = (await db.getAuditLog(orgId)).map((l) => l.action);
        expect(actions).toEqual(expect.arrayContaining(['create', 'status:running']));
    });

    it('accepts blank optional fields from the form', async () => {
        session.current = { user: { id: alice } };
        const body = { ...validBody, name: 'Blank fields', description: '', variations: validBody.variations.map((v) => ({ ...v, description: '' })) };
        expect((await create(json('POST', '/api/experiments', body))).status).toBe(201);
    });

    it('rejects invalid bodies and unknown fields', async () => {
        session.current = { user: { id: alice } };
        expect((await create(json('POST', '/api/experiments', { name: 'x', variations: [] }))).status).toBe(400);
        expect((await create(json('POST', '/api/experiments', { ...validBody, variations: [{ ...validBody.variations[0], weight: 10 }, validBody.variations[1]] }))).status).toBe(400);
        const exp = (await (await list(json('GET', '/api/experiments'))).json()).experiments[0];
        expect((await PATCH(json('PATCH', `/api/experiments/${exp.id}`, { project_id: 'x' }), params(exp.id))).status).toBe(400);
    });

    it('accepts a secret key for reads', async () => {
        session.current = null;
        const res = await list(json('GET', '/api/experiments', undefined, { Authorization: `Bearer ${aliceSecret}` }));
        expect(res.status).toBe(200);
        expect((await res.json()).experiments).toHaveLength(2);
    });
});
