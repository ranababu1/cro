import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Window } from 'happy-dom';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain } from './helpers';
import { createPopupSchema, popupConfigSchema, popupMatchesUrl, popupStats, updatePopupSchema, MAX_POPUPS_PER_PROJECT } from '@/lib/popups';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import { flushTelemetry, pendingTelemetry } from '@/lib/telemetry';
import { GET as list, POST as create } from '@/app/api/popups/route';
import { PATCH as patch, DELETE as remove } from '@/app/api/popups/[id]/route';
import { POST as event } from '@/app/api/sdk/popups/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';

const json = (method: string, url: string, body?: unknown) =>
    new NextRequest(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' }, body: body === undefined ? undefined : JSON.stringify(body) });
const beacon = (key: string, body: unknown) =>
    new NextRequest(`http://localhost/api/sdk/popups?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'text/plain', Origin: 'http://localhost' }, body: JSON.stringify(body) });
const boot = async (key: string, url: string) => (await bootstrap(new NextRequest('http://localhost/api/sdk/bootstrap', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': key, Origin: 'http://localhost', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ url, user_id: 'visitor-1' }),
}))).json();
const cfg = (over: Record<string, unknown> = {}) => ({ title: 'Ten percent off', body: 'Use code TEN', button_text: 'Shop', button_url: '/shop', ...over });

describe('popup rules', () => {
    it('validates content, links and triggers', () => {
        expect(popupConfigSchema.parse(cfg())).toMatchObject({ position: 'center', trigger: 'delay', trigger_value: 5, frequency: 'once', device: 'all', match: 'all', color: '#2563eb' });
        expect(popupConfigSchema.safeParse(cfg({ button_url: 'javascript:alert(1)' })).success).toBe(false);
        expect(popupConfigSchema.safeParse(cfg({ button_url: '//evil.com' })).success).toBe(false);
        for (const u of ['https://x.com', '/a', '#top', 'mailto:a@b.co', 'tel:+1']) expect(popupConfigSchema.safeParse(cfg({ button_url: u })).success, u).toBe(true);
        expect(popupConfigSchema.safeParse(cfg({ trigger: 'scroll', trigger_value: 150 })).success).toBe(false);
        expect(popupConfigSchema.safeParse(cfg({ match: 'equals', match_value: '' })).success).toBe(false);
        expect(popupConfigSchema.safeParse(cfg({ color: 'red' })).success).toBe(false);
        expect(updatePopupSchema.safeParse({ project_id: 'x' }).success).toBe(false);
        expect(createPopupSchema.parse({ name: 'n', config: cfg() }).status).toBe('draft');
    });
    it('matches pages by path, or by host and path when the rule has a host', () => {
        const m = (match: string, match_value: string, url: string) => popupMatchesUrl({ match: match as 'equals', match_value }, url);
        expect(m('all', '', 'https://a.com/x')).toBe(true);
        expect(m('equals', '/pricing', 'https://www.a.com/pricing/?utm=1')).toBe(true);
        expect(m('equals', '/pricing', 'https://a.com/pricing/team')).toBe(false);
        expect(m('starts_with', '/blog', 'https://a.com/blog/post')).toBe(true);
        expect(m('starts_with', 'https://a.com/blog', 'https://b.com/blog/post')).toBe(false);
        expect(m('equals', 'https://www.a.com/', 'https://a.com')).toBe(true);
        expect(m('contains', 'checkout', 'https://a.com/cart/checkout?x=1')).toBe(true);
        expect(m('contains', 'x=1', 'https://a.com/cart?x=1')).toBe(false);
    });
    it('sums stats and the click rate', () => {
        const s = popupStats([{ popup_id: 'p', metric: 'view', count: 8 }, { popup_id: 'p', metric: 'click', count: 2 }, { popup_id: 'p', metric: 'close', count: 3 }, { popup_id: 'q', metric: 'close', count: 1 }]);
        expect(s.get('p')).toEqual({ views: 8, clicks: 2, closes: 3, ctr: 0.25 });
        expect(s.get('q')!.ctr).toBeNull();
    });
});

describe('popups end to end', () => {
    let cleanup: () => void;
    const prevSync = process.env.TELEMETRY_SYNC;
    const t: Record<string, { userId: string; key: string; projectId: string; orgId: string }> = {};
    async function tenant(name: string, plan: string) {
        const u = await db.createUser({ email: `${name}@example.com`, name });
        const ws = await db.ensureWorkspace(u);
        await db.updateOrganization(ws.orgId, { plan });
        await seedProjectDomain(ws.projectId, 'localhost');
        const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'prod')!;
        return { userId: u.id, key: (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key, projectId: ws.projectId, orgId: ws.orgId };
    }
    beforeAll(async () => {
        cleanup = useTempDatabase();
        t.free = await tenant('pfree', 'free');
        t.paid = await tenant('ppaid', 'starter');
        clearConfigCache();
    });
    afterAll(() => { process.env.TELEMETRY_SYNC = prevSync; cleanup(); });

    it('is paid only', async () => {
        session.current = { user: { id: t.free.userId } };
        const r = await list(json('GET', '/api/popups'));
        expect(r.status).toBe(403);
        expect((await r.json()).upgrade).toMatch(/paid plans/);
        expect((await create(json('POST', '/api/popups', { name: 'x', config: cfg() }))).status).toBe(403);
    });

    let popupId = '';
    it('creates, turns on and serves matching popups through bootstrap, and loads the module only then', async () => {
        session.current = { user: { id: t.paid.userId } };
        expect((await create(json('POST', '/api/popups', { name: 'x', config: cfg({ button_url: 'javascript:1' }) }))).status).toBe(400);
        const res = await create(json('POST', '/api/popups', { name: 'Pricing offer', config: cfg({ match: 'equals', match_value: '/pricing', trigger: 'scroll', trigger_value: 40 }) }));
        expect(res.status).toBe(201);
        popupId = (await res.json()).popup.id;
        // Drafts are not served.
        expect((await boot(t.paid.key, 'http://localhost/pricing')).popups).toBeUndefined();
        const on = await patch(json('PATCH', `/api/popups/${popupId}`, { status: 'active' }), { params: Promise.resolve({ id: popupId }) });
        expect((await on.json()).popup.status).toBe('active');
        const b = await boot(t.paid.key, 'http://localhost/pricing?ref=1');
        expect(b.modules).toEqual(['popups']);
        expect(b.popups).toHaveLength(1);
        expect(b.popups[0]).toMatchObject({ id: popupId, title: 'Ten percent off', trigger: 'scroll', trigger_value: 40 });
        expect(b.popups[0].match_value).toBeUndefined();
        const other = await boot(t.paid.key, 'http://localhost/about');
        expect(other.modules).toBeUndefined();
        expect(other.popups).toBeUndefined();
    });

    it('stops serving popups after a downgrade and keeps them', async () => {
        const org = { id: t.paid.orgId };
        await db.updateOrganization(org.id, { plan: 'free' });
        clearConfigCache();
        expect((await boot(t.paid.key, 'http://localhost/pricing')).popups).toBeUndefined();
        expect((await event(beacon(t.paid.key, { popup_id: popupId, event: 'view' }))).status).toBe(403);
        await db.updateOrganization(org.id, { plan: 'starter' });
        clearConfigCache();
        expect((await db.listPopups(t.paid.projectId))).toHaveLength(1);
    });

    it('batches events in memory and writes them in one flush', async () => {
        process.env.TELEMETRY_SYNC = '0';
        await flushTelemetry();
        expect((await event(beacon(t.paid.key, { popup_id: 'pop_nope', event: 'view' }))).status).toBe(404);
        expect((await event(beacon(t.paid.key, { popup_id: popupId, event: 'submit' }))).status).toBe(400);
        for (let i = 0; i < 8; i++) expect((await event(beacon(t.paid.key, { popup_id: popupId, event: 'view' }))).status).toBe(202);
        await event(beacon(t.paid.key, { popup_id: popupId, event: 'click' }));
        await event(beacon(t.paid.key, { popup_id: popupId, event: 'click' }));
        await event(beacon(t.paid.key, { popup_id: popupId, event: 'close' }));
        expect(pendingTelemetry()).toBeGreaterThanOrEqual(3);
        const spy = vi.spyOn(db, 'bumpTelemetryBatch');
        await flushTelemetry();
        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
        process.env.TELEMETRY_SYNC = prevSync;
        session.current = { user: { id: t.paid.userId } };
        const r = await (await list(json('GET', '/api/popups'))).json();
        expect(r.max).toBe(MAX_POPUPS_PER_PROJECT);
        expect(r.popups[0].stats).toEqual({ views: 8, clicks: 2, closes: 1, ctr: 0.25 });
    });

    it('keeps other users out and deletes popups with their numbers', async () => {
        // Another paid account cannot reach this popup by id.
        await db.updateOrganization(t.free.orgId, { plan: 'starter' });
        session.current = { user: { id: t.free.userId } };
        expect((await patch(json('PATCH', `/api/popups/${popupId}`, { status: 'paused' }), { params: Promise.resolve({ id: popupId }) })).status).toBe(404);
        expect((await remove(json('DELETE', `/api/popups/${popupId}`), { params: Promise.resolve({ id: popupId }) })).status).toBe(404);
        await db.updateOrganization(t.free.orgId, { plan: 'free' });
        session.current = { user: { id: t.paid.userId } };
        expect((await patch(json('PATCH', '/api/popups/pop_nope', { status: 'paused' }), { params: Promise.resolve({ id: 'pop_nope' }) })).status).toBe(404);
        expect((await remove(json('DELETE', `/api/popups/${popupId}`), { params: Promise.resolve({ id: popupId }) })).status).toBe(200);
        expect(await db.listPopups(t.paid.projectId)).toHaveLength(0);
        // A buffered event for a deleted popup is skipped instead of failing the batch.
        await db.bumpTelemetryBatch([], [], [], [{ day: '2026-01-05', popup_id: popupId, metric: 'view', count: 1 }]);
    });

    it('allows up to 20 popups per project', async () => {
        for (let i = 0; i < MAX_POPUPS_PER_PROJECT; i++) await db.createPopup({ project_id: t.paid.projectId, name: `p${i}`, status: 'draft', config: JSON.stringify(cfg()) });
        const r = await create(json('POST', '/api/popups', { name: 'one more', config: cfg() }));
        expect(r.status).toBe(400);
        expect((await r.json()).error).toMatch(/up to 20 popups/);
    });
});

describe('popups.js on a page', () => {
    const src = fs.readFileSync(path.join(__dirname, '../public/popups.js'), 'utf8');
    function page(popup: Record<string, unknown>, width = 1280) {
        const w = new Window({ url: 'https://www.example.com/pricing', width, height: 800 });
        const sdk = w.document.createElement('script');
        sdk.setAttribute('src', 'https://www.freeabtest.com/sdk.js');
        sdk.setAttribute('data-key', 'cro_pk_test');
        w.document.head.appendChild(sdk);
        const sent: Array<{ url: string; body: { popup_id: string; event: string } }> = [];
        (w.navigator as unknown as Record<string, unknown>).sendBeacon = undefined;
        (w as unknown as Record<string, unknown>).fetch = (url: string, init: { body: string }) => { sent.push({ url, body: JSON.parse(init.body) }); return Promise.resolve({}); };
        (w as unknown as Record<string, unknown>).__ABTestMod = { matched: false, popups: [{ id: 'pop_1', title: '<b>Hi</b>', body: 'Text', button_text: 'Go', button_url: '/go', new_tab: false, position: 'center', color: '#ff0000', trigger: 'delay', trigger_value: 0, frequency: 'once', device: 'all', ...popup }] };
        Object.defineProperty(w.document, 'currentScript', { value: { src: 'https://www.freeabtest.com/popups.js' }, configurable: true });
        w.eval(src);
        const host = () => w.document.querySelector('[data-abtest-popup]') as unknown as { shadowRoot: ShadowRoot } | null;
        return { w, sent, host };
    }
    it('shows the popup as plain text, counts the view and the close, and remembers it', async () => {
        const { w, sent, host } = page({});
        await new Promise((r) => setTimeout(r, 20));
        const root = host()!.shadowRoot;
        expect(root.querySelector('h2')!.textContent).toBe('<b>Hi</b>');
        expect(root.querySelector('b')).toBeNull();
        expect(root.querySelector('a')!.getAttribute('href')).toBe('/go');
        expect(sent.map((s) => s.body.event)).toEqual(['view']);
        expect(sent[0].url).toBe('https://www.freeabtest.com/api/sdk/popups?key=cro_pk_test');
        w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
        expect(host()).toBeNull();
        expect(sent.map((s) => s.body.event)).toEqual(['view', 'close']);
        expect(w.localStorage.getItem('fabt_pop_pop_1')).toBe('1');
    });
    it('does not show again once seen, and respects the device setting', async () => {
        const a = page({});
        a.w.localStorage.setItem('fabt_pop_pop_1', '1');
        const b = page({ device: 'mobile' });
        const c = page({ device: 'desktop' }, 390);
        await new Promise((r) => setTimeout(r, 20));
        expect(a.host()).toBeNull();
        expect(b.host()).toBeNull();
        expect(c.host()).toBeNull();
    });
    it('waits for exit intent', async () => {
        const { w, host } = page({ trigger: 'exit' });
        await new Promise((r) => setTimeout(r, 20));
        expect(host()).toBeNull();
        w.document.dispatchEvent(new w.MouseEvent('mouseout', { clientY: -2 }));
        expect(host()).not.toBeNull();
    });
});

describe('SDK wiring for popups', () => {
    it('loads modules on pages without a test', () => {
        const sdk = fs.readFileSync(path.join(__dirname, '../sdk-src/sdk.js'), 'utf8');
        const loop = sdk.indexOf("for (var m = 0; data.modules");
        const branch = sdk.indexOf("if (data.matched && data.variation_id && data.action !== 'guard') {");
        expect(loop).toBeGreaterThan(branch);
        // The loop sits after the matched branch closes, so it runs for every non-redirect reply.
        expect(sdk.slice(branch, loop)).toMatch(/\n {16}\}\n/);
    });
});
