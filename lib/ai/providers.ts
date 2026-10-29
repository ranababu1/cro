/**
 * AI providers called with the customer's own key, over plain HTTPS with fetch (no SDKs). Text: OpenAI, Gemini,
 * DeepSeek and Claude. Every call has a timeout that fits a serverless function, and provider errors are turned
 * into short messages that never include the key or the provider's raw answer.
 */
export const AI_PROVIDERS = ['openai', 'gemini', 'deepseek', 'anthropic'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export interface ProviderInfo {
    label: string;
    /** Can make images (used by the image feature). DeepSeek and Claude are text only. */
    images: boolean;
    textModels: string[];
    defaultTextModel: string;
    /** Where the customer creates a key. */
    keyUrl: string;
    keyPlaceholder: string;
}

export const PROVIDERS: Record<AiProvider, ProviderInfo> = {
    openai: { label: 'OpenAI', images: true, textModels: ['gpt-5.4-nano', 'gpt-5.4-mini', 'gpt-5.4'], defaultTextModel: 'gpt-5.4-mini', keyUrl: 'https://platform.openai.com/api-keys', keyPlaceholder: 'sk-...' },
    gemini: { label: 'Google Gemini', images: true, textModels: ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash'], defaultTextModel: 'gemini-3.5-flash', keyUrl: 'https://aistudio.google.com/apikey', keyPlaceholder: 'AIza...' },
    deepseek: { label: 'DeepSeek', images: false, textModels: ['deepseek-chat', 'deepseek-reasoner'], defaultTextModel: 'deepseek-chat', keyUrl: 'https://platform.deepseek.com/api_keys', keyPlaceholder: 'sk-...' },
    anthropic: { label: 'Claude (Anthropic)', images: false, textModels: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'], defaultTextModel: 'claude-haiku-5-5', keyUrl: 'https://console.anthropic.com/settings/keys', keyPlaceholder: 'sk-ant-...' },
};

export const isProvider = (v: unknown): v is AiProvider => typeof v === 'string' && (AI_PROVIDERS as readonly string[]).includes(v);

/** Model ids are typed by the customer, so only safe characters are allowed (they go into a URL path for Gemini). */
export const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;

/** A text call must finish well inside the function limit, which leaves room to read the page and save. */
export const TEXT_TIMEOUT_MS = 45_000;
export const KEY_TEST_TIMEOUT_MS = 10_000;
export const MAX_OUTPUT_TOKENS = 6000;

export type AiErrorCode = 'bad_key' | 'quota' | 'rate_limit' | 'model' | 'timeout' | 'provider' | 'bad_output' | 'blocked' | 'network';

const MESSAGES: Record<AiErrorCode, string> = {
    bad_key: 'The provider did not accept this API key. Check it, or add a new key in AI settings.',
    quota: 'Your account with the provider is out of credit or over its quota. Add credit with the provider, then try again.',
    rate_limit: 'The provider is limiting requests from your key right now. Wait a minute and try again.',
    model: 'The provider does not offer this model to your key. Pick another model in AI settings.',
    timeout: 'The provider took too long to answer. Try again, or pick a faster model in AI settings.',
    provider: 'The provider had a problem answering. Try again in a moment.',
    bad_output: 'The answer from the provider could not be used. Try again.',
    blocked: 'The provider declined to answer this request.',
    network: 'Could not reach the provider. Try again in a moment.',
};

/** HTTP status our routes answer with for each error. */
const STATUS: Record<AiErrorCode, number> = { bad_key: 400, quota: 402, rate_limit: 429, model: 400, timeout: 504, provider: 502, bad_output: 502, blocked: 422, network: 502 };

export class AiError extends Error {
    constructor(readonly code: AiErrorCode, message = MESSAGES[code]) {
        super(message);
        this.name = 'AiError';
    }
    get status() { return STATUS[this.code]; }
}

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

function textOf(body: unknown): string {
    try { return JSON.stringify(body).toLowerCase(); } catch { return ''; }
}

/** Maps a failed provider answer to an error code. Exported for tests. */
export function classifyError(provider: AiProvider, status: number, body: unknown): AiErrorCode {
    const t = textOf(body);
    if (status === 401 || status === 403) return 'bad_key';
    if (provider === 'gemini' && status === 400 && /api_key_invalid|api key not valid|api key expired/.test(t)) return 'bad_key';
    if (status === 402) return 'quota';
    if (status === 429) return /insufficient_quota|quota|billing|credit|exceeded your current/.test(t) && !/rate.?limit/.test(t) ? 'quota' : 'rate_limit';
    if (status === 400 && /credit balance|insufficient.?balance|billing/.test(t)) return 'quota';
    if (status === 404 || (status === 400 && /model/.test(t) && /not.?found|does not exist|invalid model|unknown model|not supported/.test(t))) return 'model';
    if (status === 400 && /safety|blocked|content.?policy|moderation/.test(t)) return 'blocked';
    return 'provider';
}

interface Call { url: string; init: RequestInit }

const json = (body: unknown) => JSON.stringify(body);

/** A cheap, free request that proves the key works: list models. */
function keyTestCall(provider: AiProvider, key: string): Call {
    switch (provider) {
        case 'openai': return { url: 'https://api.openai.com/v1/models', init: { method: 'GET', headers: { Authorization: `Bearer ${key}` } } };
        case 'deepseek': return { url: 'https://api.deepseek.com/models', init: { method: 'GET', headers: { Authorization: `Bearer ${key}` } } };
        case 'gemini': return { url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', init: { method: 'GET', headers: { 'x-goog-api-key': key } } };
        case 'anthropic': return { url: 'https://api.anthropic.com/v1/models?limit=1', init: { method: 'GET', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } } };
    }
}

export interface TextRequest { provider: AiProvider; key: string; model: string; system: string; prompt: string; maxTokens?: number }

function textCall(r: TextRequest): Call {
    const max = r.maxTokens ?? MAX_OUTPUT_TOKENS;
    const messages = [{ role: 'system', content: r.system }, { role: 'user', content: r.prompt }];
    switch (r.provider) {
        case 'openai': return {
            url: 'https://api.openai.com/v1/chat/completions',
            init: { method: 'POST', headers: { Authorization: `Bearer ${r.key}`, 'Content-Type': 'application/json' }, body: json({ model: r.model, messages, max_completion_tokens: max, response_format: { type: 'json_object' } }) },
        };
        case 'deepseek': return {
            url: 'https://api.deepseek.com/chat/completions',
            init: { method: 'POST', headers: { Authorization: `Bearer ${r.key}`, 'Content-Type': 'application/json' }, body: json({ model: r.model, messages, max_tokens: Math.min(max, 8000), ...(r.model === 'deepseek-reasoner' ? {} : { response_format: { type: 'json_object' } }) }) },
        };
        case 'gemini': return {
            url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(r.model)}:generateContent`,
            init: {
                method: 'POST', headers: { 'x-goog-api-key': r.key, 'Content-Type': 'application/json' },
                body: json({ systemInstruction: { parts: [{ text: r.system }] }, contents: [{ role: 'user', parts: [{ text: r.prompt }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: max } }),
            },
        };
        case 'anthropic': return {
            url: 'https://api.anthropic.com/v1/messages',
            init: { method: 'POST', headers: { 'x-api-key': r.key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, body: json({ model: r.model, max_tokens: max, system: r.system, messages: [{ role: 'user', content: r.prompt }] }) },
        };
    }
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** The text of a successful answer, or an error code. Exported for tests. */
export function readText(provider: AiProvider, body: unknown): string | AiErrorCode {
    const b = obj(body);
    if (provider === 'openai' || provider === 'deepseek') {
        const choice = obj(arr(b.choices)[0]);
        const msg = obj(choice.message);
        if (typeof msg.refusal === 'string' && msg.refusal) return 'blocked';
        if (choice.finish_reason === 'content_filter') return 'blocked';
        return typeof msg.content === 'string' && msg.content.trim() ? msg.content : 'bad_output';
    }
    if (provider === 'gemini') {
        if (obj(b.promptFeedback).blockReason) return 'blocked';
        const cand = obj(arr(b.candidates)[0]);
        if (cand.finishReason === 'SAFETY' || cand.finishReason === 'PROHIBITED_CONTENT') return 'blocked';
        const text = arr(obj(cand.content).parts).map((p) => (obj(p).thought ? '' : String(obj(p).text ?? ''))).join('');
        return text.trim() ? text : 'bad_output';
    }
    if (b.stop_reason === 'refusal') return 'blocked';
    const text = arr(b.content).filter((c) => obj(c).type === 'text').map((c) => String(obj(c).text ?? '')).join('');
    return text.trim() ? text : 'bad_output';
}

async function send(provider: AiProvider, call: Call, timeoutMs: number, fetcher: Fetcher): Promise<unknown> {
    let res: Response;
    try {
        res = await fetcher(call.url, { ...call.init, signal: AbortSignal.timeout(timeoutMs), redirect: 'error', cache: 'no-store' });
    } catch (err) {
        const name = (err as { name?: string })?.name;
        throw new AiError(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network');
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) {
        const code = classifyError(provider, res.status, body);
        // Only the status and our code are logged: the provider's answer can echo parts of the key.
        console.warn(`AI provider ${provider} answered ${res.status} (${code})`);
        throw new AiError(code);
    }
    return body;
}

/** Checks a key with a free request. Throws AiError. */
export async function testKey(provider: AiProvider, key: string, fetcher: Fetcher = fetch): Promise<void> {
    await send(provider, keyTestCall(provider, key), KEY_TEST_TIMEOUT_MS, fetcher);
}

/** One text answer from the provider (asked for JSON). Throws AiError. */
export async function generateText(r: TextRequest, fetcher: Fetcher = fetch, timeoutMs = TEXT_TIMEOUT_MS): Promise<string> {
    if (!MODEL_ID.test(r.model)) throw new AiError('model');
    const body = await send(r.provider, textCall(r), timeoutMs, fetcher);
    const out = readText(r.provider, body);
    if (out === 'bad_output' || out === 'blocked') throw new AiError(out);
    return out as string;
}

/** First JSON object in a model answer, allowing code fences or text around it. */
export function parseJsonObject(text: string): unknown {
    const t = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '');
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start < 0 || end <= start) throw new AiError('bad_output');
    try { return JSON.parse(t.slice(start, end + 1)); } catch { throw new AiError('bad_output'); }
}
