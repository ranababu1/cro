import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { teamContext } from '@/lib/team';
import { formatZodError } from '@/lib/validation';
import { generateId } from '@/lib/ids';
import { publicAppOrigin } from '@/lib/publicOrigin';
import { BILLING_PERIODS, PAID_PLANS, paypalConfig } from '@/lib/billing/config';
import { createSubscription } from '@/lib/billing/paypal';
import { fromPayPal } from '@/lib/billing/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ plan: z.enum(PAID_PLANS as [string, ...string[]]), period: z.enum(BILLING_PERIODS as [string, ...string[]]) }).strict();

/**
 * POST /api/billing/subscribe { plan, period }: creates a PayPal subscription for the current organization and
 * returns its id for the PayPal button to approve. Owners only. Nothing is granted here; see confirm and webhook.
 */
export async function POST(request: NextRequest) {
    try {
        const cfg = paypalConfig();
        if (!cfg) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const t = await teamContext(request, { owner: true });
        if (t instanceof NextResponse) return t;
        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        const plan = parsed.data.plan as (typeof PAID_PLANS)[number];
        const period = parsed.data.period as (typeof BILLING_PERIODS)[number];
        const rows = await db.listBillingSubscriptions(t.orgId);
        if (rows.some((r) => r.status === 'ACTIVE' || r.status === 'SUSPENDED')) {
            return NextResponse.json({ error: 'This organization already has a subscription. To change plan, email hello@freeabtest.com.' }, { status: 409 });
        }
        const origin = publicAppOrigin();
        const created = await createSubscription(cfg, {
            planId: cfg.plans[plan][period], orgId: t.orgId, requestId: generateId('bsreq'),
            returnUrl: `${origin}/settings/billing?status=approved`, cancelUrl: `${origin}/settings/billing?status=cancelled`,
        });
        const sub = fromPayPal(cfg, created);
        await db.upsertBillingSubscription({
            orgId: t.orgId, provider: 'paypal', providerSubscriptionId: sub.id, providerPlanId: sub.providerPlanId,
            plan, period, status: sub.providerStatus, createdBy: t.userId,
        });
        return NextResponse.json({ id: sub.id }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Failed to start a subscription:', error instanceof Error ? error.message : 'error');
        return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 502 });
    }
}
