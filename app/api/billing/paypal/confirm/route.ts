import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { teamContext } from '@/lib/team';
import { formatZodError } from '@/lib/validation';
import { canUseBillingCheckout, paypalConfig } from '@/lib/billing/config';
import { PAYPAL_SUBSCRIPTION_ID, PayPalError } from '@/lib/billing/paypal';
import { billingStatus, syncPayPalSubscription } from '@/lib/billing/service';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ subscription_id: z.string().regex(PAYPAL_SUBSCRIPTION_ID, 'Not a PayPal subscription id') }).strict();

/**
 * POST /api/billing/paypal/confirm { subscription_id }: after the buyer approves in the PayPal window.
 * The server reads the subscription from PayPal and applies it; nothing from the browser is trusted.
 */
export async function POST(request: NextRequest) {
    try {
        const cfg = paypalConfig();
        if (!cfg) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const t = await teamContext(request, { owner: true });
        if (t instanceof NextResponse) return t;
        if (cfg.mode === 'sandbox') {
            const user = await db.getUser(t.userId);
            if (!canUseBillingCheckout(user?.email)) {
                return NextResponse.json({ error: 'Checkout is restricted while billing is in test mode.' }, { status: 403 });
            }
        }
        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        const known = await db.getBillingSubscription('paypal', parsed.data.subscription_id);
        if (!known || known.org_id !== t.orgId) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
        const { sub, result } = await syncPayPalSubscription(cfg, parsed.data.subscription_id, t.userId);
        if (sub.orgId !== t.orgId) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
        return NextResponse.json({ result, state: sub.state, billing: await billingStatus(t.orgId) }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        if (error instanceof PayPalError && error.status === 404) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
        console.error('Failed to confirm a subscription:', error instanceof Error ? error.message : 'error');
        return NextResponse.json({ error: 'Could not confirm the subscription yet. It will update when PayPal tells us.' }, { status: 502 });
    }
}
