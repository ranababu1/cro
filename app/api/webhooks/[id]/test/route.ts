import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { teamContext } from '@/lib/team';
import { canUseFeature, UPGRADE_NOTE } from '@/lib/entitlements';
import { presentWebhook, sendTestPing } from '@/lib/webhooks';

/** POST /api/webhooks/[id]/test: sends a signed ping now and returns how the endpoint answered. Owners only, paid plans. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
    const t = await teamContext(request, { owner: true });
    if (t instanceof NextResponse) return t;
    const hook = await db.getWebhook((await params).id);
    if (!hook || hook.org_id !== t.orgId) return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    if (!(await canUseFeature(t.orgId, 'webhooks'))) return NextResponse.json({ error: 'Webhooks need a paid plan', upgrade: UPGRADE_NOTE.webhooks }, { status: 403 });
    if (!hook.enabled) return NextResponse.json({ error: 'Turn the webhook on first.' }, { status: 400 });
    const result = await sendTestPing(hook);
    await db.audit({ orgId: t.orgId, actorId: t.userId, entity: 'webhook', entityId: hook.id, action: 'ping', diff: { result } });
    const updated = (await db.getWebhook(hook.id))!;
    return NextResponse.json({ ok: result === 'sent', status: updated.last_status, error: result === 'sent' ? null : updated.last_error, webhook: presentWebhook(updated) });
}
