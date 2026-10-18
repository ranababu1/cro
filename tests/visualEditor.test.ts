import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Window } from 'happy-dom';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';
import { MAX_CHANGES, parseChanges, visualChangesSchema } from '@/lib/visualChanges';
import { createEditorToken, editorUrl, verifyEditorToken, EDITOR_TOKEN_TTL_MS } from '@/lib/visualEditorToken';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import { POST as create } from '@/app/api/experiments/route';
import { PATCH as patch } from '@/app/api/experiments/[id]/route';
import { GET as getChanges, PUT as putChanges } from '@/app/api/experiments/[id]/variations/[variationId]/changes/route';
import { POST as openEditor } from '@/app/api/experiments/[id]/variations/[variationId]/editor/route';
import { GET as editorGet, PUT as editorPut, OPTIONS as editorOptions } from '@/app/api/sdk/visual/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';

const json = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
    new NextRequest(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const pv = (id: string, variationId: string) => ({ params: Promise.resolve({ id, variationId }) });
const CONTROL = 'http://localhost/demo/control.html';
const sample = [
    { selector: 'h1', action: 'text', value: 'Save 20% with annual billing' },
    { selector: '.promo', action: 'hide' },
    { selector: '#cta', action: 'style', name: 'background-color', value: '#0f766e' },
    { selector: '#cta', action: 'attr', name: 'href', value: '/signup?plan=annual' },
];

describe('visual change lists', () => {
    it('accepts text, hide, safe styles and safe attributes only', () => {
        expect(visualChangesSchema.safeParse({ changes: sample }).success).toBe(true);
        const bad = [
            { selector: 'a', action: 'attr', name: 'href', value: 'javascript:alert(1)' },
            { selector: 'img', action: 'attr', name: 'src', value: '//evil.example/x.png' },
            { selector: 'a', action: 'attr', name: 'onclick', value: 'x()' },
            { selector: 'p', action: 'style', name: 'background-image', value: 'url(x)' },
            { selector: 'p', action: 'style', name: 'color', value: 'red;} body{display:none' },
            { selector: 'p', action: 'html', value: '<script>x()</script>' },
            { selector: '', action: 'hide' },
        ];
        for (const c of bad) expect(visualChangesSchema.safeParse({ changes: [c] }).success, JSON.stringify(c)).toBe(false);
        expect(visualChangesSchema.safeParse({ changes: Array(MAX_CHANGES + 1).fill({ selector: 'h1', action: 'hide' }) }).success).toBe(false);
    });
    it('reads broken stored data as no changes', () => {
        expect(parseChanges(null)).toEqual([]);
        expect(parseChanges('{not json')).toEqual([]);
        expect(parseChanges(JSON.stringify([{ selector: 'a', action: 'attr', name: 'href', value: 'javascript:x' }]))).toEqual([]);
        expect(parseChanges(JSON.stringify(sample))).toHaveLength(4);
    });
    it('editor links are signed, scoped to one variation and expire after 2 hours', () => {
        const now = 1_800_000_000_000;
        const t = createEditorToken({ experimentId: 'exp_1', variationId: 'var_1', userId: 'usr_1' }, now);
        expect(verifyEditorToken(t, now + 1000)).toEqual({ experimentId: 'exp_1', variationId: 'var_1', userId: 'usr_1' });
        expect(verifyEditorToken(t, now + EDITOR_TOKEN_TTL_MS + 1)).toBeNull();
        const [payload, mac] = t.split('.');
        const forged = Buffer.from(JSON.stringify({ e: 'exp_1', v: 'var_2', u: 'usr_1', x: now + 1e9 })).toString('base64url');
        expect(verifyEditorToken(`${forged}.${mac}`, now)).toBeNull();
        expect(verifyEditorToken(`${payload}.x${mac.slice(1)}`, now)).toBeNull();
        expect(verifyEditorToken('', now)).toBeNull();
        expect(editorUrl('https://www.example.com/pricing?a=1', t)).toBe(`https://www.example.com/pricing?a=1&fabt_editor=${t}`);
    });
});

describe('visual variations end to end', () => {
    let cleanup: () => void;
    let orgId = '', userId = '', expId = '', visualId = '', controlId = '', key = '';
    beforeAll(async () => {
        cleanup = useTempDatabase();
        const u = await db.createUser({ email: 'visual@example.com', name: 'visual' });
        userId = u.id;
        const ws = await db.ensureWorkspace(u);
        orgId = ws.orgId;
        await db.updateOrganization(ws.orgId, { plan: 'growth' });
        await seedProjectDomain(ws.projectId, 'localhost');
        const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'prod')!;
        key = (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key;
        clearConfigCache();
    });
    afterAll(() => cleanup());

    it('creates a test with a variation that has no URL of its own (Growth and above)', async () => {
        const s = await db.createUser({ email: 'vstarter@example.com', name: 'vstarter' });
        const sw = await db.ensureWorkspace(s);
        await db.updateOrganization(sw.orgId, { plan: 'starter' });
        await seedProjectDomain(sw.projectId, 'localhost');
        session.current = { user: { id: s.id } };
        const locked = await create(json('POST', '/api/experiments', flowExperimentBody({ variations: [{ name: 'Control', url: CONTROL, weight: 50, is_control: true }, { name: 'B', weight: 50, is_control: false }] })));
        expect(locked.status).toBe(403);
        expect((await locked.json()).upgrade).toMatch(/Growth/);
        session.current = { user: { id: userId } };
        const noControlUrl = await create(json('POST', '/api/experiments', flowExperimentBody({ variations: [{ name: 'Control', weight: 50, is_control: true }, { name: 'B', weight: 50, is_control: false }] })));
        expect(noControlUrl.status).toBe(400);
        const res = await create(json('POST', '/api/experiments', flowExperimentBody({
            variations: [{ name: 'Control', url: CONTROL, weight: 50, is_control: true }, { name: 'Annual first', url: '', weight: 50, is_control: false }],
        })));
        expect(res.status).toBe(201);
        const data = await res.json();
        expId = data.experiment.id;
        visualId = data.variations.find((v: { is_control: boolean }) => !v.is_control).id;
        controlId = data.variations.find((v: { is_control: boolean }) => v.is_control).id;
        expect(data.variations.find((v: { id: string }) => v.id === visualId).url).toBeNull();
    });

    it('saves change lists from the dashboard, never on the control or URL variations', async () => {
        session.current = { user: { id: userId } };
        expect((await putChanges(json('PUT', '/x', { changes: [{ selector: 'a', action: 'attr', name: 'href', value: 'javascript:x' }] }), pv(expId, visualId))).status).toBe(400);
        const ok = await putChanges(json('PUT', '/x', { changes: sample }), pv(expId, visualId));
        expect(ok.status).toBe(200);
        expect((await (await getChanges(json('GET', '/x'), pv(expId, visualId))).json()).changes).toHaveLength(4);
        expect((await putChanges(json('PUT', '/x', { changes: sample }), pv(expId, controlId))).status).toBe(400);
        const other = await (await create(json('POST', '/api/experiments', flowExperimentBody({ name: 'URL test' })))).json();
        const urlVar = other.variations.find((v: { is_control: boolean }) => !v.is_control).id;
        expect((await putChanges(json('PUT', '/x', { changes: sample }), pv(other.experiment.id, urlVar))).status).toBe(400);
        expect((await db.getAuditLog(orgId)).some((a) => a.entity_id === expId && a.action === 'variation:changes')).toBe(true);
        session.current = null;
        expect((await putChanges(json('PUT', '/x', { changes: [] }), pv(expId, visualId))).status).toBe(401);
    });

    it('gives the editor a link that only opens this variation on a registered domain', async () => {
        session.current = { user: { id: userId } };
        const r = await openEditor(json('POST', '/x'), pv(expId, visualId));
        const { url } = await r.json();
        expect(url.startsWith(`${CONTROL}?fabt_editor=`)).toBe(true);
        const token = new URL(url).searchParams.get('fabt_editor')!;
        session.current = null;
        expect(editorOptions().headers.get('access-control-allow-headers')).toMatch(/X-Editor-Token/);
        const got = await (await editorGet(json('GET', '/api/sdk/visual', undefined, { 'X-Editor-Token': token }))).json();
        expect(got).toMatchObject({ variation_name: 'Annual first', control_url: CONTROL });
        expect(got.changes).toHaveLength(4);
        expect((await editorGet(json('GET', '/api/sdk/visual', undefined, { 'X-Editor-Token': token, Origin: 'https://evil.example' }))).status).toBe(403);
        expect((await editorGet(json('GET', '/api/sdk/visual', undefined, { 'X-Editor-Token': token + 'x' }))).status).toBe(401);
        const saved = await editorPut(json('PUT', '/api/sdk/visual', { changes: sample.slice(0, 2) }, { 'X-Editor-Token': token }));
        expect(saved.status).toBe(200);
        expect(parseChanges((await db.getVariations(expId)).find((v) => v.id === visualId)!.changes)).toHaveLength(2);
        const controlToken = createEditorToken({ experimentId: expId, variationId: controlId, userId });
        expect((await editorPut(json('PUT', '/api/sdk/visual', { changes: [] }, { 'X-Editor-Token': controlToken }))).status).toBe(400);
        const stranger = createEditorToken({ experimentId: expId, variationId: visualId, userId: 'usr_nobody' });
        expect((await editorGet(json('GET', '/api/sdk/visual', undefined, { 'X-Editor-Token': stranger }))).status).toBe(403);
    });

    it('bootstrap sends the changes only to visitors in the visual variation on the control page', async () => {
        session.current = { user: { id: userId } };
        await putChanges(json('PUT', '/x', { changes: sample }), pv(expId, visualId));
        expect((await patch(json('PATCH', `/api/experiments/${expId}`, { status: 'running' }), { params: Promise.resolve({ id: expId }) })).status).toBe(200);
        clearConfigCache();
        const seen = new Set<string>();
        for (let i = 0; i < 40 && seen.size < 2; i++) {
            const res = await bootstrap(new NextRequest('http://localhost/api/sdk/bootstrap', {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': key, Origin: 'http://localhost', 'User-Agent': 'Mozilla/5.0' },
                body: JSON.stringify({ url: CONTROL, user_id: `visitor-${i}` }),
            }));
            const b = await res.json();
            expect(b.action).toBe('stay');
            if (b.variation_id === visualId) expect(b.changes).toEqual(sample);
            else expect(b.changes).toBeUndefined();
            seen.add(b.variation_id);
        }
        expect(seen).toEqual(new Set([visualId, controlId]));
    });

    it('after a downgrade, saved changes keep showing but editing needs Growth again', async () => {
        await db.updateOrganization(orgId, { plan: 'starter' });
        clearConfigCache();
        session.current = { user: { id: userId } };
        const put = await putChanges(json('PUT', '/x', { changes: [] }), pv(expId, visualId));
        expect(put.status).toBe(403);
        expect((await openEditor(json('POST', '/x'), pv(expId, visualId))).status).toBe(403);
        let served = false;
        for (let i = 0; i < 40 && !served; i++) {
            const b = await (await bootstrap(new NextRequest('http://localhost/api/sdk/bootstrap', {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': key, Origin: 'http://localhost', 'User-Agent': 'Mozilla/5.0' },
                body: JSON.stringify({ url: CONTROL, user_id: `late-${i}` }),
            }))).json();
            if (b.variation_id === visualId) { expect(b.changes).toEqual(sample); served = true; }
        }
        expect(served).toBe(true);
    });
});

describe('visual.js on a page', () => {
    const visual = fs.readFileSync(path.join(__dirname, '../public/visual.js'), 'utf8');
    function page(html: string, cfg: Record<string, unknown>) {
        const w = new Window({ url: 'https://www.example.com/pricing' });
        w.document.body.innerHTML = html;
        (w as unknown as Record<string, unknown>).__ABTestVisual = cfg;
        w.eval(visual);
        return w;
    }
    it('applies every change and then shows the page', () => {
        let shown = 0;
        const w = page('<h1>Monthly</h1><div class="promo">Sale</div><a id="cta" href="/signup">Go</a><img src="/a.png" srcset="/a@2x.png 2x">', {
            changes: [...sample, { selector: 'img', action: 'attr', name: 'src', value: '/b.png' }, { selector: '#cta', action: 'attr', name: 'href', value: 'javascript:alert(1)' }, { selector: '###bad', action: 'hide' }],
            done: () => { shown++; },
        });
        const d = w.document;
        expect(d.querySelector('h1')!.textContent).toBe('Save 20% with annual billing');
        expect((d.querySelector('.promo') as unknown as HTMLElement).style.display).toBe('none');
        const cta = (d.querySelector('#cta') as unknown as HTMLElement).style;
        expect([cta.getPropertyValue('background-color'), cta.getPropertyPriority('background-color')]).toEqual(['#0f766e', 'important']);
        expect(d.querySelector('#cta')!.getAttribute('href')).toBe('/signup?plan=annual');
        expect(d.querySelector('img')!.getAttribute('src')).toBe('/b.png');
        expect(d.querySelector('img')!.hasAttribute('srcset')).toBe(false);
        expect(shown).toBe(1);
    });
    it('never turns change text into markup', () => {
        const w = page('<h1>Hi</h1>', { changes: [{ selector: 'h1', action: 'text', value: '<img src=x onerror=alert(1)>' }], done: () => {} });
        expect(w.document.querySelector('h1')!.children).toHaveLength(0);
        expect(w.document.querySelector('h1')!.textContent).toBe('<img src=x onerror=alert(1)>');
    });
});

describe('SDK wiring for visual changes', () => {
    const src = fs.readFileSync(path.join(__dirname, '../sdk-src/sdk.js'), 'utf8');
    it('loads visual.js only for visual variations or the editor, and keeps the page hidden until changes apply', () => {
        expect(src).toMatch(/data\.changes && data\.changes\.length\) loadModule\('visual\.js', '__ABTestVisual', \{ changes: data\.changes, done: reveal \}\);\s*else reveal\(\);/);
        expect(src).toMatch(/fabt_editor=/);
        expect(src).toMatch(/if \(editorToken && config\.apiUrl\) \{\s*loadModule\('visual\.js'/);
    });
    it('the pricing page lists the visual editor on Growth and the docs explain it', () => {
        const pricing = fs.readFileSync(path.join(__dirname, '../app/pricing/page.tsx'), 'utf8');
        expect(pricing).toContain('Visual editor on Growth and above');
        expect(pricing).not.toMatch(/name: 'Visual editor', p: 4/);
        expect(fs.readFileSync(path.join(__dirname, '../lib/docs/content/variations.ts'), 'utf8')).toContain("id: 'visual-editor'");
    });
});
