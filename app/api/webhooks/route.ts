import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { teamContext } from '@/lib/team';
import { canUseFeature, UPGRADE_NOTE } from '@/lib/entitlements';
import { formatZodError } from '@/lib/validation';
import { generateId } from '@/lib/ids';
import { EVENT_LABELS, MAX_WEBHOOKS, WEBHOOK_EVENTS, newWebhookSecret, presentWebhook, webhookUrlError } from '@/lib/webhooks';

const createSchema = z.object({
    url: z.string().trim().min(1).max(500),
    events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).max(WEBHOOK_EVENTS.length),
}).strict();

/** GET /api/webhooks: endpoints and recent deliveries for the current organization. */
export async function GET(request: NextRequest) {
    const t = await teamContext(request);
    if (t instanceof NextResponse) return t;
    const [allowed, hooks, deliveries] = await Promise.all([canUseFeature(t.orgId, 'webhooks'), db.listWebhooks(t.orgId), db.listWebhookDeliveries(t.orgId, 30)]);
    return NextResponse.json({
        allowed, owner: t.role === 'owner', upgrade: allowed ? null : UPGRADE_NOTE.webhooks,
        events: WEBHOOK_EVENTS.map((e) => ({ id: e, label: EVENT_LABELS[e] })), max: MAX_WEBHOOKS,
        webhooks: hooks.map(presentWebhook), deliveries,
    });
}

/** POST /api/webhooks { url, events }: adds an endpoint. Owners only, paid plans. The signing secret is returned once. */
export async function POST(request: NextRequest) {
    try {
        const t = await teamContext(request, { owner: true });
        if (t instanceof NextResponse) return t;
        if (!(await canUseFeature(t.orgId, 'webhooks'))) return NextResponse.json({ error: 'Webhooks need a paid plan', upgrade: UPGRADE_NOTE.webhooks }, { status: 403 });
        const parsed = createSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        const bad = webhookUrlError(parsed.data.url);
        if (bad) return NextResponse.json({ error: bad }, { status: 400 });
        if ((await db.listWebhooks(t.orgId)).length >= MAX_WEBHOOKS) return NextResponse.json({ error: `You can add up to ${MAX_WEBHOOKS} webhooks.` }, { status: 400 });
        const id = generateId('whk');
        const secret = newWebhookSecret();
        const events = JSON.stringify([...new Set(parsed.data.events)]);
        await db.createWebhook({ id, org_id: t.orgId, url: parsed.data.url, secret, events, created_by: t.userId });
        await db.audit({ orgId: t.orgId, actorId: t.userId, entity: 'webhook', entityId: id, action: 'create', diff: { url: parsed.data.url, events: parsed.data.events } });
        return NextResponse.json({ webhook: presentWebhook((await db.getWebhook(id))!), secret }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Failed to add webhook:', error);
        return NextResponse.json({ error: 'Failed to add webhook' }, { status: 500 });
    }
}
