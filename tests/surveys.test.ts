import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Window } from 'happy-dom';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain } from './helpers';
import { answerPath, normalizeAnswer, npsScore, responsesCsv, summarizeAnswers, surveyConfigSchema, surveyStats, MAX_SURVEYS_PER_PROJECT, SURVEY_MAX_RESPONSES_PER_DAY, SURVEY_TEMPLATES } from '@/lib/surveys';
import { buildModule } from '../scripts/build-modules.mjs';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import { flushTelemetry, pendingTelemetry } from '@/lib/telemetry';
import { GET as list, POST as create } from '@/app/api/surveys/route';
import { GET as results, PATCH as patch, DELETE as remove } from '@/app/api/surveys/[id]/route';
import { GET as exportCsv } from '@/app/api/surveys/[id]/export/route';
import { POST as event } from '@/app/api/sdk/surveys/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';
import { POST as createPopup } from '@/app/api/popups/route';

const json = (method: string, url: string, body?: unknown) =>
    new NextRequest(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' }, body: body === undefined ? undefined : JSON.stringify(body) });
const beacon = (key: string, body: unknown) =>
    new NextRequest(`http://localhost/api/sdk/surveys?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'text/plain', Origin: 'http://localhost' }, body: JSON.stringify(body) });
const boot = async (key: string, url: string) => (await bootstrap(new NextRequest('http://localhost/api/sdk/bootstrap', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': key, Origin: 'http://localhost', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ url, user_id: 'visitor-1' }),
}))).json();
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const cfg = (over: Record<string, unknown> = {}) => surveyConfigSchema.parse({ question: 'How did you hear about us?', options: ['Search', 'Friend', 'Ad'], ...over });

describe('survey rules', () => {
    it('validates questions', () => {
        expect(cfg()).toMatchObject({ type: 'choice', position: 'bottom-right', comment: false, frequency: 'once', button_text: 'Send' });
        expect(surveyConfigSchema.safeParse({ question: 'q', options: ['Only one'] }).success).toBe(false);
        expect(surveyConfigSchema.safeParse({ question: 'q', options: ['A', 'a'] }).success).toBe(false);
        expect(surveyConfigSchema.safeParse({ question: 'q', options: ['1', '2', '3', '4', '5', '6', '7'] }).success).toBe(false);
        expect(surveyConfigSchema.safeParse({ question: 'q', type: 'rating' }).success).toBe(true);
        expect(surveyConfigSchema.safeParse({ question: 'q', type: 'text', trigger: 'scroll', trigger_value: 101 }).success).toBe(false);
        expect(surveyConfigSchema.safeParse({ question: 'q', type: 'text', position: 'top-bar' }).success).toBe(false);
    });
    it('only accepts answers that fit the question', () => {
        const choice = cfg({ comment: true });
        expect(normalizeAnswer(choice, 'Friend', '  great  ')).toEqual({ answer: 'Friend', comment: 'great' });
        expect(normalizeAnswer(choice, 'Billboard')).toBeNull();
        expect(normalizeAnswer(cfg(), 'Ad', 'dropped when the box is off')).toEqual({ answer: 'Ad', comment: null });
        const rating = cfg({ type: 'rating', options: [] });
        expect(normalizeAnswer(rating, 4)).toEqual({ answer: '4', comment: null });
        expect(normalizeAnswer(rating, '5')).toEqual({ answer: '5', comment: null });
        for (const bad of [0, 6, 2.5, 'x']) expect(normalizeAnswer(rating, bad)).toBeNull();
        const text = cfg({ type: 'text', options: [] });
        expect(normalizeAnswer(text, '   ')).toBeNull();
        expect(normalizeAnswer(text, 'a\u0000b ' + 'x'.repeat(2000))!.answer).toHaveLength(1000);
        expect(answerPath('https://a.com/pricing?email=x#y')).toBe('/pricing');
        expect(answerPath('nope')).toBe('');
    });
    it('summarizes answers and stats, and writes safe CSV', () => {
        const s = summarizeAnswers(cfg({ type: 'rating', options: [] }), [{ answer: '5', count: 3 }, { answer: '2', count: 1 }]);
        expect(s.total).toBe(4);
        expect(s.breakdown.map((b) => b.count)).toEqual([0, 1, 0, 0, 3]);
        expect(s.average).toBe(4.25);
        expect(summarizeAnswers(cfg(), [{ answer: 'Ad', count: 2 }]).breakdown.map((b) => [b.answer, b.count])).toEqual([['Search', 0], ['Friend', 0], ['Ad', 2]]);
        expect(surveyStats([{ survey_id: 's', metric: 'view', count: 4 }, { survey_id: 's', metric: 'response', count: 1 }]).get('s')).toEqual({ views: 4, closes: 0, responses: 1, rate: 0.25 });
        const csv = responsesCsv([{ created_at: 't', answer: '=HYPERLINK("x")', comment: 'a, "b"\nc', path: '/p' }]);
        expect(csv).toBe('time_utc,answer,comment,page\nt,"\'=HYPERLINK(""x"")","a, ""b""\nc",/p\n');
    });
});

describe('NPS and templates', () => {
    it('accepts 0 to 10 and scores promoters minus detractors', () => {
        const nps = cfg({ type: 'nps', options: [], comment: true });
        expect(normalizeAnswer(nps, 0)).toEqual({ answer: '0', comment: null });
        expect(normalizeAnswer(nps, '10', 'Fast support')).toEqual({ answer: '10', comment: 'Fast support' });
        for (const bad of [-1, 11, 7.5, '', ' ', 'nine', null]) expect(normalizeAnswer(nps, bad), String(bad)).toBeNull();
        expect(normalizeAnswer(cfg({ type: 'rating', options: [] }), '')).toBeNull();
        // 5 promoters, 3 passives, 2 detractors: 50% - 20% = 30.
        const rows = [{ answer: '10', count: 3 }, { answer: '9', count: 2 }, { answer: '8', count: 2 }, { answer: '7', count: 1 }, { answer: '6', count: 1 }, { answer: '0', count: 1 }];
        expect(npsScore(rows)).toEqual({ score: 30, promoters: 5, passives: 3, detractors: 2 });
        expect(npsScore([{ answer: '3', count: 4 }])!.score).toBe(-100);
        expect(npsScore([])).toBeNull();
        const sum = summarizeAnswers(nps, rows);
        expect(sum.breakdown.map((b) => b.answer)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
        expect(sum.nps!.score).toBe(30);
        expect(summarizeAnswers(cfg(), []).nps).toBeNull();
    });
    it('has templates that are valid surveys', () => {
        expect(SURVEY_TEMPLATES.map((t) => t.id)).toEqual(['nps', 'blocker', 'source', 'page', 'missing']);
        for (const t of SURVEY_TEMPLATES) expect(surveyConfigSchema.safeParse(t.fields).success, t.id).toBe(true);
    });
});

describe('surveys end to end', () => {
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
        t.free = await tenant('sfree', 'free');
        t.paid = await tenant('spaid', 'starter');
        clearConfigCache();
    });
    afterAll(() => { process.env.TELEMETRY_SYNC = prevSync; cleanup(); });

    it('is paid only', async () => {
        session.current = { user: { id: t.free.userId } };
        const r = await list(json('GET', '/api/surveys'));
        expect(r.status).toBe(403);
        expect((await r.json()).upgrade).toMatch(/paid plans/);
        expect((await create(json('POST', '/api/surveys', { name: 'x', config: cfg() }))).status).toBe(403);
    });

    let surveyId = '';
    it('serves matching active surveys with popups on the same page, and loads each module only when needed', async () => {
        session.current = { user: { id: t.paid.userId } };
        const res = await create(json('POST', '/api/surveys', { name: 'Source', config: cfg({ comment: true, match: 'starts_with', match_value: '/blog' }) }));
        expect(res.status).toBe(201);
        surveyId = (await res.json()).survey.id;
        expect((await boot(t.paid.key, 'http://localhost/blog/a')).surveys).toBeUndefined();
        await patch(json('PATCH', `/api/surveys/${surveyId}`, { status: 'active' }), params(surveyId));
        const b = await boot(t.paid.key, 'http://localhost/blog/a');
        expect(b.modules).toEqual(['surveys']);
        expect(b.surveys[0]).toMatchObject({ id: surveyId, question: 'How did you hear about us?', options: ['Search', 'Friend', 'Ad'], comment: true });
        expect(b.surveys[0].match_value).toBeUndefined();
        expect((await boot(t.paid.key, 'http://localhost/pricing')).modules).toBeUndefined();
        await createPopup(json('POST', '/api/popups', { name: 'p', status: 'active', config: { title: 'T', button_text: 'Go', button_url: '/go' } }));
        expect((await boot(t.paid.key, 'http://localhost/blog/b')).modules).toEqual(['popups', 'surveys']);
        expect((await boot(t.paid.key, 'http://localhost/pricing')).modules).toEqual(['popups']);
    });

    it('batches answers in memory and writes them in one flush', async () => {
        process.env.TELEMETRY_SYNC = '0';
        await flushTelemetry();
        expect((await event(beacon(t.paid.key, { survey_id: 'srv_nope', event: 'view' }))).status).toBe(404);
        expect((await event(beacon(t.paid.key, { survey_id: surveyId, event: 'response', answer: 'Billboard' }))).status).toBe(400);
        for (let i = 0; i < 6; i++) await event(beacon(t.paid.key, { survey_id: surveyId, event: 'view' }));
        expect((await event(beacon(t.paid.key, { survey_id: surveyId, event: 'response', answer: 'Friend', comment: 'Via a podcast', url: 'http://localhost/blog/a?ref=x' }))).status).toBe(202);
        await event(beacon(t.paid.key, { survey_id: surveyId, event: 'response', answer: 'Search' }));
        await event(beacon(t.paid.key, { survey_id: surveyId, event: 'response', answer: 'Friend' }));
        await event(beacon(t.paid.key, { survey_id: surveyId, event: 'close' }));
        expect(pendingTelemetry()).toBeGreaterThanOrEqual(6);
        const spy = vi.spyOn(db, 'bumpTelemetryBatch');
        await flushTelemetry();
        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
        process.env.TELEMETRY_SYNC = prevSync;
        session.current = { user: { id: t.paid.userId } };
        const l = await (await list(json('GET', '/api/surveys'))).json();
        expect(l.max).toBe(MAX_SURVEYS_PER_PROJECT);
        expect(l.surveys[0].stats).toEqual({ views: 6, closes: 1, responses: 3, rate: 0.5 });
        const r = await (await results(json('GET', `/api/surveys/${surveyId}?days=7`), params(surveyId))).json();
        expect(r.range).toBe(7);
        expect(r.answers.breakdown.map((b: { answer: string; count: number }) => [b.answer, b.count])).toEqual([['Search', 1], ['Friend', 2], ['Ad', 0]]);
        expect(r.recent).toHaveLength(1);
        expect(r.recent[0]).toMatchObject({ answer: 'Friend', comment: 'Via a podcast', path: '/blog/a' });
        const csv = await exportCsv(json('GET', `/api/surveys/${surveyId}/export`), params(surveyId));
        expect(csv.headers.get('content-type')).toMatch(/text\/csv/);
        expect(csv.headers.get('content-disposition')).toMatch(/source-last-30-days\.csv/);
        const lines = (await csv.text()).trim().split('\n');
        expect(lines).toHaveLength(4);
        expect(lines[0]).toBe('time_utc,answer,comment,page');
    });

    it('keeps 500 answers per survey per day and still counts the rest', async () => {
        const day = '2026-01-05';
        const row = { day, survey_id: surveyId, answer: 'Ad', comment: null, path: '/' };
        await db.bumpTelemetryBatch([], [], [], [], [{ day, survey_id: surveyId, metric: 'response', count: SURVEY_MAX_RESPONSES_PER_DAY + 5 }], Array(SURVEY_MAX_RESPONSES_PER_DAY + 5).fill(row));
        expect(await db.getSurveyAnswerCounts(surveyId, day, day)).toEqual([{ answer: 'Ad', count: SURVEY_MAX_RESPONSES_PER_DAY }]);
        const stats = await db.getSurveyStats(t.paid.projectId, day, day);
        expect(stats.find((s) => s.metric === 'response')!.count).toBe(SURVEY_MAX_RESPONSES_PER_DAY + 5);
    });

    it('stops after a downgrade, keeps other users out, and deletes answers with the survey', async () => {
        await db.updateOrganization(t.paid.orgId, { plan: 'free' });
        clearConfigCache();
        expect((await boot(t.paid.key, 'http://localhost/blog/a')).surveys).toBeUndefined();
        expect((await event(beacon(t.paid.key, { survey_id: surveyId, event: 'view' }))).status).toBe(403);
        await db.updateOrganization(t.paid.orgId, { plan: 'starter' });
        await db.updateOrganization(t.free.orgId, { plan: 'starter' });
        session.current = { user: { id: t.free.userId } };
        expect((await results(json('GET', `/api/surveys/${surveyId}`), params(surveyId))).status).toBe(404);
        expect((await exportCsv(json('GET', `/api/surveys/${surveyId}/export`), params(surveyId))).status).toBe(404);
        expect((await remove(json('DELETE', `/api/surveys/${surveyId}`), params(surveyId))).status).toBe(404);
        await db.updateOrganization(t.free.orgId, { plan: 'free' });
        session.current = { user: { id: t.paid.userId } };
        expect((await remove(json('DELETE', `/api/surveys/${surveyId}`), params(surveyId))).status).toBe(200);
        expect(await db.getSurveyAnswerCounts(surveyId, '2020-01-01', '2100-01-01')).toEqual([]);
        await db.bumpTelemetryBatch([], [], [], [], [{ day: '2026-01-06', survey_id: surveyId, metric: 'view', count: 1 }], [{ day: '2026-01-06', survey_id: surveyId, answer: 'x', comment: null, path: '' }]);
    });
});

describe('surveys.js on a page', () => {
    const src = fs.readFileSync(path.join(__dirname, '../public/surveys.js'), 'utf8');
    function page(survey: Record<string, unknown>, extra: Record<string, unknown> = {}) {
        const w = new Window({ url: 'https://www.example.com/blog/post?utm=1', width: 1280, height: 800 });
        const sdk = w.document.createElement('script');
        sdk.setAttribute('src', 'https://www.freeabtest.com/sdk.js');
        sdk.setAttribute('data-key', 'cro_pk_test');
        w.document.head.appendChild(sdk);
        const sent: Array<{ url: string; body: { survey_id: string; event: string; answer?: unknown; comment?: string; url?: string } }> = [];
        (w.navigator as unknown as Record<string, unknown>).sendBeacon = undefined;
        (w as unknown as Record<string, unknown>).fetch = (url: string, init: { body: string }) => { sent.push({ url, body: JSON.parse(init.body) }); return Promise.resolve({}); };
        (w as unknown as Record<string, unknown>).__ABTestMod = { matched: false, surveys: [{ id: 'srv_1', question: '<i>How?</i>', type: 'choice', options: ['Search', 'Friend'], comment: true, comment_label: 'More?', button_text: 'Send', thanks: 'Thanks!', position: 'bottom-right', color: '#ff0000', trigger: 'delay', trigger_value: 0, frequency: 'once', device: 'all', ...survey }], ...extra };
        Object.defineProperty(w.document, 'currentScript', { value: { src: 'https://www.freeabtest.com/surveys.js' }, configurable: true });
        w.eval(src);
        const host = () => w.document.querySelector('[data-abtest-survey]') as unknown as { shadowRoot: ShadowRoot } | null;
        return { w, sent, host };
    }
    const tick = () => new Promise((r) => setTimeout(r, 20));
    it('asks the question as plain text, sends the answer and comment once, and never asks again', async () => {
        const { w, sent, host } = page({});
        await tick();
        const root = host()!.shadowRoot;
        expect(root.querySelector('h2')!.textContent).toBe('<i>How?</i>');
        expect(root.querySelector('i')).toBeNull();
        const send = root.querySelector('button.send') as unknown as HTMLButtonElement;
        expect(send.disabled).toBe(true);
        (root.querySelectorAll('button.opt')[1] as unknown as HTMLButtonElement).click();
        expect(send.disabled).toBe(false);
        (root.querySelector('textarea') as unknown as HTMLTextAreaElement).value = ' A podcast ';
        send.click();
        expect(sent.map((s) => s.body.event)).toEqual(['view', 'response']);
        expect(sent[1].url).toBe('https://www.freeabtest.com/api/sdk/surveys?key=cro_pk_test');
        expect(sent[1].body).toMatchObject({ survey_id: 'srv_1', answer: 'Friend', comment: 'A podcast', url: 'https://www.example.com/blog/post?utm=1' });
        expect(root.textContent).toContain('Thanks!');
        w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
        expect(sent).toHaveLength(2);
        expect(w.localStorage.getItem('fabt_srv_srv_1_done')).toBe('1');
    });
    it('sends ratings as numbers and counts a close without an answer', async () => {
        const { w, sent, host } = page({ type: 'rating', options: [], comment: false, frequency: 'every_page' });
        await tick();
        const root = host()!.shadowRoot;
        expect(root.querySelectorAll('button.opt')).toHaveLength(5);
        expect(root.querySelector('textarea')).toBeNull();
        w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
        expect(host()).toBeNull();
        expect(sent.map((s) => s.body.event)).toEqual(['view', 'close']);
        const b = page({ type: 'rating', options: [], comment: false });
        await tick();
        const r2 = b.host()!.shadowRoot;
        (r2.querySelectorAll('button.opt')[3] as unknown as HTMLButtonElement).click();
        (r2.querySelector('button.send') as unknown as HTMLButtonElement).click();
        expect(b.sent[1].body.answer).toBe(4);
    });
    it('shows an 11 point NPS scale and sends the score as a number', async () => {
        const { sent, host } = page({ type: 'nps', options: [], comment: false });
        await tick();
        const root = host()!.shadowRoot;
        const opts = root.querySelectorAll('button.opt');
        expect([...opts].map((o) => o.textContent)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
        expect(root.querySelector('.ends')!.textContent).toBe('Not likelyVery likely');
        (opts[0] as unknown as HTMLButtonElement).click();
        (root.querySelector('button.send') as unknown as HTMLButtonElement).click();
        expect(sent[1].body).toMatchObject({ event: 'response', answer: 0 });
    });
    it('does not open over a popup already on the page', async () => {
        const { w, host } = page({});
        (w as unknown as Record<string, unknown>).__ABTestOverlay = true;
        await tick();
        expect(host()).toBeNull();
    });
});

describe('module build', () => {
    it('builds popups.js and surveys.js from the shared kit, and the outputs are current', () => {
        for (const name of ['popups', 'surveys']) {
            const out = fs.readFileSync(path.join(__dirname, `../public/${name}.js`), 'utf8');
            expect(out).toBe(buildModule(name));
            expect(out).toContain('function shell(attr, id, css, position, label, onClose)');
            expect(out).not.toMatch(/innerHTML/);
        }
    });
    it('uses the generic module loader in the install snippet', () => {
        const sdk = fs.readFileSync(path.join(__dirname, '../sdk-src/sdk.js'), 'utf8');
        expect(sdk).not.toMatch(/surveys\.js|__ABTestSrv/);
        expect(sdk).toMatch(/loadModule\(data\.modules\[m\] \+ '\.js', '__ABTestMod', data\)/);
    });
});
