import { NextRequest } from 'next/server';
import { authenticateSdkRequest, sdkJson, SDK_CORS_HEADERS } from '@/lib/requestAuth';
import { checkSdkOrigin } from '@/lib/sdkOrigin';
import { canUseFeature } from '@/lib/entitlements';

export function OPTIONS() {
    return new Response(null, { status: 204, headers: SDK_CORS_HEADERS });
}

/** Heatmap capture ingest. Refused for organizations without the heatmaps entitlement. */
export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateSdkRequest(request);
        if ('error' in auth) return auth.error;
        if (!(await canUseFeature(auth.ctx.orgId, 'heatmaps'))) {
            return sdkJson({ error: 'Heatmaps need a paid plan' }, 403);
        }
        const origin = await checkSdkOrigin(request, auth.ctx);
        if (!origin.ok) return sdkJson({ error: origin.message }, 403);
        // Storage arrives with the heatmaps release; accept and drop until then.
        return sdkJson({ success: true, accepted: 0 }, 202);
    } catch (error) {
        console.error('capture failed', error);
        return sdkJson({ error: 'Failed to record capture' }, 500);
    }
}
