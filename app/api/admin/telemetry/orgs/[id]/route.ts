import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { db, monthStartIso } from '@/lib/db';
import { parseRange } from '@/lib/telemetryQueries';
import { METRICS } from '@/lib/telemetry';
import { getTenantSummary } from '@/lib/admin';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const admin = await requirePlatformAdmin();
    if (admin instanceof NextResponse) return admin;
    const { id } = await params;
    const summary = await getTenantSummary(id);
    if (!summary) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { from, to } = parseRange(request.nextUrl.searchParams);
    const series = await db.getTelemetryRange({ from, to, scopeType: 'org', scopeId: id });
    const events = await db.listProductEvents({ from, to, orgId: id, limit: 100 });
    const totals: Record<string, number> = {};
    for (const m of Object.values(METRICS)) {
        totals[m] = await db.sumTelemetry({ from, to, scopeType: 'org', scopeId: id, metric: m });
    }
    const monthUsage = await db.getOrgUsage(id, monthStartIso());
    const visitorLimit = summary.org.monthly_visitor_limit;
    const visitorPct = visitorLimit && visitorLimit > 0 ? Math.round((monthUsage.visitors / visitorLimit) * 1000) / 10 : null;
    return NextResponse.json({
        from,
        to,
        org: summary.org,
        members: summary.members,
        projects: summary.projects,
        usage: { month: monthUsage, total: summary.usage.total },
        quota: { visitor_limit: visitorLimit, visitor_pct: visitorPct, plan: summary.org.plan },
        totals,
        series,
        timeline: events,
    });
}
