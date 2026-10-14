import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { db } from '@/lib/db';
import { parseRange } from '@/lib/telemetryQueries';
import { METRICS } from '@/lib/telemetry';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const admin = await requirePlatformAdmin();
    if (admin instanceof NextResponse) return admin;
    const { id } = await params;
    const user = await db.getUser(id);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { from, to } = parseRange(request.nextUrl.searchParams);
    const series = await db.getTelemetryRange({ from, to, scopeType: 'user', scopeId: id });
    const events = await db.listProductEvents({ from, to, userId: id, limit: 100 });
    const memberships = await db.getProjectsForUser(id);
    const totals: Record<string, number> = {};
    for (const m of Object.values(METRICS)) {
        totals[m] = await db.sumTelemetry({ from, to, scopeType: 'user', scopeId: id, metric: m });
    }
    return NextResponse.json({
        from,
        to,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            created_at: user.created_at,
            last_active_at: user.last_active_at,
            last_login_at: user.last_login_at,
        },
        projects: memberships,
        totals,
        series,
        timeline: events,
    });
}
