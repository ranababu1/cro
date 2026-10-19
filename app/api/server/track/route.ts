import { NextRequest, NextResponse } from 'next/server';
import { authenticateServerRequest } from '@/lib/requestAuth';
import { bumpMetric, METRICS } from '@/lib/telemetry';
import { ingestTrack } from '@/lib/sdkFlows';

/**
 * Server SDK: one event or { events: [...] } (up to 50). A page view from a visitor with no stored
 * assignment stores one, so tests decided locally from /api/server/config count visitors as usual.
 */
export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateServerRequest(request);
        if ('error' in auth) return auth.error;
        const r = await ingestTrack(auth.ctx, await request.json().catch(() => null), { storeExposureAssignments: true });
        return NextResponse.json(r.body, { status: r.status });
    } catch (error) {
        console.error('Failed to track event (server):', error);
        void bumpMetric(METRICS.errors, {});
        return NextResponse.json({ error: 'Failed to track event' }, { status: 500 });
    }
}
