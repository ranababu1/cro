import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { POST as create } from '@/app/api/experiments/route';
import { GET as getShare, POST as makeShare, DELETE as revokeShare } from '@/app/api/experiments/[id]/share/route';
import { buildExperimentResults } from '@/lib/results';
import { publicResultsView } from '@/lib/shareView';

let cleanup: () => void;
let ownerId: string;
let expId: string;
const p = () => ({ params: Promise.resolve({ id: expId }) });
const req = (method: string) => new NextRequest(`http://localhost/api/experiments/${expId}/share`, { method });

beforeAll(async () => {
    cleanup = useTempDatabase();
    const u = await db.createUser({ email: 'sh@example.com', name: 'Sh' });
    ownerId = u.id;
    const ws = await db.ensureWorkspace(u);
    await seedProjectDomain(ws.projectId, 'localhost');
    session.current = { user: { id: u.id } };
    const res = await create(new NextRequest('http://localhost/api/experiments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(flowExperimentBody()) }));
    expId = (await res.json()).experiment.id;
    await db.updateExperiment(expId, { status: 'running' });
});
afterAll(() => cleanup());

describe('share links', () => {
    it('creates one link, reuses it, resolves it and revokes it', async () => {
        expect((await (await getShare(req('GET'), p())).json()).url).toBeNull();
        const a = await (await makeShare(req('POST'), p())).json();
        expect(a.url).toMatch(/^https?:\/\/[^/]+\/share\/[A-Za-z0-9_-]{40,}$/);
        const b = await (await makeShare(req('POST'), p())).json();
        expect(b.url).toBe(a.url);
        const token = a.url.split('/share/')[1];
        expect((await db.getSharedExperiment(token))?.id).toBe(expId);
        expect(await db.getSharedExperiment('nope')).toBeNull();
        await revokeShare(req('DELETE'), p());
        expect(await db.getSharedExperiment(token)).toBeNull();
        const c = await (await makeShare(req('POST'), p())).json();
        expect(c.url).not.toBe(a.url);
    });

    it('other users cannot manage the link', async () => {
        session.current = { user: { id: (await db.createUser({ email: 'x@example.com', name: 'X' })).id } };
        expect((await makeShare(req('POST'), p())).status).toBe(404);
        session.current = null;
        expect((await getShare(req('GET'), p())).status).toBe(401);
        session.current = { user: { id: ownerId } };
    });

    it('stops working when the account is suspended', async () => {
        const url = (await (await makeShare(req('POST'), p())).json()).url as string;
        const token = url.split('/share/')[1];
        const org = (await db.getProjectsForUser(ownerId))[0].org_id;
        await db.updateOrganization(org, { status: 'suspended' });
        expect(await db.getSharedExperiment(token)).toBeNull();
        await db.updateOrganization(org, { status: 'active' });
        expect((await db.getSharedExperiment(token))?.id).toBe(expId);
    });

    it('public view shows names and numbers only', async () => {
        const exp = (await db.getExperiment(expId))!;
        const view = publicResultsView(await buildExperimentResults(exp));
        const text = JSON.stringify(view);
        expect(text).not.toMatch(/https?:\/\//);
        expect(text).not.toMatch(/#headerCTA/);
        expect(text).not.toContain(expId);
        expect(text).not.toMatch(/var_[a-z0-9]{6}/);
        expect(view.name).toBe('Homepage CTA');
        expect(view.headline.title).toBe('Collecting data');
        expect(view.goals[0].rows[0].control).toBe(true);
    });
});
