import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { parseRange, topUsers } from '@/lib/telemetryQueries';
import { METRICS } from '@/lib/telemetry';

export async function GET(request: NextRequest) {
    const admin = await requirePlatformAdmin();
    if (admin instanceof NextResponse) return admin;
    const sp = request.nextUrl.searchParams;
    const { from, to } = parseRange(sp);
    const metric = sp.get('metric') || METRICS.api_key_requests;
    const q = sp.get('q') || '';
    return NextResponse.json(await topUsers(from, to, metric, q));
}
