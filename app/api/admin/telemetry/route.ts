import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { overviewTotals, parseRange } from '@/lib/telemetryQueries';
import { recordProductEvent, clientIpFromHeaders } from '@/lib/telemetry';

export async function GET(request: NextRequest) {
    const admin = await requirePlatformAdmin();
    if (admin instanceof NextResponse) return admin;
    const { from, to } = parseRange(request.nextUrl.searchParams);
    const data = await overviewTotals(from, to);
    void recordProductEvent({
        action: 'admin.telemetry.overview',
        userId: admin.userId,
        ip: clientIpFromHeaders(request.headers),
        meta: { from, to },
    });
    return NextResponse.json(data);
}
