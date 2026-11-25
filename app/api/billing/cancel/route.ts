import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { teamContext } from '@/lib/team';
import { canUseBillingCheckout, paypalConfig } from '@/lib/billing/config';
import { BillingActionError, cancelOrgSubscription } from '@/lib/billing/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/billing/cancel: cancels the organization's PayPal subscription at the end of the current paid period. Owners only. */
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
        const billing = await cancelOrgSubscription(cfg, t.orgId, t.userId);
        return NextResponse.json({ billing }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        if (error instanceof BillingActionError) return NextResponse.json({ error: error.message }, { status: error.status });
        console.error('Failed to cancel subscription:', error instanceof Error ? error.message : 'error');
        return NextResponse.json({ error: 'Could not cancel the subscription. Please try again.' }, { status: 502 });
    }
}
