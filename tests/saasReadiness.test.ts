import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { createClient } from '@libsql/client';
import { useTempDatabase } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { generateId } from '@/lib/ids';
import { getDb } from '@/lib/db/client';
import { sql } from 'drizzle-orm';
import { authOptions, pickVerifiedGithubEmail } from '@/lib/auth';
import { LEGAL_VERSION } from '@/lib/legal';
import { deleteAccount, deleteProject, eraseVisitor, exportAccount, planAccountDeletion } from '@/lib/dataRights';
import { addReply, createTicket, getTicket, MAX_OPEN_TICKETS } from '@/lib/support';
import { notifyOps, reportError, resetAlertThrottle } from '@/lib/alerts';
import { RateLimiter, SharedRateLimiter, sharedStoreConfig } from '@/lib/rateLimit';
import { GET as health } from '@/app/api/health/route';
import { GET as securityTxt } from '@/app/.well-known/security.txt/route';
import robots from '@/app/robots';
import { DELETE as deleteAccountRoute, GET as accountPlanRoute } from '@/app/api/account/route';
import { GET as exportRoute } from '@/app/api/account/export/route';
import { DELETE as eraseRoute } from '@/app/api/privacy/visitors/route';
import { DELETE as deleteProjectRoute } from '@/app/api/projects/[id]/route';
import { GET as listTickets, POST as openTicket } from '@/app/api/support/tickets/route';
import { GET as getTicketRoute, POST as replyTicket } from '@/app/api/support/tickets/[id]/route';
import { POST as adminReply } from '@/app/api/admin/support/[id]/route';
import { backup } from '../scripts/backup-db.mjs';
import { restore } from '../scripts/restore-db.mjs';

const json = (url: string, method: string, body?: unknown, cookie?: string) => new NextRequest(`http://localhost${url}`, {
    method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body),
});
const as = (u: { id: string; email: string } | null) => { session.current = u ? { user: u } : null; };

async function makeUser(email: string) {
    const u = await db.createUser({ email, name: email.split('@')[0] });
    const ws = await db.ensureWorkspace(u);
    return { ...u, ...ws };
}
async function makeExperiment(projectId: string, userId: string) {
    const id = generateId('exp');
    await db.createExperiment({ id, project_id: projectId, user_id: userId, name: 'E', status: 'running', traffic_allocation: 100 },
        [{ name: 'Control', weight: 50, is_control: true }, { name: 'B', weight: 50, is_control: false }]);
    return id;
}

let cleanup: () => void;
beforeAll(() => { cleanup = useTempDatabase(); });
afterAll(() => cleanup());
beforeEach(() => as(null));

describe('legal pages', () => {
    it('exist, are linked from the footer and sign-in, and are in the sitemap', () => {
        for (const f of ['app/legal/terms/page.tsx', 'app/legal/privacy/page.tsx', 'app/legal/dpa/page.tsx', 'app/legal/cookies/page.tsx', 'app/security/page.tsx']) expect(fs.existsSync(f), f).toBe(true);
        const footer = fs.readFileSync('app/components/landing/SiteChrome.tsx', 'utf8');
        for (const href of ['/legal/terms', '/legal/privacy', '/security']) expect(footer).toContain(href);
        const signin = fs.readFileSync('app/signin/page.tsx', 'utf8');
        expect(signin).toContain('/legal/terms');
        expect(signin).toContain('/legal/privacy');
        expect(fs.readFileSync('app/sitemap.ts', 'utf8')).toContain('/legal/privacy');
    });
    it('the cookie page lists every key the SDK stores', () => {
        const page = fs.readFileSync('app/legal/cookies/page.tsx', 'utf8');
        const sdk = fs.readFileSync('sdk-src/sdk.js', 'utf8');
        const keys = new Set([...sdk.matchAll(/(?:local|session)Storage\.setItem\('([a-z_]+)'/g)].map((m) => m[1]));
        expect(keys.size).toBeGreaterThan(3);
        for (const k of keys) expect(page, k).toContain(k);
    });
    it('new sign-ups record the terms version they accepted', async () => {
        const signIn = authOptions.callbacks!.signIn!;
        await signIn({ user: { id: 'x', email: 'terms@example.com', name: 'T' }, account: null, profile: { email_verified: true } as never } as never);
        const u = await db.getUserByEmail('terms@example.com');
        expect(u?.terms_version).toBe(LEGAL_VERSION);
        expect(u?.terms_accepted_at).toBeTruthy();
    });
    it('refuses an unverified email from the provider', async () => {
        const r = await authOptions.callbacks!.signIn!({ user: { id: 'y', email: 'unverified@example.com', name: 'U' }, account: null, profile: { email_verified: false } as never } as never);
        expect(r).toBe(false);
        expect(await db.getUserByEmail('unverified@example.com')).toBeNull();
    });
});

describe('GitHub sign-in', () => {
    it('uses only a verified address, preferring the primary one', () => {
        expect(pickVerifiedGithubEmail([{ email: 'a@x.co', primary: true, verified: false }, { email: 'b@x.co', primary: false, verified: true }])).toBe('b@x.co');
        expect(pickVerifiedGithubEmail([{ email: 'a@x.co', primary: true, verified: true }, { email: 'b@x.co', primary: false, verified: true }])).toBe('a@x.co');
        expect(pickVerifiedGithubEmail([{ email: 'a@x.co', primary: true, verified: false }])).toBeNull();
        expect(pickVerifiedGithubEmail({ message: 'Bad credentials' })).toBeNull();
    });
    it('is offered only when its keys are set', async () => {
        expect(authOptions.providers.map((p) => p.id)).toEqual(['google']);
    });
});

describe('data rights', () => {
    it('deleting a solo account deletes its organization and everything in it', async () => {
        const a = await makeUser('solo@example.com');
        const exp = await makeExperiment(a.projectId, a.id);
        expect(await planAccountDeletion(a.id)).toMatchObject({ ok: true, deleteOrgs: [a.orgId], keepOrgs: [] });
        expect((await deleteAccount(a.id)).ok).toBe(true);
        expect(await db.getUser(a.id)).toBeNull();
        expect(await db.getOrganization(a.orgId)).toBeFalsy();
        expect(await db.getExperiment(exp)).toBeNull();
    });
    it('a member leaves a shared organization, and their tests move to an owner', async () => {
        const owner = await makeUser('owner1@example.com');
        const member = await makeUser('member1@example.com');
        await db.addMember(owner.orgId, member.id, 'member');
        const exp = await makeExperiment(owner.projectId, member.id);
        const r = await deleteAccount(member.id);
        expect(r).toMatchObject({ ok: true, deletedOrgs: 1 }); // the member's own solo workspace
        expect(await db.getOrganization(owner.orgId)).toBeTruthy();
        expect((await db.getExperiment(exp))?.user_id).toBe(owner.id);
    });
    it('the last owner of a shared organization must hand it over first', async () => {
        const owner = await makeUser('owner2@example.com');
        const member = await makeUser('member2@example.com');
        await db.addMember(owner.orgId, member.id, 'member');
        const r = await deleteAccount(owner.id);
        expect(r.ok).toBe(false);
        expect(await db.getUser(owner.id)).toBeTruthy();
    });
    it('the account route needs the email typed in, and works from a session only', async () => {
        const u = await makeUser('route@example.com');
        as({ id: u.id, email: u.email });
        expect((await (await accountPlanRoute(json('/api/account', 'GET'))).json()).can_delete).toBe(true);
        expect((await deleteAccountRoute(json('/api/account', 'DELETE', { confirm: 'wrong@example.com' }))).status).toBe(400);
        expect((await deleteAccountRoute(json('/api/account', 'DELETE', { confirm: 'ROUTE@example.com' }))).status).toBe(200);
        expect(await db.getUser(u.id)).toBeNull();
    });
    it('export holds the profile without the IP hash, and the organizations', async () => {
        const u = await makeUser('export@example.com');
        await db.setUserSignupIpHash(u.id, 'abc123');
        await makeExperiment(u.projectId, u.id);
        const data = await exportAccount(u.id);
        expect(data!.profile.email).toBe('export@example.com');
        expect(JSON.stringify(data)).not.toContain('abc123');
        expect(data!.organizations[0].experiments).toHaveLength(1);
        as({ id: u.id, email: u.email });
        const res = await exportRoute(json('/api/account/export', 'GET'));
        expect(res.headers.get('content-disposition')).toMatch(/attachment/);
    });
    it('a project can be deleted unless it is the last one, by owners only, with its name typed in', async () => {
        const u = await makeUser('proj@example.com');
        expect(await deleteProject(u.orgId, u.projectId)).toMatchObject({ ok: false, status: 400 });
        const second = await db.createProject(u.orgId, 'Second', u.id);
        const exp = await makeExperiment(second.id, u.id);
        as({ id: u.id, email: u.email });
        expect((await deleteProjectRoute(json(`/api/projects/${second.id}`, 'DELETE', { confirm: 'nope' }), { params: Promise.resolve({ id: second.id }) })).status).toBe(400);
        expect((await deleteProjectRoute(json(`/api/projects/${second.id}`, 'DELETE', { confirm: 'Second' }), { params: Promise.resolve({ id: second.id }) })).status).toBe(200);
        expect(await db.getProject(second.id)).toBeFalsy();
        expect(await db.getExperiment(exp)).toBeNull();
    });
    it('erasing a visitor removes their assignments and events in that project only', async () => {
        const u = await makeUser('erase@example.com');
        const other = await makeUser('erase-other@example.com');
        const exp = await makeExperiment(u.projectId, u.id);
        const otherExp = await makeExperiment(other.projectId, other.id);
        for (const e of [exp, otherExp]) {
            const v = (await db.getVariations(e))[0];
            await db.createAssignment({ experiment_id: e, variation_id: v.id, user_id: 'visitor_1' });
            await db.createEvent({ experiment_id: e, variation_id: v.id, user_id: 'visitor_1', environment_id: null, event_type: 'page_view', event_name: null, goal_id: null, metadata: null });
        }
        as({ id: u.id, email: u.email });
        const res = await eraseRoute(json('/api/privacy/visitors', 'DELETE', { visitor_id: 'visitor_1' }, `cro_project=${u.projectId}`));
        expect(await res.json()).toMatchObject({ erased: true, assignments: 1, events: 1 });
        expect(await db.getAssignment(exp, 'visitor_1')).toBeNull();
        expect(await db.getAssignment(otherExp, 'visitor_1')).toBeTruthy();
        expect(await eraseVisitor(u.orgId, u.projectId, 'visitor_1')).toEqual({ assignments: 0, events: 0 });
        // The audit log keeps a hash, never the id.
        const audit = await db.getAuditLog(u.orgId, 5);
        expect(JSON.stringify(audit)).not.toContain('visitor_1');
    });
    it('members cannot erase visitors', async () => {
        const owner = await makeUser('owner3@example.com');
        const member = await makeUser('member3@example.com');
        await db.addMember(owner.orgId, member.id, 'member');
        as({ id: member.id, email: member.email });
        expect((await eraseRoute(json('/api/privacy/visitors', 'DELETE', { visitor_id: 'v' }, `cro_project=${owner.projectId}`))).status).toBe(403);
    });
});

describe('support tickets', () => {
    it('opens a ticket, shows it to the organization only, and moves status with replies', async () => {
        const u = await makeUser('help@example.com');
        const stranger = await makeUser('stranger@example.com');
        as({ id: u.id, email: u.email });
        const res = await openTicket(json('/api/support/tickets', 'POST', { subject: 'Results look off', category: 'bug', body: 'The B version shows zero visitors.' }));
        expect(res.status).toBe(201);
        const { id } = await res.json();
        expect((await (await listTickets(json('/api/support/tickets', 'GET'))).json()).tickets).toHaveLength(1);

        as({ id: stranger.id, email: stranger.email });
        expect((await getTicketRoute(json(`/api/support/tickets/${id}`, 'GET'), { params: Promise.resolve({ id }) })).status).toBe(404);
        // Not a platform admin: the admin route answers 404.
        expect((await adminReply(json(`/api/admin/support/${id}`, 'POST', { body: 'hi' }), { params: Promise.resolve({ id }) })).status).toBe(404);

        expect(await addReply({ ticketId: id, authorId: null, fromStaff: true, body: 'Looking into it' })).toBe('waiting');
        as({ id: u.id, email: u.email });
        expect((await (await replyTicket(json(`/api/support/tickets/${id}`, 'POST', { body: 'Thanks' }), { params: Promise.resolve({ id }) })).json()).status).toBe('open');
        expect((await replyTicket(json(`/api/support/tickets/${id}`, 'POST', { body: 'x', status: 'waiting' }), { params: Promise.resolve({ id }) })).status).toBe(400);
        await replyTicket(json(`/api/support/tickets/${id}`, 'POST', { body: 'Solved', status: 'closed' }), { params: Promise.resolve({ id }) });
        const t = await getTicket(id);
        expect(t!.ticket.status).toBe('closed');
        expect(t!.messages).toHaveLength(4);
    });
    it('caps open tickets per organization and validates input', async () => {
        const u = await makeUser('flood@example.com');
        for (let i = 0; i < MAX_OPEN_TICKETS; i++) expect('id' in await createTicket({ orgId: u.orgId, userId: u.id, subject: `T${i}`, category: 'question', body: 'Something to say here' })).toBe(true);
        expect('error' in await createTicket({ orgId: u.orgId, userId: u.id, subject: 'One more', category: 'question', body: 'Something to say here' })).toBe(true);
        as({ id: u.id, email: u.email });
        expect((await openTicket(json('/api/support/tickets', 'POST', { subject: 'x', body: 'short' }))).status).toBe(400);
    });
});

describe('operations alerts', () => {
    beforeEach(() => resetAlertThrottle());
    const env = { OPS_ALERT_WEBHOOK_URL: 'https://hooks.example.com/x' };
    it('sends nothing without the webhook, and throttles repeats', async () => {
        const fetcher = vi.fn(async () => ({}));
        expect(await notifyOps('a', {}, { fetcher, env: {} })).toBe(false);
        expect(await notifyOps('boom', { route: '/x' }, { fetcher, env, now: 0 })).toBe(true);
        expect(await notifyOps('boom', {}, { fetcher, env, now: 30_000 })).toBe(false);
        expect(await notifyOps('boom', {}, { fetcher, env, now: 61_000 })).toBe(true);
        expect(fetcher).toHaveBeenCalledTimes(2);
        const body = JSON.parse((fetcher.mock.calls[0] as unknown as [string, { body: string }])[1].body);
        expect(body.text).toContain('boom');
        expect(body.content).toBe(body.text);
    });
    it('never throws when the webhook fails, and refuses a non-https address', async () => {
        expect(await notifyOps('x', {}, { fetcher: async () => { throw new Error('down'); }, env })).toBe(false);
        expect(await notifyOps('y', {}, { fetcher: vi.fn(), env: { OPS_ALERT_WEBHOOK_URL: 'http://plain.example.com' } })).toBe(false);
        expect(await reportError(new Error('no webhook in tests'))).toBe(false);
    });
});

describe('health, robots and security.txt', () => {
    it('health answers ok with a working database, and never caches', async () => {
        const res = await health();
        expect(res.status).toBe(200);
        expect(res.headers.get('cache-control')).toBe('no-store');
        expect(await res.json()).toMatchObject({ status: 'ok', checks: { app: 'ok', database: 'ok' } });
    });
    it('robots keeps the app and API out of search and points to the sitemap', () => {
        const r = robots();
        const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
        expect(rule.disallow).toEqual(expect.arrayContaining(['/api/', '/settings', '/share/', '/admin']));
        expect(String(r.sitemap)).toMatch(/sitemap\.xml$/);
    });
    it('security.txt has a contact and a future expiry', async () => {
        const text = await securityTxt().text();
        expect(text).toMatch(/^Contact: mailto:/m);
        const exp = Date.parse(/^Expires: (.+)$/m.exec(text)![1]);
        expect(exp).toBeGreaterThan(Date.now());
    });
});

describe('backup and restore', () => {
    it('round-trips schema and rows, including quotes and semicolons, and refuses a non-empty target', async () => {
        const d = await getDb();
        await d.run(sql`update users set name = ${"O'Brien; DROP TABLE users; --"} where email = 'export@example.com'`);
        const src = createClient({ url: process.env.DATABASE_URL! });
        let dump = '';
        const r = await backup(src, (s: string) => { dump += s; });
        expect(r.tables).toBeGreaterThan(40);
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cro-restore-'));
        const dst = createClient({ url: `file:${path.join(dir, 'r.db')}` });
        await dst.execute('PRAGMA foreign_keys = ON');
        await restore(dst, dump);
        const row = await dst.execute("select name from users where email = 'export@example.com'");
        expect(row.rows[0].name).toBe("O'Brien; DROP TABLE users; --");
        const count = async (c: typeof src, t: string) => Number((await c.execute(`select count(*) n from ${t}`)).rows[0].n);
        for (const t of ['users', 'organizations', 'experiments', 'support_tickets', '__drizzle_migrations']) expect(await count(dst, t), t).toBe(await count(src, t));
        await expect(restore(dst, dump)).rejects.toThrow(/not empty/);
        src.close(); dst.close();
        fs.rmSync(dir, { recursive: true, force: true });
    });
});

describe('shared rate limiter', () => {
    /** A fake Upstash pipeline endpoint backed by one Map, shared by every limiter that uses it. */
    function fakeStore() {
        const data = new Map<string, number>();
        const fetcher = vi.fn(async (_url: string, init: { body?: string }) => {
            const cmds = JSON.parse(init.body!) as (string | number)[][];
            const out = cmds.map(([op, k]) => {
                if (op === 'INCR') { data.set(String(k), (data.get(String(k)) ?? 0) + 1); return { result: data.get(String(k)) }; }
                if (op === 'GET') return { result: data.has(String(k)) ? String(data.get(String(k))) : null };
                return { result: 1 };
            });
            return { ok: true, json: async () => out };
        });
        return { fetcher, data };
    }
    const store = { url: 'https://redis.example.com', token: 't' };

    it('counts across instances through the store', async () => {
        const { fetcher } = fakeStore();
        const a = new SharedRateLimiter('t', 3, 60_000, new RateLimiter(3, 60_000), store, fetcher, () => 1000);
        const b = new SharedRateLimiter('t', 3, 60_000, new RateLimiter(3, 60_000), store, fetcher, () => 1000);
        expect((await a.check('k')).allowed).toBe(true);
        expect((await b.check('k')).allowed).toBe(true);
        expect((await a.check('k')).allowed).toBe(true);
        const fourth = await b.check('k');
        expect(fourth.allowed).toBe(false);
        expect(fourth.retryAfterSeconds).toBe(59);
        expect(await a.exceeded('k')).toBe(true);
    });
    it('falls back to the local limiter when the store fails, and skips the store when already over locally', async () => {
        const failing = vi.fn(async () => { throw new Error('down'); });
        const l = new SharedRateLimiter('t', 2, 60_000, new RateLimiter(2, 60_000), store, failing);
        expect((await l.check('k')).allowed).toBe(true);
        expect((await l.check('k')).allowed).toBe(true);
        expect((await l.check('k')).allowed).toBe(false);
        expect(await l.exceeded('other')).toBe(false);
        const calls = failing.mock.calls.length;
        await l.check('k');
        expect(failing.mock.calls.length).toBe(calls);
    });
    it('is off without both settings', () => {
        expect(sharedStoreConfig({})).toBeNull();
        expect(sharedStoreConfig({ UPSTASH_REDIS_REST_URL: 'https://x.upstash.io' })).toBeNull();
        expect(sharedStoreConfig({ UPSTASH_REDIS_REST_URL: 'https://x.upstash.io/', UPSTASH_REDIS_REST_TOKEN: 'tok' })).toEqual({ url: 'https://x.upstash.io', token: 'tok' });
    });
});
