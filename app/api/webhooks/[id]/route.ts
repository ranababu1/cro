import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { teamContext } from '@/lib/team';
import { canUseFeature, UPGRADE_NOTE } from '@/lib/entitlements';
import { formatZodError } from '@/lib/validation';
import { WEBHOOK_EVENTS, newWebhookSecret, presentWebhook, webhookUrlError } from '@/lib/webhooks';

type Params = { params: Promise<{ id: string }> };
const patchSchema = z.object({
    url: z.string().trim().min(1).max(500),
    events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).max(WEBHOOK_EVENTS.length),
    enabled: z.boolean(),
    rotate_secret: z.literal(true),
}).partial().strict().refine((v) => Object.keys(v).length > 0, 'No changes');

async function load(request: NextRequest, params: Params['params']) {
    const t = await teamContext(request, { owner: true });
    if (t instanceof NextResponse) return { res: t };
    const hook = await db.getWebhook((await params).id);
    // Another organization's endpoint looks the same as a missing one.
    if (!hook || hook.org_id !== t.orgId) return { res: NextResponse.json({ error: 'Webhook not found' }, { status: 404 }) };
    return { t, hook };
}

/** PATCH /api/webhooks/[id] { url?, events?, enabled?, rotate_secret? }: owners only. A new secret is returned once. */
export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
    try {
        const l = await load(request, params);
        if ('res' in l) return l.res!;
        const { t, hook } = l;
        const parsed = patchSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        const { url, events, enabled, rotate_secret } = parsed.data;
        // Turning on, or changing where events go, needs a paid plan. Turning off and deleting always work.
        if ((enabled || url || events || rotate_secret) && !(await canUseFeature(t.orgId, 'webhooks'))) {
            return NextResponse.json({ error: 'Webhooks need a paid plan', upgrade: UPGRADE_NOTE.webhooks }, { status: 403 });
        }
        if (url) {
            const bad = webhookUrlError(url);
            if (bad) return NextResponse.json({ error: bad }, { status: 400 });
        }
        const secret = rotate_secret ? newWebhookSecret() : undefined;
        await db.updateWebhook(hook.id, {
            ...(url ? { url } : {}),
            ...(events ? { events: JSON.stringify([...new Set(events)]) } : {}),
            ...(enabled !== undefined ? { enabled } : {}),
            ...(secret ? { secret } : {}),
        });
        const { rotate_secret: _r, ...changes } = parsed.data;
        void _r;
        if (Object.keys(changes).length) await db.audit({ orgId: t.orgId, actorId: t.userId, entity: 'webhook', entityId: hook.id, action: 'update', diff: { before: { url: hook.url, enabled: hook.enabled }, after: changes } });
        if (secret) await db.audit({ orgId: t.orgId, actorId: t.userId, entity: 'webhook', entityId: hook.id, action: 'secret:rotate' });
        return NextResponse.json({ webhook: presentWebhook((await db.getWebhook(hook.id))!), ...(secret ? { secret } : {}) }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Failed to update webhook:', error);
        return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 });
    }
}

/** DELETE /api/webhooks/[id]: owners only. Queued deliveries for it are removed too. */
export async function DELETE(request: NextRequest, { params }: Params): Promise<NextResponse> {
    const l = await load(request, params);
    if ('res' in l) return l.res!;
    await db.deleteWebhook(l.hook.id);
    await db.audit({ orgId: l.t.orgId, actorId: l.t.userId, entity: 'webhook', entityId: l.hook.id, action: 'delete', diff: { url: l.hook.url } });
    return NextResponse.json({ ok: true });
}
