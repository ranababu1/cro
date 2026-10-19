import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Window } from 'happy-dom';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';
import { cleanMessage, cleanSource, errorFingerprint, errorRows, ERROR_MAX_PER_DAY, OTHER_ERRORS, PAGES_WITH_ERRORS } from '@/lib/jsErrors';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import { flushTelemetry, pendingTelemetry } from '@/lib/telemetry';
import { POST as create } from '@/app/api/experiments/route';
import { PATCH as patch } from '@/app/api/experiments/[id]/route';
import { POST as report } from '@/app/api/sdk/errors/route';
import { GET as errorsReport } from '@/app/api/experiments/[id]/errors/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';

const json = (method: string, url: string, body?: unknown) =>
    new NextRequest(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' }, body: body === undefined ? undefined : JSON.stringify(body) });
const beacon = (key: string, body: unknown) =>
    new NextRequest(`http://localhost/api/sdk/errors?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'text/plain', Origin: 'http://localhost' }, body: JSON.stringify(body) });

describe('error cleaning', () => {
    it('drops personal details and query strings, and fingerprints the cleaned error', () => {
        expect(cleanMessage('Cannot read properties of undefined (reading \'email\') for jane.doe+x@example.com order 1234567')).toBe("Cannot read properties of undefined (reading 'email') for [email] order N");
        expect(cleanMessage('fetch https://api.example.com/v1/users?token=abc failed')).toBe('fetch https://api.example.com/v1/users failed');
        expect(cleanMessage('bad token eyJhbGciOiJIUzI1NiJ9abcdefghijklmnopqrstuvwxyz')).toBe('bad token [token]');
        expect(cleanMessage('   ')).toBe('Unknown error');
        expect(cleanMessage('word '.repeat(200))).toHaveLength(300);
        expect(cleanSource('https://www.example.com/static/app.js?v=12#x')).toBe('www.example.com/static/app.js');
        expect(cleanSource('chrome-extension://abc/content.js')).toBe('chrome-extension');
        expect(errorFingerprint('error', 'a', 'b', 1)).toBe(errorFingerprint('error', 'a', 'b', 1));
        expect(errorFingerprint('error', 'a', 'b', 1)).not.toBe(errorFingerprint('error', 'a', 'b', 2));
    });
    it('merges repeats and counts the page once on its first report', () => {
        const rows = errorRows({ experiment_id: 'e', variation_id: 'v', first: true, errors: [
            { kind: 'error', message: 'Boom 12345', source: 'https://x.com/a.js?1', line: 3, count: 2 },
            { kind: 'error', message: 'Boom 99999', source: 'https://x.com/a.js?2', line: 3, count: 1 },
        ] });
        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({ message: 'Boom N', source: 'x.com/a.js', count: 3 });
        expect(rows[1]).toMatchObject({ fingerprint: PAGES_WITH_ERRORS, count: 1 });
        expect(errorRows({ experiment_id: 'e', variation_id: 'v', errors: [{ kind: 'rejection', message: 'x', count: 1 }] })).toHaveLength(1);
    });
});

describe('error tracking end to end', () => {
    let cleanup: () => void;
    const prevSync = process.env.TELEMETRY_SYNC;
    const t: Record<string, { userId: string; key: string; expId: string; vars: { id: string; is_control: boolean }[] }> = {};
    async function tenant(name: string, plan: string) {
        const u = await db.createUser({ email: `${name}@example.com`, name });
        const ws = await db.ensureWorkspace(u);
        await db.updateOrganization(ws.orgId, { plan });
        await seedProjectDomain(ws.projectId, 'localhost');
        const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'prod')!;
        const key = (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key;
        session.current = { user: { id: u.id } };
        const data = await (await create(json('POST', '/api/experiments', flowExperimentBody()))).json();
        await patch(json('PATCH', `/api/experiments/${data.experiment.id}`, { status: 'running' }), { params: Promise.resolve({ id: data.experiment.id }) });
        return { userId: u.id, key, expId: data.experiment.id as string, vars: data.variations };
    }
    beforeAll(async () => {
        cleanup = useTempDatabase();
        t.free = await tenant('efree', 'free');
        t.paid = await tenant('epaid', 'starter');
        clearConfigCache();
    });
    afterAll(() => { process.env.TELEMETRY_SYNC = prevSync; cleanup(); });
    const err = (message: string, count = 1) => ({ kind: 'error', message, source: 'http://localhost/app.js', line: 10, count });

    it('loads the module only for paid plans and refuses reports from free plans', async () => {
        // Visitors who stay on the page get the module; redirects load it on the version page instead.
        const boot = async (key: string) => {
            for (let i = 0; i < 40; i++) {
                const b = await (await bootstrap(new NextRequest('http://localhost/api/sdk/bootstrap', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': key, Origin: 'http://localhost', 'User-Agent': 'Mozilla/5.0' },
                    body: JSON.stringify({ url: 'http://localhost/demo/control.html', user_id: `v-${i}` }),
                }))).json();
                if (b.action === 'redirect') expect(b.modules).toBeUndefined();
                if (b.action === 'stay' && b.variation_id) return b;
            }
            throw new Error('no visitor stayed');
        };
        expect((await boot(t.paid.key)).modules).toEqual(['errors']);
        expect((await boot(t.free.key)).modules).toBeUndefined();
        const c = t.free.vars[0].id;
        expect((await report(beacon(t.free.key, { experiment_id: t.free.expId, variation_id: c, errors: [err('x')] }))).status).toBe(403);
    });

    it('validates reports against running tests of the project', async () => {
        const c = t.paid.vars[0].id;
        expect((await report(beacon(t.paid.key, { experiment_id: t.paid.expId, variation_id: 'var_nope', errors: [err('x')] }))).status).toBe(400);
        expect((await report(beacon(t.paid.key, { experiment_id: t.free.expId, variation_id: c, errors: [err('x')] }))).status).toBe(404);
        expect((await report(beacon(t.paid.key, { experiment_id: t.paid.expId, variation_id: c, errors: [] }))).status).toBe(400);
        expect((await report(beacon(t.paid.key, { experiment_id: t.paid.expId, variation_id: c, errors: Array(21).fill(err('x')) }))).status).toBe(400);
    });

    it('batches reports in memory and writes them in one flush', async () => {
        process.env.TELEMETRY_SYNC = '0';
        await flushTelemetry();
        const [a, b] = t.paid.vars;
        for (let i = 0; i < 10; i++) expect((await report(beacon(t.paid.key, { experiment_id: t.paid.expId, variation_id: b.is_control ? a.id : b.id, first: true, errors: [err('Cannot read properties of null', 2)] }))).status).toBe(202);
        await report(beacon(t.paid.key, { experiment_id: t.paid.expId, variation_id: b.is_control ? b.id : a.id, first: true, errors: [err('Cannot read properties of null')] }));
        expect(pendingTelemetry()).toBeGreaterThanOrEqual(4);
        const spy = vi.spyOn(db, 'bumpTelemetryBatch');
        await flushTelemetry();
        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
        process.env.TELEMETRY_SYNC = prevSync;
        session.current = { user: { id: t.paid.userId } };
        const r = await (await errorsReport(json('GET', `/api/experiments/${t.paid.expId}/errors?days=7`), { params: Promise.resolve({ id: t.paid.expId }) })).json();
        expect(r.range).toBe(7);
        const variant = r.variations.find((v: { is_control: boolean }) => !v.is_control);
        const control = r.variations.find((v: { is_control: boolean }) => v.is_control);
        expect([variant.errors, variant.pages_with_errors, control.errors, control.pages_with_errors]).toEqual([20, 10, 1, 1]);
        expect(r.top).toHaveLength(1);
        expect(r.top[0]).toMatchObject({ message: 'Cannot read properties of null', source: 'localhost/app.js', line: 10, total: 21 });
        session.current = { user: { id: t.free.userId } };
        const locked = await errorsReport(json('GET', `/api/experiments/${t.free.expId}/errors`), { params: Promise.resolve({ id: t.free.expId }) });
        expect(locked.status).toBe(403);
        expect((await locked.json()).upgrade).toMatch(/paid plans/);
    });

    it('keeps 200 different errors per test per day and counts the rest as other errors', async () => {
        const day = '2026-01-05';
        const v = t.paid.vars[0].id;
        const row = (i: number, count = 1) => ({ day, experiment_id: t.paid.expId, variation_id: v, fingerprint: `fp${i}`, kind: 'error', message: `m${i}`, source: '', line: 0, count });
        await db.bumpTelemetryBatch([], [], Array.from({ length: ERROR_MAX_PER_DAY - 1 }, (_, i) => row(i)));
        await db.bumpTelemetryBatch([], [], [row(500), row(501, 3), row(502, 2), row(0, 4), { ...row(0), fingerprint: PAGES_WITH_ERRORS, kind: 'pages', count: 7 }]);
        const rows = await db.getErrors(t.paid.expId, day, day);
        const m = new Map(rows.map((r) => [r.fingerprint, r.count]));
        expect(m.get('fp500')).toBe(1);
        expect(m.has('fp501')).toBe(false);
        expect(m.get(OTHER_ERRORS)).toBe(5);
        expect(m.get('fp0')).toBe(5);
        expect(m.get(PAGES_WITH_ERRORS)).toBe(7);
        expect(rows.filter((r) => r.fingerprint !== OTHER_ERRORS && r.fingerprint !== PAGES_WITH_ERRORS)).toHaveLength(ERROR_MAX_PER_DAY);
    });
});

describe('errors.js on a page', () => {
    const src = fs.readFileSync(path.join(__dirname, '../public/errors.js'), 'utf8');
    function page() {
        const w = new Window({ url: 'https://www.example.com/pricing' });
        const sdk = w.document.createElement('script');
        sdk.setAttribute('src', 'https://www.freeabtest.com/sdk.js');
        sdk.setAttribute('data-key', 'cro_pk_test');
        w.document.head.appendChild(sdk);
        const sent: Array<{ url: string; body: { first: boolean; errors: Array<{ message: string; count: number }> } }> = [];
        (w as unknown as Record<string, unknown>).fetch = (url: string, init: { body: string }) => { sent.push({ url, body: JSON.parse(init.body) }); return Promise.resolve({}); };
        (w as unknown as Record<string, unknown>).__ABTestMod = { experiment_id: 'exp_1', variation_id: 'var_1' };
        Object.defineProperty(w.document, 'currentScript', { value: { src: 'https://www.freeabtest.com/errors.js' }, configurable: true });
        w.eval(src);
        const fire = (message: string, filename = 'https://www.example.com/app.js', lineno = 4) => w.dispatchEvent(new w.ErrorEvent('error', { message, filename, lineno }));
        const flush = () => (w as unknown as { ABTestErrors: { flush: () => void } }).ABTestErrors.flush();
        return { w, sent, fire, flush };
    }
    it('sends deduplicated counts with the version, ignores its own scripts, and caps reports per page', () => {
        const { sent, fire, flush } = page();
        fire('Boom'); fire('Boom'); fire('Other');
        fire('Ours', 'https://www.freeabtest.com/visual.js');
        flush();
        expect(sent).toHaveLength(1);
        expect(sent[0].url).toBe('https://www.freeabtest.com/api/sdk/errors?key=cro_pk_test');
        expect(sent[0].body).toMatchObject({ experiment_id: 'exp_1', variation_id: 'var_1', first: true });
        expect(sent[0].body.errors.map((e) => [e.message, e.count])).toEqual([['Boom', 2], ['Other', 1]]);
        fire('Boom');
        flush();
        expect(sent[1].body.first).toBe(false);
        expect(sent[1].body.errors.map((e) => [e.message, e.count])).toEqual([['Boom', 1]]);
        flush();
        expect(sent).toHaveLength(2);
        for (let i = 0; i < 40; i++) fire(`E${i}`);
        flush();
        expect(sent[2].body.errors.length).toBe(18);
    });
});

describe('SDK wiring', () => {
    it('loads server-chosen modules from a fixed list without growing the snippet past the claim', () => {
        const sdk = fs.readFileSync(path.join(__dirname, '../sdk-src/sdk.js'), 'utf8');
        expect(sdk).toMatch(/data\.modules && m < data\.modules\.length; m\+\+\) loadModule\(data\.modules\[m\] \+ '\.js', '__ABTestMod', data\)/);
        const types = fs.readFileSync(path.join(__dirname, '../lib/types.ts'), 'utf8');
        expect(types).toMatch(/modules\?: Array<'errors' \| 'popups' \| 'surveys'>/);
    });
});
