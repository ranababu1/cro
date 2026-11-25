import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { teamContext } from '@/lib/team';
import { formatZodError } from '@/lib/validation';
import { BILLING_PERIODS, canUseBillingCheckout, PAID_PLANS, paypalConfig } from '@/lib/billing/config';
import { BillingActionError, changeOrgPlan } from '@/lib/billing/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ plan: z.enum(PAID_PLANS as [string, ...string[]]), period: z.enum(BILLING_PERIODS as [string, ...string[]]) }).strict();

/**
 * POST /api/billing/change { plan, period }: upgrades immediately (PayPal revise where supported, else new
 * subscription then cancel old once active) or downgrades at the end of the current paid period. Owners only.
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
        const plan = parsed.data.plan as (typeof PAID_PLANS)[number];
        const period = parsed.data.period as (typeof BILLING_PERIODS)[number];
        const out = await changeOrgPlan(cfg, t.orgId, t.userId, plan, period);
        return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        if (error instanceof BillingActionError) return NextResponse.json({ error: error.message }, { status: error.status });
        console.error('Failed to change plan:', error instanceof Error ? error.message : 'error');
        return NextResponse.json({ error: 'Could not change plan. Please try again.' }, { status: 502 });
    }
}
