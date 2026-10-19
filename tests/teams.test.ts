import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { useTempDatabase } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email?: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { getDb } from '@/lib/db/client';
import { clearConfigCache } from '@/lib/configCache';
import { getOrgEntitlements } from '@/lib/entitlements';
import { hashInviteToken, inviteState } from '@/lib/team';
import { GET as getTeam } from '@/app/api/team/route';
import { POST as createInvite } from '@/app/api/team/invites/route';
import { DELETE as revokeInvite } from '@/app/api/team/invites/[id]/route';
import { PATCH as setRole, DELETE as removeMember } from '@/app/api/team/members/[userId]/route';
import { POST as createProject } from '@/app/api/projects/route';
import { PATCH as renameProject } from '@/app/api/projects/[id]/route';
import { POST as accept } from '@/app/api/invites/accept/route';

type U = { id: string; email: string; orgId: string; projectId: string };
const users: Record<string, U> = {};
const as = (u: U | null) => { session.current = u ? { user: { id: u.id, email: u.email } } : null; };
const req = (u: U, url: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) => new NextRequest(`http://localhost${url}`, {
    method, headers: { 'Content-Type': 'application/json', Cookie: `cro_project=${u.projectId}`, ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
});
const p = <T,>(v: T) => ({ params: Promise.resolve(v) });
const tokenOf = (url: string) => url.split('/invite/')[1];

async function person(name: string, plan?: string): Promise<U> {
    const u = await db.createUser({ email: `${name}@example.com`, name });
    const ws = await db.ensureWorkspace(u);
    if (plan) await db.updateOrganization(ws.orgId, { plan });
    return { id: u.id, email: u.email, ...ws };
}

describe('teams and projects', () => {
    let cleanup: () => void;
    beforeAll(async () => {
        cleanup = useTempDatabase();
        users.owner = await person('owner', 'starter');
        users.bob = await person('bob');
        users.carol = await person('carol');
        users.free = await person('freeowner');
        users.other = await person('otherowner', 'growth');
    });
    afterAll(() => { as(null); cleanup(); });

    it('free plans have 1 seat and 1 project, paid plans more', async () => {
        as(users.free);
        const r = await createInvite(req(users.free, '/api/team/invites', 'POST', {}));
        expect(r.status).toBe(403);
        expect((await r.json()).reason).toBe('seat_limit');
        const pr = await createProject(req(users.free, '/api/projects', 'POST', { name: 'Second' }));
        expect(pr.status).toBe(403);
        expect((await getOrgEntitlements(users.owner.orgId)).limits).toMatchObject({ seats: 5, projects: 3 });
    });

    it('an owner creates a single-use link; only its hash is stored', async () => {
        as(users.owner);
        const r = await createInvite(req(users.owner, '/api/team/invites', 'POST', { role: 'member' }));
        expect(r.status).toBe(201);
        const j = await r.json();
        expect(j.url).toMatch(/\/invite\/inv_[A-Za-z0-9_-]{32}$/);
        const rows = await (await getDb()).all<{ token_hash: string }>(sql`select token_hash from invites`);
        expect(rows[0].token_hash).toBe(hashInviteToken(tokenOf(j.url)));
        expect(JSON.stringify(rows)).not.toContain(tokenOf(j.url));
        users.bobLink = { ...users.owner, email: j.url } as U;
        const team = await (await getTeam(req(users.owner, '/api/team'))).json();
        expect(team.seats).toEqual({ used: 2, limit: 5 });
        expect(team.invites).toHaveLength(1);
    });

    it('the invited person joins once, and the link then stops working', async () => {
        const token = tokenOf(users.bobLink.email);
        as(null);
        expect((await accept(req(users.bob, '/api/invites/accept', 'POST', { token }))).status).toBe(401);
        as(users.bob);
        const r = await accept(req(users.bob, '/api/invites/accept', 'POST', { token }));
        expect(r.status).toBe(200);
        expect(r.cookies.get('cro_project')?.value).toBe(users.owner.projectId);
        expect((await db.getMembership(users.owner.orgId, users.bob.id))?.role).toBe('member');
        as(users.carol);
        const again = await accept(req(users.carol, '/api/invites/accept', 'POST', { token }));
        expect(again.status).toBe(410);
        expect(await db.getMembership(users.owner.orgId, users.carol.id)).toBeNull();
        // Bob now sees the owner's project as well as his own.
        expect((await db.getProjectsForUser(users.bob.id)).map((x) => x.id)).toEqual(expect.arrayContaining([users.owner.projectId, users.bob.projectId]));
    });

    it('members cannot invite, change roles or add projects, but can see the team', async () => {
        const bobInOwnerOrg = { ...users.bob, projectId: users.owner.projectId };
        as(users.bob);
        expect((await createInvite(req(bobInOwnerOrg, '/api/team/invites', 'POST', {}))).status).toBe(403);
        expect((await setRole(req(bobInOwnerOrg, `/api/team/members/${users.owner.id}`, 'PATCH', { role: 'member' }), p({ userId: users.owner.id }))).status).toBe(403);
        expect((await createProject(req(bobInOwnerOrg, '/api/projects', 'POST', { name: 'Mine' }))).status).toBe(403);
        expect((await removeMember(req(bobInOwnerOrg, `/api/team/members/${users.owner.id}`, 'DELETE'), p({ userId: users.owner.id }))).status).toBe(403);
        const team = await (await getTeam(req(bobInOwnerOrg, '/api/team'))).json();
        expect(team.role).toBe('member');
        expect(team.members.map((m: { email: string }) => m.email)).toEqual(['owner@example.com', 'bob@example.com']);
    });

    it('keeps one owner, and promoted owners can manage the team', async () => {
        as(users.owner);
        const demote = await setRole(req(users.owner, `/api/team/members/${users.owner.id}`, 'PATCH', { role: 'member' }), p({ userId: users.owner.id }));
        expect(demote.status).toBe(400);
        expect((await removeMember(req(users.owner, `/api/team/members/${users.owner.id}`, 'DELETE'), p({ userId: users.owner.id }))).status).toBe(400);
        expect((await setRole(req(users.owner, `/api/team/members/${users.bob.id}`, 'PATCH', { role: 'owner' }), p({ userId: users.bob.id }))).status).toBe(200);
        expect((await setRole(req(users.owner, `/api/team/members/${users.owner.id}`, 'PATCH', { role: 'member' }), p({ userId: users.owner.id }))).status).toBe(200);
        as(users.bob);
        const bobInOwnerOrg = { ...users.bob, projectId: users.owner.projectId };
        expect((await setRole(req(bobInOwnerOrg, `/api/team/members/${users.owner.id}`, 'PATCH', { role: 'owner' }), p({ userId: users.owner.id }))).status).toBe(200);
    });

    it('cancelled and expired invites do not work', async () => {
        as(users.owner);
        const j = await (await createInvite(req(users.owner, '/api/team/invites', 'POST', {}))).json();
        expect((await revokeInvite(req(users.owner, `/api/team/invites/${j.invite.id}`, 'DELETE'), p({ id: j.invite.id }))).status).toBe(200);
        as(users.carol);
        expect((await accept(req(users.carol, '/api/invites/accept', 'POST', { token: tokenOf(j.url) }))).status).toBe(410);
        expect(inviteState({ accepted_at: null, revoked_at: null, expires_at: '2020-01-01T00:00:00.000Z' })).toBe('expired');
        expect(inviteState(null)).toBe('unknown');
    });

    it('another organization cannot cancel invites or rename projects it does not own', async () => {
        as(users.owner);
        const j = await (await createInvite(req(users.owner, '/api/team/invites', 'POST', {}))).json();
        as(users.other);
        expect((await revokeInvite(req(users.other, `/api/team/invites/${j.invite.id}`, 'DELETE'), p({ id: j.invite.id }))).status).toBe(404);
        expect((await renameProject(req(users.other, `/api/projects/${users.owner.projectId}`, 'PATCH', { name: 'Hijack' }), p({ id: users.owner.projectId }))).status).toBe(404);
        expect((await db.getProject(users.owner.projectId))!.name).toBe('Default project');
    });

    it('secret keys cannot manage the team', async () => {
        const env = (await db.getEnvironments(users.owner.projectId)).find((e) => e.key === 'prod')!;
        const { key } = await db.createApiKey({ environmentId: env.id, type: 'secret' });
        as(null);
        const r = await createInvite(req(users.owner, '/api/team/invites', 'POST', {}, { Authorization: `Bearer ${key}` }));
        expect(r.status).toBe(403);
    });

    it('stops at the seat limit, counting open invites', async () => {
        as(users.owner);
        // owner, bob and one open invite so far; Starter has 5 seats.
        const codes = [];
        for (let i = 0; i < 4; i++) codes.push((await createInvite(req(users.owner, '/api/team/invites', 'POST', {}))).status);
        expect(codes).toEqual([201, 201, 403, 403]);
    });

    it('owners add and rename projects up to the plan limit, each with its own keys', async () => {
        as(users.owner);
        const r = await createProject(req(users.owner, '/api/projects', 'POST', { name: 'Shop' }));
        expect(r.status).toBe(201);
        const { project } = await r.json();
        const envs = await db.getEnvironments(project.id);
        expect(envs.map((e) => e.key).sort()).toEqual(['dev', 'prod', 'staging']);
        const keys = await db.listApiKeys(project.id);
        const defaults = (await db.listApiKeys(users.free.projectId)).filter((k) => k.type === 'sdk').length;
        expect(defaults).toBeGreaterThan(0);
        expect(keys.filter((k) => k.type === 'sdk')).toHaveLength(defaults);
        expect((await createProject(req(users.owner, '/api/projects', 'POST', { name: 'shop' }))).status).toBe(400);
        expect((await createProject(req(users.owner, '/api/projects', 'POST', { name: 'Blog' }))).status).toBe(201);
        const over = await createProject(req(users.owner, '/api/projects', 'POST', { name: 'Fourth' }));
        expect(over.status).toBe(403);
        expect((await over.json()).reason).toBe('project_limit');
        expect((await renameProject(req(users.owner, `/api/projects/${project.id}`, 'PATCH', { name: 'Store' }), p({ id: project.id }))).status).toBe(200);
        // Bob is a member of the org, so he sees the new projects straight away.
        expect((await db.getProjectsForUser(users.bob.id)).map((x) => x.name)).toEqual(expect.arrayContaining(['Store', 'Blog']));
    });

    it('a removed member loses access at once, and every step is in the audit log', async () => {
        as(users.owner);
        expect((await removeMember(req(users.owner, `/api/team/members/${users.bob.id}`, 'DELETE'), p({ userId: users.bob.id }))).status).toBe(200);
        expect((await db.getProjectsForUser(users.bob.id)).map((x) => x.org_id)).not.toContain(users.owner.orgId);
        const actions = (await (await getDb()).all<{ entity: string; action: string }>(sql`select entity, action from audit_log where org_id = ${users.owner.orgId} and entity in ('member', 'project')`)).map((r) => `${r.entity}:${r.action}`);
        expect(actions).toEqual(expect.arrayContaining(['member:invite:create', 'member:join', 'member:role', 'member:invite:revoke', 'member:remove', 'project:create', 'project:rename']));
        const raw = JSON.stringify(await (await getDb()).all(sql`select diff from audit_log`));
        expect(raw).not.toMatch(/inv_[A-Za-z0-9_-]{32}/);
    });

    it('a platform admin added as a member does not lift the plan limits; as an owner it does', async () => {
        process.env.PLATFORM_ADMIN_EMAILS = 'staff@freeabtest.com';
        const staff = await db.createUser({ email: 'staff@freeabtest.com', name: 'Staff' });
        await db.addMember(users.free.orgId, staff.id, 'member');
        clearConfigCache();
        expect((await getOrgEntitlements(users.free.orgId)).limits.seats).toBe(1);
        await db.setMemberRole(users.free.orgId, staff.id, 'owner');
        clearConfigCache();
        expect((await getOrgEntitlements(users.free.orgId)).limits.seats).toBeNull();
        delete process.env.PLATFORM_ADMIN_EMAILS;
    });
});
