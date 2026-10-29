import { NextResponse } from 'next/server';
import { db } from '../db';
import { canUseFeature, UPGRADE_NOTE } from '../entitlements';
import { aiConfigured, decryptSecret } from './crypto';
import { AiError, AI_PROVIDERS, PROVIDERS, generateText, isProvider, type AiProvider } from './providers';
import { PageError } from './pageText';
import { takeAiSlot, AI_DAILY_LIMIT, AI_HOURLY_LIMIT } from './usage';

/** Routes that call a provider: room for reading a page plus one model answer. */
export const AI_MAX_DURATION = 60;

export const NOT_CONFIGURED = 'AI features are not available yet. Please check back soon.';

/** What the dashboard shows on the AI settings page. Never includes a key, only its last 4 characters. */
export async function aiStatus(orgId: string) {
    const configured = aiConfigured();
    const [allowed, keys, settings] = await Promise.all([canUseFeature(orgId, 'ai'), db.listAiKeys(orgId), db.getAiSettings(orgId)]);
    const chosen = pickTextProvider(settings?.text_provider ?? null, keys.map((k) => k.provider));
    return {
        configured, allowed, upgrade: allowed ? null : UPGRADE_NOTE.ai,
        providers: AI_PROVIDERS.map((id) => {
            const k = keys.find((x) => x.provider === id);
            const p = PROVIDERS[id];
            return { id, label: p.label, images: p.images, text_models: p.textModels, default_text_model: p.defaultTextModel, key_url: p.keyUrl, key_placeholder: p.keyPlaceholder, key: k ? { last4: k.last4, added_at: k.created_at } : null };
        }),
        text_provider: chosen,
        text_model: chosen ? (settings?.text_provider === chosen && settings.text_model) || PROVIDERS[chosen].defaultTextModel : null,
        ready: configured && allowed && chosen !== null,
        limits: { hourly: AI_HOURLY_LIMIT, daily: AI_DAILY_LIMIT },
    };
}

/** The chosen provider if it has a key, else the first provider with a key. */
function pickTextProvider(chosen: string | null, withKeys: AiProvider[]): AiProvider | null {
    if (isProvider(chosen) && withKeys.includes(chosen)) return chosen;
    return AI_PROVIDERS.find((p) => withKeys.includes(p)) ?? null;
}

export interface AiReady { provider: AiProvider; model: string; key: string }
type Refusal = { error: string; code: string; upgrade?: string };

/** Checks everything before a provider call. Returns the provider, model and key, or a JSON refusal. */
export async function prepareAi(orgId: string, now = Date.now()): Promise<AiReady | NextResponse<Refusal>> {
    if (!aiConfigured()) return NextResponse.json({ error: NOT_CONFIGURED, code: 'not_configured' }, { status: 503 });
    if (!(await canUseFeature(orgId, 'ai'))) return NextResponse.json({ error: UPGRADE_NOTE.ai, code: 'upgrade', upgrade: UPGRADE_NOTE.ai }, { status: 403 });
    const [keys, settings] = await Promise.all([db.listAiKeys(orgId), db.getAiSettings(orgId)]);
    const provider = pickTextProvider(settings?.text_provider ?? null, keys.map((k) => k.provider));
    if (!provider) return NextResponse.json({ error: 'Add an API key for an AI provider in Settings, AI first.', code: 'no_key' }, { status: 400 });
    const row = keys.find((k) => k.provider === provider)!;
    const key = decryptSecret(row.key_enc, orgId, provider);
    if (!key) return NextResponse.json({ error: `The saved ${PROVIDERS[provider].label} key can no longer be read. Add it again in Settings, AI.`, code: 'no_key' }, { status: 400 });
    const slot = await takeAiSlot(orgId, now);
    if (!slot.ok) {
        const msg = slot.window === 'hour' ? `Your organization reached ${AI_HOURLY_LIMIT} AI requests this hour. Try again later.` : `Your organization reached ${AI_DAILY_LIMIT} AI requests in the last 24 hours. Try again tomorrow.`;
        return NextResponse.json({ error: msg, code: 'limit' }, { status: 429 });
    }
    const model = (settings?.text_provider === provider && settings.text_model) || PROVIDERS[provider].defaultTextModel;
    return { provider, model, key };
}

export async function askText(ai: AiReady, p: { system: string; prompt: string; maxTokens?: number }): Promise<string> {
    return generateText({ provider: ai.provider, model: ai.model, key: ai.key, ...p });
}

/** Turns errors from a provider call or a page read into a JSON answer for the dashboard. */
export function aiErrorResponse(err: unknown, what: string, headers?: HeadersInit): NextResponse {
    if (err instanceof AiError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status, headers });
    if (err instanceof PageError) return NextResponse.json({ error: err.message, code: 'page' }, { status: 400, headers });
    console.error(`AI ${what} failed:`, err);
    return NextResponse.json({ error: `Could not ${what}. Try again.` }, { status: 500, headers });
}
