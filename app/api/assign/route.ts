import { NextRequest } from 'next/server';
import { checkSdkOrigin } from '@/lib/sdkOrigin';
import { authenticateSdkRequest, sdkJson, SDK_CORS_HEADERS } from '@/lib/requestAuth';
import { bumpMetric, METRICS } from '@/lib/telemetry';
import { assignVisitor } from '@/lib/sdkFlows';

export function OPTIONS() {
    return new Response(null, { status: 204, headers: SDK_CORS_HEADERS });
}

export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateSdkRequest(request);
        if ('error' in auth) return auth.error;

        // Count every assign request; unique_visitors only when a new assignment is stored.
        void bumpMetric(METRICS.sdk_assign, { orgId: auth.ctx.orgId, projectId: auth.ctx.projectId });

        const origin = await checkSdkOrigin(request, auth.ctx);
        if (!origin.ok) return sdkJson({ error: origin.message }, 403);

        const r = await assignVisitor(auth.ctx, await request.json().catch(() => null));
        return sdkJson(r.body, r.status);
    } catch (error) {
        console.error('Failed to assign user:', error);
        void bumpMetric(METRICS.errors, {});
        return sdkJson({ error: 'Failed to assign user' }, 500);
    }
}
