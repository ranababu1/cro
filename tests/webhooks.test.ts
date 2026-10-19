import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import {
    webhookUrlError, isPrivateAddress, signPayload, emitWebhookEvent, deliverDueWebhooks, scanForWebhookEvents, runWebhooks,
    MAX_ATTEMPTS, RETRY_MINUTES, type Fetcher,
} from '@/lib/webhooks';
import { GET as list, POST as add } from '@/app/api/webhooks/route';
import { PATCH as edit, DELETE as remove } from '@/app/api/webhooks/[id]/route';
import { POST as ping } from '@/app/api/webhooks/[id]/test/route';
import { POST as createExp } from '@/app/api/experiments/route';
import { PATCH as patchExp } from '@/app/api/experiments/[id]/route';

const p = (id: string) => ({ params: Promise.resolve({ id }) });
const PUBLIC = async () => ['93.184.216.34'];

/** The verification snippet from the docs, verbatim in behavior. */
function verify(rawBody: string, header: string, secret: string, nowSec: number) {
    const parts = Object.fromEntries(header.split(',').map((x) => x.split('=')));
    const expected = crypto.createHmac('sha256', secret).update(parts.t + '.' + rawBody).digest('hex');
    const fresh = Math.abs(nowSec - Number(parts.t)) < 300;
    return fresh && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1 || ''));
}

describe('webhook address checks', () => {
    it('accepts public https addresses only', () => {
        expect(webhookUrlError('https://hooks.example.com/x')).toBeNull();
        expect(webhookUrlError('https://93.184.216.34/x')).toBeNull();
        for (const bad of ['http://hooks.example.com/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://10.0.0.5/x', 'https://192.168.1.2/x', 'https://169.254.169.254/latest', 'https://[::1]/x', 'https://u:p@hooks.example.com/', 'https://intranet/x', 'https://db.internal/x', 'not a url']) {
            expect(webhookUrlError(bad), bad).not.toBeNull();
        }
    });
    it('knows private addresses', () => {
        for (const ip of ['10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.0.1', '127.0.0.1', '169.254.1.1', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) expect(isPrivateAddress(ip), ip).toBe(true);
        for (const ip of ['93.184.216.34', '172.32.0.1', '8.8.8.8', '2606:4700::1111']) expect(isPrivateAddress(ip), ip).toBe(false);
    });
    it('signs t.body with HMAC-SHA256, matching the documented check', () => {
        const body = '{"a":1}';
        const sig = signPayload('whsec_x', 1792400000, body);
        expect(verify(body, `t=1792400000,v1=${sig}`, 'whsec_x', 1792400010)).toBe(true);
        expect(verify(body + ' ', `t=1792400000,v1=${sig}`, 'whsec_x', 1792400010)).toBe(false);
        expect(verify(body, `t=1792400000,v1=${sig}`, 'whsec_x', 1792400000 + 600)).toBe(false);
    });
});

describe('webhooks end to end', () => {
    let cleanup: () => void;
    const users: Record<string, { id: string; orgId: string; projectId: string }> = {};
    const as = (k: string | null) => { session.current = k ? { user: { id: users[k].id } } : null; };
    const req = (method: string, url: string, body?: unknown, project?: string) => new NextRequest(`http://localhost${url}`, {
        method,
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...(project ? { Cookie: `cro_project=${project}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const sent: Array<{ url: string; headers: Record<string, string>; body: string }> = [];
    let answer = 200;
    const fetcher: Fetcher = async (url, init) => {
        sent.push({ url, headers: init.headers as Record<string, string>, body: String(init.body) });
        return { status: answer };
    };
    let hookId = '';
    let secret = '';

    beforeAll(async () => {
        cleanup = useTempDatabase();
        for (const k of ['owner', 'free', 'member']) {
            const u = await db.createUser({ email: `${k}@hooks.test`, name: k });
            const ws = await db.ensureWorkspace(u);
            users[k] = { id: u.id, orgId: ws.orgId, projectId: ws.projectId };
        }
        await db.updateOrganization(users.owner.orgId, { plan: 'starter' });
        await db.addMember(users.owner.orgId, users.member.id, 'member');
        await seedProjectDomain(users.owner.projectId, 'localhost');
    });
    afterAll(() => cleanup());

    it('is paid only, owners only, and checks the address', async () => {
        as('free');
        const r = await add(req('POST', '/api/webhooks', { url: 'https://93.184.216.34/hook', events: ['test.completed'] }));
        expect(r.status).toBe(403);
        expect((await r.json()).upgrade).toMatch(/paid plans/);
        as('member');
        expect((await add(req('POST', '/api/webhooks', { url: 'https://93.184.216.34/hook', events: ['test.completed'] }, users.owner.projectId))).status).toBe(403);
        as(null);
        expect((await add(req('POST', '/api/webhooks', { url: 'https://93.184.216.34/hook', events: ['test.completed'] }))).status).toBe(401);
        as('owner');
        expect((await add(req('POST', '/api/webhooks', { url: 'https://10.0.0.1/hook', events: ['test.completed'] }))).status).toBe(400);
        expect((await add(req('POST', '/api/webhooks', { url: 'https://93.184.216.34/hook', events: ['nope'] }))).status).toBe(400);
        const ok = await add(req('POST', '/api/webhooks', { url: 'https://93.184.216.34/hook', events: ['test.completed', 'quota.reached'] }));
        expect(ok.status).toBe(201);
        const data = await ok.json();
        hookId = data.webhook.id;
        secret = data.secret;
        expect(secret).toMatch(/^whsec_[0-9a-f]{48}$/);
        expect(JSON.stringify(data.webhook)).not.toContain(secret);
        // Members see endpoints, never the secret.
        as('member');
        const seen = await (await list(req('GET', '/api/webhooks', undefined, users.owner.projectId))).json();
        expect(seen.owner).toBe(false);
        expect(seen.webhooks).toHaveLength(1);
        expect(JSON.stringify(seen)).not.toContain(secret);
        // Another organization cannot touch it.
        as('free');
        expect((await edit(req('PATCH', '/', { enabled: false }), p(hookId))).status).toBe(404);
        expect((await remove(req('DELETE', '/'), p(hookId))).status).toBe(404);
        expect((await db.listAuditForOrg(users.owner.orgId, { since: '2000-01-01', limit: 50 })).some((a) => a.entity === 'webhook' && a.action === 'create')).toBe(true);
    });

    it('caps endpoints at 5', async () => {
        as('owner');
        for (let i = 0; i < 4; i++) expect((await add(req('POST', '/api/webhooks', { url: `https://93.184.216.34/h${i}`, events: ['test.winner'] }))).status).toBe(201);
        expect((await add(req('POST', '/api/webhooks', { url: 'https://93.184.216.34/h9', events: ['test.winner'] }))).status).toBe(400);
        for (const w of await db.listWebhooks(users.owner.orgId)) if (w.id !== hookId) expect((await remove(req('DELETE', '/'), p(w.id))).status).toBe(200);
    });

    it('queues test.completed once when a test stops, and sends it signed', async () => {
        as('owner');
        const exp = (await (await createExp(req('POST', '/api/experiments', flowExperimentBody()))).json()).experiment;
        expect((await patchExp(req('PATCH', '/', { status: 'running' }), p(exp.id))).status).toBe(200);
        expect((await patchExp(req('PATCH', '/', { status: 'completed' }), p(exp.id))).status).toBe(200);
        // Emitting again is a no-op: one delivery per event.
        expect(await emitWebhookEvent(users.owner.orgId, 'test.completed', exp.id, {})).toBe(0);
        const now = new Date();
        const out = await deliverDueWebhooks(now, fetcher, PUBLIC);
        expect(out.sent).toBe(1);
        const d = sent.at(-1)!;
        expect(d.url).toBe('https://93.184.216.34/hook');
        expect(d.headers['X-FreeABTest-Event']).toBe('test.completed');
        expect(verify(d.body, d.headers['X-FreeABTest-Signature'], secret, now.getTime() / 1000)).toBe(true);
        const body = JSON.parse(d.body);
        expect(body).toMatchObject({ event: 'test.completed', id: d.headers['X-FreeABTest-Delivery'], data: { experiment: { id: exp.id, status: 'completed' }, completed_by: 'manual' } });
        expect((await deliverDueWebhooks(now, fetcher, PUBLIC)).sent).toBe(0);
    });

    it('retries on errors with backoff, then gives up', async () => {
        clearConfigCache();
        await db.updateOrganization(users.owner.orgId, { monthly_visitor_limit: 0 });
        const t0 = Date.now();
        expect(await scanForWebhookEvents(new Date(t0))).toBe(1);
        answer = 500;
        let t = t0;
        for (let i = 1; i <= MAX_ATTEMPTS; i++) {
            const r = await deliverDueWebhooks(new Date(t), fetcher, PUBLIC);
            expect(r.sent).toBe(0);
            if (i < MAX_ATTEMPTS) {
                expect(r.retry).toBe(1);
                // Not due again before the wait is over.
                expect((await deliverDueWebhooks(new Date(t + RETRY_MINUTES[i - 1] * 60_000 - 1000), fetcher, PUBLIC)).retry).toBe(0);
                t += RETRY_MINUTES[i - 1] * 60_000;
            } else {
                expect(r.failed).toBe(1);
            }
        }
        const last = (await db.listWebhookDeliveries(users.owner.orgId, 1))[0];
        expect(last).toMatchObject({ event: 'quota.reached', status: 'failed', attempts: MAX_ATTEMPTS, response_status: 500 });
        // Sent once per limit per month.
        expect(await scanForWebhookEvents(new Date(t0))).toBe(0);
        answer = 200;
        await db.updateOrganization(users.owner.orgId, { monthly_visitor_limit: null });
    });

    it('never sends to a host that resolves to a private address', async () => {
        const before = sent.length;
        await db.updateWebhook(hookId, { url: 'https://hooks.example.com/x' });
        clearConfigCache();
        expect(await emitWebhookEvent(users.owner.orgId, 'test.completed', 'manual-dns', {})).toBe(1);
        const r = await deliverDueWebhooks(new Date(Date.now() + 1000), fetcher, async () => ['10.0.0.8']);
        expect(r).toEqual({ sent: 0, retry: 1, failed: 0 });
        expect(r.retry).toBe(1);
        expect(sent.length).toBe(before);
        expect((await db.getWebhook(hookId))!.last_error).toMatch(/private/);
        // The real send happens on a later run.
        expect((await deliverDueWebhooks(new Date(Date.now() + 2 * 60_000), fetcher, PUBLIC)).sent).toBe(1);
        expect(sent.at(-1)!.url).toBe('https://hooks.example.com/x');
        await db.updateWebhook(hookId, { url: 'https://93.184.216.34/hook' });
    });

    it('send test, replace secret, turn off', async () => {
        as('owner');
        vi.stubGlobal('fetch', vi.fn(async () => ({ status: 204 })));
        const r = await (await ping(req('POST', '/'), p(hookId))).json();
        expect(r).toMatchObject({ ok: true, status: 204 });
        vi.stubGlobal('fetch', vi.fn(async () => ({ status: 500 })));
        const bad = await (await ping(req('POST', '/'), p(hookId))).json();
        expect(bad).toMatchObject({ ok: false, status: 500 });
        // A test is sent once and never retried.
        expect((await db.listWebhookDeliveries(users.owner.orgId, 1))[0]).toMatchObject({ event: 'ping', status: 'failed', attempts: 1 });
        vi.unstubAllGlobals();
        const rot = await (await edit(req('PATCH', '/', { rotate_secret: true }), p(hookId))).json();
        expect(rot.secret).toMatch(/^whsec_/);
        expect(rot.secret).not.toBe(secret);
        expect((await edit(req('PATCH', '/', { enabled: false }), p(hookId))).status).toBe(200);
        clearConfigCache();
        expect(await emitWebhookEvent(users.owner.orgId, 'test.completed', 'off', {})).toBe(0);
        const acts = (await db.listAuditForOrg(users.owner.orgId, { since: '2000-01-01', entity: 'webhook', limit: 50 })).map((a) => a.action);
        expect(acts).toEqual(expect.arrayContaining(['ping', 'secret:rotate', 'update']));
    });

    it('stops on a downgrade, but owners can still turn off and delete', async () => {
        as('owner');
        await db.updateWebhook(hookId, { enabled: true });
        await emitWebhookEvent(users.owner.orgId, 'test.completed', 'pre-downgrade', {});
        await db.updateOrganization(users.owner.orgId, { plan: 'free' });
        clearConfigCache();
        const r = await deliverDueWebhooks(new Date(Date.now() + 3600_000), fetcher, PUBLIC);
        expect(r.failed).toBeGreaterThanOrEqual(1);
        expect(await emitWebhookEvent(users.owner.orgId, 'test.completed', 'post-downgrade', {})).toBe(0);
        expect((await edit(req('PATCH', '/', { enabled: true }), p(hookId))).status).toBe(403);
        expect((await edit(req('PATCH', '/', { enabled: false }), p(hookId))).status).toBe(200);
        expect((await remove(req('DELETE', '/'), p(hookId))).status).toBe(200);
        expect(await db.listWebhooks(users.owner.orgId)).toHaveLength(0);
    });

    it('the maintenance job runs at most once a minute', async () => {
        const t = Date.now() + 10 * 3600_000;
        expect(await runWebhooks(new Date(t), fetcher, PUBLIC)).not.toBeNull();
        expect(await runWebhooks(new Date(t + 10_000), fetcher, PUBLIC)).toBeNull();
        expect(await runWebhooks(new Date(t + 61_000), fetcher, PUBLIC)).not.toBeNull();
    });
});
