import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { teamContext } from '@/lib/team';
import { canUseBillingCheckout, paypalConfig } from '@/lib/billing/config';
import { getOrgEntitlements } from '@/lib/entitlements';
import { billingStatus } from '@/lib/billing/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/billing: the plan of the current organization, for every member. Owners also get the subscription details
 * when paid checkout is available to them. `enabled` says whether paid checkout can be used (it is off until PayPal
 * is configured, and in test mode only for test accounts); the plan itself is always returned.
 */
export async function GET(request: NextRequest) {
    try {
        const t = await teamContext(request);
        if (t instanceof NextResponse) return t;
        const headers = { 'Cache-Control': 'no-store' };
        const cfg = paypalConfig();
        let enabled = !!cfg;
        if (cfg?.mode === 'sandbox') {
            const user = await db.getUser(t.userId);
            enabled = canUseBillingCheckout(user?.email);
        }
        const ent = await getOrgEntitlements(t.orgId);
        const owner = t.role === 'owner';
        if (!owner) return NextResponse.json({ enabled, owner: false, plan: ent.plan }, { headers });
        if (!enabled) return NextResponse.json({ enabled: false, owner: true, plan: ent.plan, plan_source: ent.planSource }, { headers });
        return NextResponse.json({ ...(await billingStatus(t.orgId)), owner: true }, { headers });
    } catch (error) {
        console.error('Failed to load billing:', error);
        return NextResponse.json({ error: 'Failed to load billing' }, { status: 500 });
    }
}
