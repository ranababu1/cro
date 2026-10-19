import { NextRequest } from 'next/server';
import { authenticateSdkRequest, sdkJson, SDK_CORS_HEADERS } from '@/lib/requestAuth';
import { checkSdkOrigin } from '@/lib/sdkOrigin';
import { bumpMetric, METRICS } from '@/lib/telemetry';
import { ingestTrack } from '@/lib/sdkFlows';

export function OPTIONS() {
    return new Response(null, { status: 204, headers: SDK_CORS_HEADERS });
}

/** Accepts one event, or { events: [...] } from the SDK's batched sendBeacon. Batches insert in one statement. */
export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateSdkRequest(request);
        if ('error' in auth) return auth.error;

        const origin = await checkSdkOrigin(request, auth.ctx);
        if (!origin.ok) return sdkJson({ error: origin.message }, 403);

        const r = await ingestTrack(auth.ctx, await request.json().catch(() => null));
        return sdkJson(r.body, r.status);
    } catch (error) {
        console.error('Failed to track event:', error);
        void bumpMetric(METRICS.errors, {});
        return sdkJson({ error: 'Failed to track event' }, 500);
    }
}
