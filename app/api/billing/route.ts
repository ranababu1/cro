import { NextRequest, NextResponse } from 'next/server';
import { teamContext } from '@/lib/team';
import { billingEnabled } from '@/lib/billing/config';
import { billingStatus } from '@/lib/billing/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/billing: plan and subscription of the current organization. Owners see the details; billing off returns enabled false. */
export async function GET(request: NextRequest) {
    try {
        const t = await teamContext(request);
        if (t instanceof NextResponse) return t;
        if (!billingEnabled()) return NextResponse.json({ enabled: false }, { headers: { 'Cache-Control': 'no-store' } });
        if (t.role !== 'owner') return NextResponse.json({ enabled: true, owner: false }, { headers: { 'Cache-Control': 'no-store' } });
        return NextResponse.json({ ...(await billingStatus(t.orgId)), owner: true }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Failed to load billing:', error);
        return NextResponse.json({ error: 'Failed to load billing' }, { status: 500 });
    }
}
