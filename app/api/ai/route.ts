import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { teamContext } from '@/lib/team';
import { formatZodError } from '@/lib/validation';
import { aiStatus } from '@/lib/ai/service';
import { AI_PROVIDERS, MODEL_ID } from '@/lib/ai/providers';

/** GET /api/ai: AI settings of the organization (which providers have a key, the chosen provider and model). Keys are never returned. */
export async function GET(request: NextRequest) {
    try {
        const t = await teamContext(request);
        if (t instanceof NextResponse) return t;
        return NextResponse.json({ ...(await aiStatus(t.orgId)), owner: t.role === 'owner' }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Failed to load AI settings:', error);
        return NextResponse.json({ error: 'Failed to load AI settings' }, { status: 500 });
    }
}

const settingsSchema = z.object({
    text_provider: z.enum(AI_PROVIDERS),
    text_model: z.string().trim().regex(MODEL_ID, 'Model names use letters, numbers, dots, dashes, colons and underscores.'),
}).strict();

/** PUT /api/ai { text_provider, text_model }: the provider and model used for text. Owners only. */
export async function PUT(request: NextRequest) {
    try {
        const t = await teamContext(request, { owner: true });
        if (t instanceof NextResponse) return t;
        const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        if (!(await db.getAiKey(t.orgId, parsed.data.text_provider))) return NextResponse.json({ error: 'Add a key for this provider first.' }, { status: 400 });
        const before = await db.getAiSettings(t.orgId);
        await db.setAiSettings(t.orgId, { text_provider: parsed.data.text_provider, text_model: parsed.data.text_model }, t.userId);
        await db.audit({ orgId: t.orgId, actorId: t.userId, entity: 'ai_settings', entityId: t.orgId, action: 'update', diff: { text_provider: parsed.data.text_provider, text_model: parsed.data.text_model, ...(before?.text_provider ? { was: `${before.text_provider} ${before.text_model ?? ''}`.trim() } : {}) } });
        return NextResponse.json({ ...(await aiStatus(t.orgId)), owner: true });
    } catch (error) {
        console.error('Failed to save AI settings:', error);
        return NextResponse.json({ error: 'Failed to save AI settings' }, { status: 500 });
    }
}
