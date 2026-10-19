import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Window } from 'happy-dom';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';
import { createPreviewToken, verifyPreviewToken, previewUrl, PREVIEW_TOKEN_TTL_MS } from '@/lib/previewToken';
import { createEditorToken } from '@/lib/visualEditorToken';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import { POST as create } from '@/app/api/experiments/route';
import { PATCH as patch } from '@/app/api/experiments/[id]/route';
import { PUT as putChanges } from '@/app/api/experiments/[id]/variations/[variationId]/changes/route';
import { POST as makePreview } from '@/app/api/experiments/[id]/variations/[variationId]/preview/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';

const json = (method: string, url: string, body?: unknown) =>
    new NextRequest(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' }, body: body === undefined ? undefined : JSON.stringify(body) });
const pv = (id: string, variationId: string) => ({ params: Promise.resolve({ id, variationId }) });
const CONTROL = 'http://localhost/demo/control.html';
const VARIATION = 'http://localhost/demo/variation.html';
const boot = async (key: string, url: string, preview?: string, user = 'qa-visitor') => (await bootstrap(new NextRequest('http://localhost/api/sdk/bootstrap', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': key, Origin: 'http://localhost', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ url, user_id: user, ...(preview ? { preview } : {}) }),
}))).json();

describe('preview tokens', () => {
    it('are signed, scoped to one variation and expire after 7 days', () => {
        const now = 1_800_000_000_000;
        const t = createPreviewToken({ experimentId: 'exp_1', variationId: 'var_1' }, now);
        expect(verifyPreviewToken(t, now + 1000)).toMatchObject({ experimentId: 'exp_1', variationId: 'var_1' });
        expect(verifyPreviewToken(t, now + PREVIEW_TOKEN_TTL_MS + 1)).toBeNull();
        const [, mac] = t.split('.');
        const forged = Buffer.from(JSON.stringify({ e: 'exp_1', v: 'var_2', x: now + 1e9 })).toString('base64url');
        expect(verifyPreviewToken(`${forged}.${mac}`, now)).toBeNull();
        expect(verifyPreviewToken(`${t}.x`, now)).toBeNull();
        expect(verifyPreviewToken('', now)).toBeNull();
        // Visual editor tokens use the same secret but never work as preview links.
        expect(verifyPreviewToken(createEditorToken({ experimentId: 'exp_1', variationId: 'var_1', userId: 'u' }, now), now)).toBeNull();
        expect(previewUrl('https://www.example.com/p?a=1', t)).toBe(`https://www.example.com/p?a=1&fabt_preview=${t}`);
    });
});

describe('preview links end to end', () => {
    let cleanup: () => void;
    let userId = '', key = '', otherKey = '', expId = '', controlId = '', urlVarId = '', visualExp = '', visualId = '';
    beforeAll(async () => {
        cleanup = useTempDatabase();
        const u = await db.createUser({ email: 'qa@example.com', name: 'qa' });
        userId = u.id;
        const ws = await db.ensureWorkspace(u);
        await db.updateOrganization(ws.orgId, { plan: 'growth' });
        await seedProjectDomain(ws.projectId, 'localhost');
        const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'prod')!;
        key = (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key;
        const o = await db.createUser({ email: 'other@example.com', name: 'other' });
        const ows = await db.ensureWorkspace(o);
        await seedProjectDomain(ows.projectId, 'localhost');
        const oenv = (await db.getEnvironments(ows.projectId)).find((e) => e.key === 'prod')!;
        otherKey = (await db.createApiKey({ environmentId: oenv.id, type: 'sdk' })).key;
        clearConfigCache();
        session.current = { user: { id: userId } };
        const a = await (await create(json('POST', '/api/experiments', flowExperimentBody()))).json();
        expId = a.experiment.id;
        controlId = a.variations.find((v: { is_control: boolean }) => v.is_control).id;
        urlVarId = a.variations.find((v: { is_control: boolean }) => !v.is_control).id;
        const b = await (await create(json('POST', '/api/experiments', flowExperimentBody({
            name: 'Visual', variations: [{ name: 'Control', url: CONTROL, weight: 50, is_control: true }, { name: 'Annual first', url: '', weight: 50, is_control: false }],
        })))).json();
        visualExp = b.experiment.id;
        visualId = b.variations.find((v: { is_control: boolean }) => !v.is_control).id;
        await putChanges(json('PUT', '/x', { changes: [{ selector: 'h1', action: 'text', value: 'Save 20%' }] }), pv(visualExp, visualId));
    });
    afterAll(() => cleanup());

    it('gives members a link on the control page and nobody else', async () => {
        session.current = { user: { id: userId } };
        const r = await makePreview(json('POST', '/x'), pv(expId, urlVarId));
        expect(r.status).toBe(200);
        const { url, expires_at } = await r.json();
        expect(url.startsWith(`${CONTROL}?fabt_preview=`)).toBe(true);
        expect(new Date(expires_at).getTime()).toBeGreaterThan(Date.now() + PREVIEW_TOKEN_TTL_MS - 60_000);
        expect((await makePreview(json('POST', '/x'), pv(expId, 'var_missing'))).status).toBe(404);
        const other = await db.getUserByEmail('other@example.com');
        session.current = { user: { id: other!.id } };
        expect((await makePreview(json('POST', '/x'), pv(expId, urlVarId))).status).toBe(404);
        session.current = null;
        expect((await makePreview(json('POST', '/x'), pv(expId, urlVarId))).status).toBe(401);
    });

    it('shows the linked version of a draft test and records nothing', async () => {
        const token = createPreviewToken({ experimentId: expId, variationId: urlVarId });
        const onControl = await boot(key, CONTROL, token);
        expect(onControl).toMatchObject({ action: 'redirect', variation_id: urlVarId, variation_url: VARIATION, preview: { variation_name: 'Variation 1', on_page: true } });
        const onVariation = await boot(key, VARIATION, token);
        expect(onVariation).toMatchObject({ action: 'stay', variation_id: urlVarId, preview: { on_page: true } });
        expect((await boot(key, 'http://localhost/about', token)).preview).toMatchObject({ on_page: false });
        const control = await boot(key, CONTROL, createPreviewToken({ experimentId: expId, variationId: controlId }));
        expect(control).toMatchObject({ action: 'stay', is_control: true });
        const visual = await boot(key, CONTROL, createPreviewToken({ experimentId: visualExp, variationId: visualId }));
        expect(visual).toMatchObject({ action: 'stay', variation_id: visualId, changes: [{ selector: 'h1', action: 'text', value: 'Save 20%' }] });
        for (const b of [onControl, onVariation, visual]) {
            expect(b.modules).toBeUndefined();
            expect(b.capture).toBeUndefined();
            expect(b.goals).toBeUndefined();
        }
        expect(await db.getAssignment(expId, 'qa-visitor')).toBeNull();
        expect(await db.getAssignment(visualExp, 'qa-visitor')).toBeNull();
    });

    it('a running test still records nothing for preview visits', async () => {
        session.current = { user: { id: userId } };
        expect((await patch(json('PATCH', `/api/experiments/${expId}`, { status: 'running' }), { params: Promise.resolve({ id: expId }) })).status).toBe(200);
        clearConfigCache();
        const b = await boot(key, CONTROL, createPreviewToken({ experimentId: expId, variationId: urlVarId }), 'qa-2');
        expect(b.action).toBe('redirect');
        expect(await db.getAssignment(expId, 'qa-2')).toBeNull();
        expect(await db.getEventStatsRaw(expId)).toEqual(expect.not.arrayContaining([expect.objectContaining({ user_id: 'qa-2' })]));
        // Without the link the same page enters the test as usual.
        expect((await boot(key, CONTROL, undefined, 'real-1')).matched).toBe(true);
        expect(await db.getAssignment(expId, 'real-1')).not.toBeNull();
    });

    it('rejects bad, foreign and finished links', async () => {
        const token = createPreviewToken({ experimentId: expId, variationId: urlVarId });
        expect(await boot(key, CONTROL, token + 'x')).toMatchObject({ action: 'none', reason: 'preview_invalid', preview: { error: expect.stringMatching(/expired/) } });
        expect((await boot(otherKey, CONTROL, token)).reason).toBe('preview_invalid');
        expect((await boot(key, CONTROL, createPreviewToken({ experimentId: expId, variationId: 'var_x' }))).reason).toBe('preview_invalid');
        session.current = { user: { id: userId } };
        expect((await patch(json('PATCH', `/api/experiments/${expId}`, { status: 'completed' }), { params: Promise.resolve({ id: expId }) })).status).toBe(200);
        expect((await boot(key, CONTROL, token)).reason).toBe('preview_invalid');
        const r = await makePreview(json('POST', '/x'), pv(expId, urlVarId));
        expect(r.status).toBe(400);
        expect((await r.json()).error).toMatch(/completed/);
    });

    it('answers before any counting in the bootstrap route', () => {
        const src = fs.readFileSync(path.join(__dirname, '../app/api/sdk/bootstrap/route.ts'), 'utf8');
        const at = src.indexOf('if (preview) return');
        expect(at).toBeGreaterThan(0);
        for (const later of ['getPageviewStatus(', 'bumpTraffic(', 'recordGoalHits(', 'countPageview(', 'createAssignment(']) expect(src.indexOf(later), later).toBeGreaterThan(at);
    });
});

describe('SDK in preview mode', () => {
    const sources = [
        ['source', fs.readFileSync(path.join(__dirname, '../sdk-src/sdk.js'), 'utf8')],
        ['built', fs.readFileSync(path.join(__dirname, '../public/sdk.js'), 'utf8')],
    ] as const;
    function page(code: string, url: string, reply: Record<string, unknown>) {
        const w = new Window({ url, settings: { disableJavaScriptFileLoading: true } });
        const sdk = w.document.createElement('script');
        sdk.setAttribute('src', 'https://www.freeabtest.com/sdk.js');
        sdk.setAttribute('data-key', 'cro_pk_test');
        w.document.head.appendChild(sdk);
        Object.defineProperty(w.document, 'currentScript', { value: sdk, configurable: true });
        Object.defineProperty(w.navigator, 'userAgent', { value: 'Mozilla/5.0 Chrome/120', configurable: true });
        const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
        (w.navigator as unknown as Record<string, unknown>).sendBeacon = () => { calls.push({ url: 'beacon', body: {} }); return true; };
        (w as unknown as Record<string, unknown>).fetch = (u: string, init: { body: string }) => {
            calls.push({ url: u, body: JSON.parse(init.body) });
            return Promise.resolve({ ok: true, status: 200, json: async () => reply });
        };
        let replaced = '';
        (w.location as unknown as { replace: (u: string) => void }).replace = (u: string) => { replaced = u; };
        w.eval(code);
        return { w, calls, replaced: () => replaced };
    }
    const reply = { matched: true, action: 'stay', reason: 'preview', experiment_id: 'exp_1', variation_id: 'var_1', variation_name: 'B', preview: { variation_name: 'B', on_page: true }, goals: [{ id: 'g', name: 'g', type: 'click', selector: 'body' }] };

    it.each(sources)('sends the token, keeps it for the tab and tracks nothing (%s)', async (_l, code) => {
        const { w, calls } = page(code, 'https://www.example.com/pricing?fabt_preview=tok.abc', reply);
        await new Promise((r) => setTimeout(r, 30));
        expect(calls[0].url).toBe('https://www.freeabtest.com/api/sdk/bootstrap');
        expect(calls[0].body.preview).toBe('tok.abc');
        expect(w.sessionStorage.getItem('fabt_preview')).toBe('tok.abc');
        const mod = [...w.document.querySelectorAll('script')].map((s) => s.getAttribute('src'));
        expect(mod).toContain('https://www.freeabtest.com/preview.js');
        expect((w as unknown as Record<string, unknown>).__ABTestPreview).toEqual(reply.preview);
        w.document.body.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
        await (w as unknown as { ABTest: { track: (n: string) => Promise<unknown> } }).ABTest.track('signup');
        w.document.dispatchEvent(new w.Event('pagehide'));
        await new Promise((r) => setTimeout(r, 1100));
        expect(calls).toHaveLength(1);
    });

    it.each(sources)('follows the redirect of a URL version and keeps the link (%s)', async (_l, code) => {
        const p = page(code, 'https://www.example.com/pricing?fabt_preview=tok.abc', { ...reply, action: 'redirect', variation_url: 'https://www.example.com/pricing-b' });
        await new Promise((r) => setTimeout(r, 30));
        expect(p.replaced()).toBe('https://www.example.com/pricing-b?fabt_preview=tok.abc');
    });

    it.each(sources)('without a link the SDK works as before (%s)', async (_l, code) => {
        const { w, calls } = page(code, 'https://www.example.com/pricing', { matched: true, action: 'stay', experiment_id: 'exp_1', variation_id: 'var_1' });
        await new Promise((r) => setTimeout(r, 1100));
        expect(calls[0].body.preview).toBeUndefined();
        expect(calls.some((c) => c.url.includes('/api/track'))).toBe(true);
        expect(w.sessionStorage.getItem('fabt_preview')).toBeNull();
    });
});

describe('preview.js bar', () => {
    const src = fs.readFileSync(path.join(__dirname, '../public/preview.js'), 'utf8');
    function bar(cfg: Record<string, unknown>) {
        const w = new Window({ url: 'https://www.example.com/pricing?fabt_preview=t&a=1' });
        w.sessionStorage.setItem('fabt_preview', 't');
        let replaced = '';
        (w.location as unknown as { replace: (u: string) => void }).replace = (u: string) => { replaced = u; };
        (w as unknown as Record<string, unknown>).__ABTestPreview = cfg;
        w.eval(src);
        return { w, el: w.document.querySelector('[data-fabt-preview]')!, replaced: () => replaced };
    }
    it('names the version as plain text and exits preview', () => {
        const { w, el, replaced } = bar({ variation_name: '<img src=x onerror=alert(1)>', on_page: true });
        expect(el.textContent).toContain('Preview: <img src=x onerror=alert(1)>. Not counted in results.');
        expect(el.querySelector('img')).toBeNull();
        (el.querySelector('button') as unknown as HTMLButtonElement).click();
        expect(w.sessionStorage.getItem('fabt_preview')).toBeNull();
        expect(replaced()).toBe('https://www.example.com/pricing?a=1');
    });
    it('says when a link no longer works and forgets it', () => {
        const { w, el } = bar({ error: 'This preview link has expired or is no longer valid. Ask for a new one.' });
        expect(el.textContent).toMatch(/expired/);
        expect(w.sessionStorage.getItem('fabt_preview')).toBeNull();
        (el.querySelector('button') as unknown as HTMLButtonElement).click();
        expect(w.document.querySelector('[data-fabt-preview]')).toBeNull();
    });
    it('notes pages outside the test', () => {
        expect(bar({ variation_name: 'B', on_page: false }).el.textContent).toMatch(/not part of the test/);
    });
});

describe('preview copy', () => {
    it('is listed on pricing for every plan and explained in the docs', () => {
        const pricing = fs.readFileSync(path.join(__dirname, '../app/pricing/page.tsx'), 'utf8');
        expect(pricing).toContain("{ name: 'Preview links to check every version before and during a test, never counted in results', tier: 0 }");
        const docs = fs.readFileSync(path.join(__dirname, '../lib/docs/content/variations.ts'), 'utf8');
        expect(docs).toContain("id: 'preview-links'");
        expect(docs).toMatch(/7 days/);
        expect(fs.readFileSync(path.join(__dirname, '../next.config.js'), 'utf8')).toContain('visual|preview).js');
    });
});
