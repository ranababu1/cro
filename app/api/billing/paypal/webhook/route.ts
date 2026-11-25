import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paypalConfig } from '@/lib/billing/config';
import { PayPalError, verifyWebhookSignature } from '@/lib/billing/paypal';
import { PAYPAL_EVENTS, subscriptionIdOfEvent, syncPayPalSubscription } from '@/lib/billing/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY = 256 * 1024;

/**
 * POST /api/billing/paypal/webhook: PayPal event notifications. Each delivery is checked with PayPal's
 * verify-webhook-signature API using the raw body, handled once per event id, and only triggers a fresh read of the
 * subscription from PayPal. Errors answer 5xx so PayPal retries.
 */
export async function POST(request: NextRequest) {
    const cfg = paypalConfig();
    if (!cfg) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const raw = await request.text();
    if (raw.length > MAX_BODY) return NextResponse.json({ error: 'Too large' }, { status: 413 });
    if (!(await verifyWebhookSignature(cfg, raw, request.headers))) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });

    const event = JSON.parse(raw) as { id?: unknown; event_type?: unknown; resource?: unknown };
    const eventId = typeof event.id === 'string' ? event.id : null;
    const type = typeof event.event_type === 'string' ? event.event_type : '';
    if (!eventId) return NextResponse.json({ error: 'No event id' }, { status: 400 });
    const subscriptionId = subscriptionIdOfEvent(event);

    try {
        const fresh = await db.claimBillingWebhookEvent({ id: eventId, provider: 'paypal', eventType: type, resourceId: subscriptionId });
        if (!fresh) return NextResponse.json({ ok: true, duplicate: true });
        if (!(PAYPAL_EVENTS as readonly string[]).includes(type) || !subscriptionId) {
            await db.finishBillingWebhookEvent(eventId, 'ignored');
            return NextResponse.json({ ok: true, ignored: true });
        }
        let result: string;
        try {
            result = (await syncPayPalSubscription(cfg, subscriptionId)).result;
        } catch (e) {
            // A subscription PayPal does not know (or not ours to read) will not get better on retry.
            if (e instanceof PayPalError && (e.status === 400 || e.status === 404)) result = 'not_found';
            else throw e;
        }
        await db.finishBillingWebhookEvent(eventId, result);
        return NextResponse.json({ ok: true, result });
    } catch (error) {
        console.error('PayPal webhook failed:', type, error instanceof Error ? error.message : 'error');
        return NextResponse.json({ error: 'Try again' }, { status: 500 });
    }
}
