import fsMod from 'node:fs';
import pathMod from 'node:path';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';
import { aiConfigured, decryptSecret, encryptSecret, encryptionKey, keyHint, AI_KEY_ENV } from '@/lib/ai/crypto';
import { AiError, classifyError, generateText, parseJsonObject, readText, testKey, MODEL_ID, PROVIDERS, type Fetcher } from '@/lib/ai/providers';
import { extractPageText, fetchPageText, pageUrlError, PageError, type PageGetter } from '@/lib/ai/pageText';
import { agreesWithVerdict, parseCopy, parseIdeas, parseSummary, verdictOf } from '@/lib/ai/features';
import { AI_HOURLY_LIMIT, takeAiSlot, hourOf } from '@/lib/ai/usage';
import type { ExperimentResults, VariationMetrics } from '@/lib/types';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));
const page = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/lib/ai/pageText', async (orig) => {
    const real = await orig<typeof import('@/lib/ai/pageText')>();
    return { ...real, fetchPageText: (url: string, opts?: Parameters<typeof real.fetchPageText>[1]) => (opts ? real.fetchPageText(url, opts) : page.fetch(url)) };
});

import { db } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import { GET as getAi, PUT as putAi } from '@/app/api/ai/route';
import { POST as addKey } from '@/app/api/ai/keys/route';
import { DELETE as removeKey } from '@/app/api/ai/keys/[provider]/route';
import { POST as ideasRoute } from '@/app/api/ai/ideas/route';
import { POST as hypothesisRoute } from '@/app/api/ai/hypothesis/route';
import { POST as resultsAi } from '@/app/api/experiments/[id]/ai/route';
import { POST as createExperiment } from '@/app/api/experiments/route';
import { PATCH as patchExperiment } from '@/app/api/experiments/[id]/route';
import { POST as visualAi } from '@/app/api/sdk/visual/ai/route';
import { createEditorToken } from '@/lib/visualEditorToken';

const KEY = Buffer.alloc(32, 7).toString('base64');
const json = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
    new NextRequest(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const openaiAnswer = (content: string) => reply(200, { choices: [{ message: { content }, finish_reason: 'stop' }] });

describe('AI key encryption', () => {
    it('needs a 32-byte base64 key and binds each value to its org and provider', () => {
        expect(aiConfigured({})).toBe(false);
        expect(aiConfigured({ [AI_KEY_ENV]: Buffer.alloc(16).toString('base64') })).toBe(false);
        expect(aiConfigured({ [AI_KEY_ENV]: KEY })).toBe(true);
        const k = encryptionKey({ [AI_KEY_ENV]: KEY })!;
        const enc = encryptSecret('sk-test-1234567890', 'org_a', 'openai', k);
        expect(enc.startsWith('v1.')).toBe(true);
        expect(enc).not.toContain('sk-test');
        expect(encryptSecret('sk-test-1234567890', 'org_a', 'openai', k)).not.toBe(enc);
        expect(decryptSecret(enc, 'org_a', 'openai', k)).toBe('sk-test-1234567890');
        expect(decryptSecret(enc, 'org_b', 'openai', k)).toBeNull();
        expect(decryptSecret(enc, 'org_a', 'gemini', k)).toBeNull();
        expect(decryptSecret(enc, 'org_a', 'openai', Buffer.alloc(32, 1))).toBeNull();
        expect(decryptSecret('garbage', 'org_a', 'openai', k)).toBeNull();
        expect(keyHint('  sk-abcdWXYZ ')).toBe('WXYZ');
    });
});

describe('AI providers', () => {
    it('maps provider errors to clear codes', () => {
        expect(classifyError('openai', 401, { error: { code: 'invalid_api_key' } })).toBe('bad_key');
        expect(classifyError('openai', 429, { error: { code: 'insufficient_quota', message: 'You exceeded your current quota' } })).toBe('quota');
        expect(classifyError('openai', 429, { error: { message: 'Rate limit reached' } })).toBe('rate_limit');
        expect(classifyError('openai', 404, { error: { code: 'model_not_found' } })).toBe('model');
        expect(classifyError('gemini', 400, { error: { status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } })).toBe('bad_key');
        expect(classifyError('gemini', 429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'Resource has been exhausted' } })).toBe('rate_limit');
        expect(classifyError('deepseek', 402, { error: { message: 'Insufficient Balance' } })).toBe('quota');
        expect(classifyError('anthropic', 400, { error: { type: 'invalid_request_error', message: 'Your credit balance is too low' } })).toBe('quota');
        expect(classifyError('anthropic', 529, { error: { type: 'overloaded_error' } })).toBe('provider');
        expect(new AiError('quota').status).toBe(402);
    });

    it('sends each provider its own request shape with the key in a header', async () => {
        const calls: { url: string; init: RequestInit }[] = [];
        const answers: Record<string, unknown> = {
            openai: { choices: [{ message: { content: '{"a":1}' } }] },
            deepseek: { choices: [{ message: { content: '{"a":1}' } }] },
            gemini: { candidates: [{ content: { parts: [{ text: 'thinking', thought: true }, { text: '{"a":1}' }] } }] },
            anthropic: { content: [{ type: 'thinking', thinking: 'x' }, { type: 'text', text: '{"a":1}' }] },
        };
        for (const provider of ['openai', 'deepseek', 'gemini', 'anthropic'] as const) {
            const fetcher: Fetcher = async (url, init) => { calls.push({ url, init }); return reply(200, answers[provider]); };
            const out = await generateText({ provider, key: 'secret-key', model: PROVIDERS[provider].defaultTextModel, system: 'S', prompt: 'P' }, fetcher);
            expect(out).toContain('{"a":1}');
            const last = calls[calls.length - 1];
            expect(JSON.stringify(last.init.headers)).toContain('secret-key');
            expect(last.url).not.toContain('secret-key');
            expect(String(last.init.body)).not.toContain('secret-key');
        }
        expect(calls.map((c) => new URL(c.url).host)).toEqual(['api.openai.com', 'api.deepseek.com', 'generativelanguage.googleapis.com', 'api.anthropic.com']);
        expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ max_completion_tokens: expect.any(Number), response_format: { type: 'json_object' } });
        expect(JSON.parse(String(calls[2].init.body))).toMatchObject({ generationConfig: { responseMimeType: 'application/json' } });
        expect((calls[3].init.headers as Record<string, string>)['anthropic-version']).toBe('2023-06-01');
    });

    it('tests keys with a model list request and reports a bad key', async () => {
        const seen: string[] = [];
        await testKey('gemini', 'k', async (url, init) => { seen.push(`${init.method} ${url}`); return reply(200, { models: [] }); });
        expect(seen[0]).toMatch(/^GET https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models/);
        await expect(testKey('openai', 'k', async () => reply(401, { error: { message: 'Incorrect API key provided: sk-abc***xyz' } }))).rejects.toMatchObject({ code: 'bad_key' });
    });

    it('turns timeouts, refusals and empty answers into errors, and checks model names', async () => {
        const slow: Fetcher = (_u, init) => new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('t'), { name: 'TimeoutError' }))));
        await expect(generateText({ provider: 'openai', key: 'k', model: 'gpt-5.4-mini', system: '', prompt: '' }, slow, 20)).rejects.toMatchObject({ code: 'timeout' });
        await expect(generateText({ provider: 'gemini', key: 'k', model: '../../x', system: '', prompt: '' }, async () => reply(200, {}))).rejects.toMatchObject({ code: 'model' });
        expect(readText('gemini', { promptFeedback: { blockReason: 'SAFETY' } })).toBe('blocked');
        expect(readText('openai', { choices: [{ message: { content: '' } }] })).toBe('bad_output');
        expect(readText('anthropic', { stop_reason: 'refusal', content: [] })).toBe('blocked');
        expect(MODEL_ID.test('claude-haiku-5-5')).toBe(true);
        expect(MODEL_ID.test('a/b')).toBe(false);
        expect(parseJsonObject('```json\n{"x":[1]}\n```')).toEqual({ x: [1] });
        expect(() => parseJsonObject('no json')).toThrow(AiError);
    });
});

describe('reading a page for ideas', () => {
    const html = '<html><head><title>Acme &amp; Co</title><meta name="description" content="Fast plans"><style>.x{}</style><script>alert(1)</script></head><body><h1>Ship faster</h1><p>Teams use Acme.</p><button>Start free trial</button><a class="btn" href="/demo">Book a demo</a></body></html>';
    it('keeps the readable parts', () => {
        const p = extractPageText(html, 'https://acme.test/');
        expect(p).toMatchObject({ title: 'Acme & Co', description: 'Fast plans', headings: ['H1: Ship faster'] });
        expect(p.buttons).toEqual(['Start free trial', 'Book a demo']);
        expect(p.text).toContain('Teams use Acme.');
        expect(p.text).not.toContain('alert');
    });
    it('refuses private hosts, also after a redirect, and follows public redirects', async () => {
        expect(pageUrlError('ftp://x.com')).toMatch(/https/);
        expect(pageUrlError('http://localhost/')).toMatch(/public/);
        expect(pageUrlError('http://10.0.0.1/')).toMatch(/Private/);
        expect(pageUrlError('https://example.com:8443/')).toMatch(/port/);
        const resolve = async (h: string) => (h === 'inside.test' ? ['192.168.1.5'] : ['93.184.216.34']);
        const get: PageGetter = async (url) => (url.includes('/go-in') ? { status: 302, location: 'https://inside.test/admin', body: '' } : url.includes('/hop') ? { status: 301, location: '/final', body: '' } : { status: 200, contentType: 'text/html', body: html });
        await expect(fetchPageText('https://acme.test/go-in', { get, resolve })).rejects.toThrow(/private/);
        await expect(fetchPageText('https://inside.test/', { get, resolve })).rejects.toBeInstanceOf(PageError);
        expect((await fetchPageText('https://acme.test/hop', { get, resolve })).url).toBe('https://acme.test/final');
        await expect(fetchPageText('https://acme.test/x', { get: async () => ({ status: 200, contentType: 'image/png', body: '' }), resolve })).rejects.toThrow(/not a web page/);
    });
});

const vm = (name: string, users: number, conv: number, control = false, chance?: number): VariationMetrics =>
    ({ variation_id: name, variation_name: name, is_control: control, total_users: users, conversions: conv, conversion_rate: users ? conv / users : 0, chance_to_beat_control: chance } as VariationMetrics);
const results = (vars: VariationMetrics[], winner?: string, controlAhead = false): ExperimentResults => ({
    experiment_id: 'e', experiment_name: 'Hero', status: 'running', variations: vars, sample_size: 0, winner,
    goals: [{ goal_id: 'g', goal_name: 'Sign-up', is_primary: true, variations: vars, winner, sequential: { method: 'msprt', alpha: 0.05, threshold: 0.05, comparisons: 1, p_value: winner ? 0.01 : 0.4, is_significant: !!winner, control_ahead: controlAhead } }],
});

describe('AI answers follow the statistics', () => {
    it('uses the same verdict as the results page', () => {
        expect(verdictOf(results([vm('A', 50, 5, true), vm('B', 50, 9)])).kind).toBe('collecting');
        expect(verdictOf(results([vm('A', 500, 50, true), vm('B', 500, 90)], 'B'))).toMatchObject({ kind: 'winner', winner: 'B' });
        expect(verdictOf(results([vm('A', 500, 90, true), vm('B', 500, 50)], undefined, true)).kind).toBe('control_ahead');
        expect(verdictOf(results([vm('A', 500, 50, true), vm('B', 500, 55)])).kind).toBe('no_difference');
    });
    it('rejects a summary that calls a winner the statistics did not', () => {
        const none = { kind: 'no_difference' as const, title: '' };
        expect(agreesWithVerdict('Variation B is the clear winner with a big lift.', none)).toBe(false);
        expect(agreesWithVerdict('B converts significantly better than the control.', none)).toBe(false);
        expect(agreesWithVerdict('There is no winner yet. B is slightly ahead but this may be noise.', none)).toBe(true);
        expect(agreesWithVerdict('There is no significant difference yet.', { kind: 'winner', title: '' })).toBe(false);
        expect(agreesWithVerdict('The control is significantly better than every variant.', { kind: 'control_ahead', title: '' })).toBe(true);
        const r = results([vm('A', 500, 50, true), vm('B', 500, 55)]);
        expect(() => parseSummary('{"summary":"B has won the test.","next_steps":[]}', r)).toThrow(/did not match/);
        expect(parseSummary('{"summary":"No clear difference so far.","next_steps":["Keep it running","a","b","c"]}', r)).toMatchObject({ verdict: { kind: 'no_difference' }, next_steps: ['Keep it running', 'a', 'b'] });
    });
    it('checks and trims ideas and copy', () => {
        const ideas = parseIdeas(JSON.stringify({ ideas: Array.from({ length: 8 }, (_, i) => ({ title: `T${i}`, hypothesis: 'If we, then, because', priority: i ? 'HIGH' : 'urgent' })) }));
        expect(ideas).toHaveLength(5);
        expect(ideas[0].priority).toBe('medium');
        expect(ideas[1].priority).toBe('high');
        expect(() => parseIdeas('{"ideas":[]}')).toThrow(AiError);
        expect(parseCopy('{"suggestions":["\\"Start now\\"","Start now","Get started","Buy"]}', 'Buy')).toEqual(['Start now', 'Get started']);
    });
});

describe('AI routes', () => {
    let cleanup: () => void;
    let userId = '', orgId = '', projectId = '', expId = '', visualId = '';
    const fetchMock = vi.fn<Fetcher>();
    beforeAll(async () => {
        cleanup = useTempDatabase();
        const u = await db.createUser({ email: 'ai@example.com', name: 'AI' });
        userId = u.id;
        const ws = await db.ensureWorkspace(u);
        orgId = ws.orgId; projectId = ws.projectId;
        await seedProjectDomain(projectId, 'localhost');
        session.current = { user: { id: userId } };
        vi.stubGlobal('fetch', fetchMock);
    });
    afterEach(() => { delete process.env[AI_KEY_ENV]; fetchMock.mockReset(); });
    afterAll(() => { vi.unstubAllGlobals(); cleanup(); });

    it('says not available yet without the server key, and never crashes', async () => {
        const s = await (await getAi(json('GET', '/api/ai'))).json();
        expect(s).toMatchObject({ configured: false, ready: false });
        expect((await addKey(json('POST', '/api/ai/keys', { provider: 'openai', key: 'sk-1234567890abcd' }))).status).toBe(503);
        expect((await hypothesisRoute(json('POST', '/api/ai/hypothesis', { name: 'Hero' }))).status).toBe(503);
    });

    it('is locked below Growth with an upgrade note', async () => {
        process.env[AI_KEY_ENV] = KEY;
        const s = await (await getAi(json('GET', '/api/ai'))).json();
        expect(s).toMatchObject({ configured: true, allowed: false });
        expect(s.upgrade).toMatch(/Growth/);
        await db.updateOrganization(orgId, { plan: 'starter' }); clearConfigCache();
        const res = await addKey(json('POST', '/api/ai/keys', { provider: 'openai', key: 'sk-1234567890abcd' }));
        expect(res.status).toBe(403);
        expect((await res.json()).upgrade).toMatch(/Growth/);
        expect((await ideasRoute(json('POST', '/api/ai/ideas', { url: 'https://acme.test/', objective: 'More sign-ups' }))).status).toBe(403);
    });

    it('tests a key before saving, stores it encrypted, and never returns or logs it', async () => {
        process.env[AI_KEY_ENV] = KEY;
        await db.updateOrganization(orgId, { plan: 'growth' }); clearConfigCache();
        fetchMock.mockResolvedValueOnce(reply(401, { error: { message: 'Incorrect API key provided' } }));
        const bad = await addKey(json('POST', '/api/ai/keys', { provider: 'openai', key: 'sk-wrong-000000000' }));
        expect(bad.status).toBe(400);
        expect((await bad.json()).error).toMatch(/did not accept/);
        expect(await db.listAiKeys(orgId)).toHaveLength(0);

        fetchMock.mockResolvedValueOnce(reply(200, { data: [] }));
        const ok = await addKey(json('POST', '/api/ai/keys', { provider: 'openai', key: 'sk-good-1234567890WXYZ' }));
        expect(ok.status).toBe(201);
        const text = await ok.text();
        expect(text).not.toContain('sk-good');
        expect(JSON.parse(text)).toMatchObject({ ready: true, text_provider: 'openai', text_model: PROVIDERS.openai.defaultTextModel });
        expect(JSON.parse(text).providers.find((p: { id: string }) => p.id === 'openai').key.last4).toBe('WXYZ');
        expect(fetchMock.mock.calls[1][0]).toBe('https://api.openai.com/v1/models');
        const [row] = await db.listAiKeys(orgId);
        expect(row.key_enc).not.toContain('sk-good');
        expect(decryptSecret(row.key_enc, orgId, 'openai')).toBe('sk-good-1234567890WXYZ');
        const log = JSON.stringify(await db.getAuditLog(orgId));
        expect(log).toContain('ai_key');
        expect(log).not.toContain('sk-good');
        expect((await putAi(json('PUT', '/api/ai', { text_provider: 'openai', text_model: 'gpt-5.4-nano' }))).status).toBe(200);
        expect((await putAi(json('PUT', '/api/ai', { text_provider: 'gemini', text_model: 'gemini-3.5-flash' }))).status).toBe(400);
        expect((await putAi(json('PUT', '/api/ai', { text_provider: 'openai', text_model: 'bad model!' }))).status).toBe(400);
    });

    it('suggests ideas from a page and hypotheses, using the saved key and model', async () => {
        process.env[AI_KEY_ENV] = KEY;
        page.fetch.mockResolvedValueOnce({ url: 'https://acme.test/', title: 'Acme', description: '', headings: [], buttons: [], text: 'Hello' });
        fetchMock.mockResolvedValueOnce(openaiAnswer(JSON.stringify({ ideas: [{ title: 'Shorter form', hypothesis: 'If we cut fields, then sign-ups rise, because less effort', change: 'Remove 3 fields', priority: 'high' }] })));
        const res = await ideasRoute(json('POST', '/api/ai/ideas', { url: 'https://acme.test/', objective: 'More sign-ups' }));
        expect(res.status).toBe(200);
        expect((await res.json()).ideas[0]).toMatchObject({ title: 'Shorter form', priority: 'high' });
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://api.openai.com/v1/chat/completions');
        expect(JSON.parse(String(init.body)).model).toBe('gpt-5.4-nano');
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-good-1234567890WXYZ');

        expect((await ideasRoute(json('POST', '/api/ai/ideas', { url: 'http://localhost/', objective: 'More sign-ups' }))).status).toBe(400);

        fetchMock.mockResolvedValueOnce(reply(429, { error: { code: 'insufficient_quota', message: 'You exceeded your current quota' } }));
        const quota = await hypothesisRoute(json('POST', '/api/ai/hypothesis', { name: 'Hero headline' }));
        expect(quota.status).toBe(402);
        expect((await quota.json()).code).toBe('quota');

        fetchMock.mockResolvedValueOnce(openaiAnswer('{"suggestions":[{"hypothesis":"If we say X, then Y, because Z","expected_outcome":"Clicks rise 5%"}]}'));
        const h = await hypothesisRoute(json('POST', '/api/ai/hypothesis', { name: 'Hero headline' }));
        expect(h.status).toBe(200);
        expect((await h.json()).suggestions).toHaveLength(1);
    });

    it('explains results without contradicting the verdict, and suggests follow-ups once stopped', async () => {
        process.env[AI_KEY_ENV] = KEY;
        const created = await (await createExperiment(json('POST', '/api/experiments', flowExperimentBody({
            variations: [{ name: 'Control', url: 'http://localhost/demo/control.html', weight: 50, is_control: true }, { name: 'Visual', url: '', weight: 50, is_control: false }],
        })))).json();
        expId = created.experiment.id;
        visualId = created.variations.find((v: { is_control: boolean }) => !v.is_control).id;
        const p = { params: Promise.resolve({ id: expId }) };
        expect((await resultsAi(json('POST', 'x', { kind: 'summary' }), p)).status).toBe(400); // draft
        await patchExperiment(json('PATCH', `/api/experiments/${expId}`, { status: 'running' }), { params: Promise.resolve({ id: expId }) });
        fetchMock.mockResolvedValueOnce(openaiAnswer('{"summary":"Visual is the clear winner.","next_steps":[]}'));
        const wrong = await resultsAi(json('POST', 'x', { kind: 'summary' }), p);
        expect(wrong.status).toBe(502);
        fetchMock.mockResolvedValueOnce(openaiAnswer('{"summary":"It is too early to say. Keep the test running.","next_steps":["Wait for 100 visitors per variation"]}'));
        const ok = await resultsAi(json('POST', 'x', { kind: 'summary' }), p);
        expect(ok.status).toBe(200);
        expect((await ok.json()).verdict.kind).toBe('collecting');
        expect(JSON.parse(String(fetchMock.mock.calls[1][1].body)).messages[1].content).toContain('Verdict from the statistics engine (fixed): Collecting data');
        expect((await resultsAi(json('POST', 'x', { kind: 'followups' }), p)).status).toBe(400);
        await patchExperiment(json('PATCH', `/api/experiments/${expId}`, { status: 'completed' }), { params: Promise.resolve({ id: expId }) });
        fetchMock.mockResolvedValueOnce(openaiAnswer('{"ideas":[{"title":"Bolder headline","hypothesis":"If we, then, because","priority":"low"}]}'));
        const f = await resultsAi(json('POST', 'x', { kind: 'followups' }), p);
        expect(f.status).toBe(200);
        expect((await f.json()).ideas[0].title).toBe('Bolder headline');
    });

    it('suggests copy in the visual editor with the editor token', async () => {
        process.env[AI_KEY_ENV] = KEY;
        const exp = await (await createExperiment(json('POST', '/api/experiments', flowExperimentBody({
            name: 'Copy test', variations: [{ name: 'Control', url: 'http://localhost/demo/control.html', weight: 50, is_control: true }, { name: 'Visual', url: '', weight: 50, is_control: false }],
        })))).json();
        const vid = exp.variations.find((v: { is_control: boolean }) => !v.is_control).id;
        const token = createEditorToken({ experimentId: exp.experiment.id, variationId: vid, userId });
        fetchMock.mockResolvedValueOnce(openaiAnswer('{"suggestions":["Start your free trial","Try it free"]}'));
        const res = await visualAi(json('POST', '/api/sdk/visual/ai', { text: 'Sign up', tag: 'button' }, { 'X-Editor-Token': token }));
        expect(res.status).toBe(200);
        expect(res.headers.get('access-control-allow-origin')).toBe('*');
        expect((await res.json()).suggestions).toEqual(['Start your free trial', 'Try it free']);
        expect((await visualAi(json('POST', '/api/sdk/visual/ai', { text: 'x' }, { 'X-Editor-Token': 'bad' }))).status).toBe(401);
        void visualId;
    });

    it('limits AI requests per organization across servers', async () => {
        const now = Date.parse('2026-10-29T10:30:00Z');
        await db.bumpAiUsage('org_limit', hourOf(now), AI_HOURLY_LIMIT - 1);
        expect(await takeAiSlot('org_limit', now)).toEqual({ ok: true });
        expect(await takeAiSlot('org_limit', now)).toEqual({ ok: false, window: 'hour' });
        expect(await db.sumAiUsage('org_limit', hourOf(now))).toBe(AI_HOURLY_LIMIT);
        expect(await takeAiSlot('org_limit', now + 3_600_000)).toEqual({ ok: true });
        await db.bumpAiUsage('org_day', hourOf(now - 5 * 3_600_000), 300);
        expect(await takeAiSlot('org_day', now)).toEqual({ ok: false, window: 'day' });
    });

    it('removes a key and falls back to no provider', async () => {
        process.env[AI_KEY_ENV] = KEY;
        const res = await removeKey(json('DELETE', '/api/ai/keys/openai'), { params: Promise.resolve({ provider: 'openai' }) });
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ ready: false, text_provider: null });
        expect(await db.listAiKeys(orgId)).toHaveLength(0);
        expect((await db.getAuditLog(orgId)).some((a) => a.entity === 'ai_key' && a.action === 'delete')).toBe(true);
        expect((await removeKey(json('DELETE', '/api/ai/keys/nope'), { params: Promise.resolve({ provider: 'nope' }) })).status).toBe(404);
    });
});

describe('AI public copy', () => {
    const read = (f: string) => fsMod.readFileSync(pathMod.join(__dirname, '..', f), 'utf8');

    it('homepage shows the AI claim only once AI is switched on', () => {
        const home = read('app/page.tsx');
        expect(home).toContain('const aiLive = aiConfigured();');
        expect(home).toMatch(/\{aiLive && \(\s*<section id="ai"/);
        expect(home).toContain("if (!aiConfigured()) return { title: { absolute: HOME_TITLE } };");
        expect(home).not.toMatch(/image/i);
    });

    it('pricing lists AI on Growth and above and docs list every provider', () => {
        const pricing = read('app/pricing/page.tsx');
        expect(pricing).toContain("['AI suggestions with your own key (OpenAI, Gemini, DeepSeek or Claude)', 'Not included (Growth and above)', 'Not included (Growth and above)', 'Included', 'Included']");
        const docs = read('lib/docs/content/ai.ts');
        for (const p of ['OpenAI', 'Gemini', 'DeepSeek', 'Claude', '60 AI requests an hour', '300 a day']) expect(docs).toContain(p);
        expect(docs).not.toMatch(/AI_KEYS|AES|GCM/);
    });
});
