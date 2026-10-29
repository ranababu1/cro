import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { teamContext } from '@/lib/team';
import { canUseFeature, UPGRADE_NOTE } from '@/lib/entitlements';
import { formatZodError } from '@/lib/validation';
import { aiConfigured, encryptSecret, keyHint } from '@/lib/ai/crypto';
import { AI_PROVIDERS, AiError, PROVIDERS, testKey } from '@/lib/ai/providers';
import { aiStatus, NOT_CONFIGURED } from '@/lib/ai/service';

export const maxDuration = 30;

const keySchema = z.object({
    provider: z.enum(AI_PROVIDERS),
    key: z.string().trim().min(10, 'That does not look like an API key.').max(400).regex(/^[\x21-\x7e]+$/, 'An API key has no spaces or special characters.'),
}).strict();

/**
 * POST /api/ai/keys { provider, key }: tests the key with a free request to the provider, then stores it encrypted.
 * Owners only, Growth and above. The key is never sent back or written to the audit log; only its last 4 characters are kept in plain text.
 */
export async function POST(request: NextRequest) {
    try {
        const t = await teamContext(request, { owner: true });
        if (t instanceof NextResponse) return t;
        if (!aiConfigured()) return NextResponse.json({ error: NOT_CONFIGURED, code: 'not_configured' }, { status: 503 });
        if (!(await canUseFeature(t.orgId, 'ai'))) return NextResponse.json({ error: UPGRADE_NOTE.ai, code: 'upgrade', upgrade: UPGRADE_NOTE.ai }, { status: 403 });
        const parsed = keySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        const { provider, key } = parsed.data;
        try {
            await testKey(provider, key);
        } catch (err) {
            if (err instanceof AiError) {
                // A key that is valid but out of credit or rate limited is still saved: it works once the account is topped up.
                if (err.code !== 'quota' && err.code !== 'rate_limit') return NextResponse.json({ error: `${PROVIDERS[provider].label}: ${err.message}`, code: err.code }, { status: 400 });
            } else throw err;
        }
        const existed = !!(await db.getAiKey(t.orgId, provider));
        await db.upsertAiKey({ org_id: t.orgId, provider, key_enc: encryptSecret(key, t.orgId, provider), last4: keyHint(key), created_by: t.userId });
        const settings = await db.getAiSettings(t.orgId);
        if (!settings?.text_provider) await db.setAiSettings(t.orgId, { text_provider: provider, text_model: PROVIDERS[provider].defaultTextModel }, t.userId);
        await db.audit({ orgId: t.orgId, actorId: t.userId, entity: 'ai_key', entityId: provider, action: existed ? 'update' : 'create', diff: { provider: PROVIDERS[provider].label } });
        return NextResponse.json({ ...(await aiStatus(t.orgId)), owner: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Failed to save AI key:', (error as Error)?.name ?? 'error');
        return NextResponse.json({ error: 'Failed to save the key' }, { status: 500 });
    }
}
