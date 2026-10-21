import { NextRequest } from 'next/server';
import { getPageviewStatus } from '@/lib/pageviewQuota';
import { authenticateSdkRequest, sdkJson, SDK_CORS_HEADERS } from '@/lib/requestAuth';
import { customEventSchema, formatZodError } from '@/lib/validation';
import { checkSdkOrigin } from '@/lib/sdkOrigin';
import { recordGoalHits } from '@/lib/goalHits';
import { canUseFeature } from '@/lib/entitlements';
import { CUSTOM_CONVERSION_REFUSED } from '@/lib/sdkFlows';

export function OPTIONS() {
    return new Response(null, { status: 204, headers: SDK_CORS_HEADERS });
}

/** Custom event from ABTest.track('name') or ABTest.track('purchase', { revenue: 49.99 }): counts toward every running test with a matching event goal. */
export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateSdkRequest(request);
        if ('error' in auth) return auth.error;
        const origin = await checkSdkOrigin(request, auth.ctx);
        if (!origin.ok) return sdkJson({ error: origin.message }, 403);
        if ((await getPageviewStatus(auth.ctx.orgId)).paused) return sdkJson({ success: true, paused: true }, 202);
        const parsed = customEventSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return sdkJson({ error: formatZodError(parsed.error) }, 400);
        // Custom events and revenue are paid features; the free plan counts clicks on the goal selector only.
        if (!(await canUseFeature(auth.ctx.orgId, 'advanced_goals'))) return sdkJson({ error: CUSTOM_CONVERSION_REFUSED, reason: 'custom_conversion' }, 403);
        const recorded = await recordGoalHits({
            orgId: auth.ctx.orgId,
            projectId: auth.ctx.projectId,
            environmentId: auth.ctx.environmentId,
            userId: parsed.data.user_id,
            eventName: parsed.data.event_name,
            revenue: parsed.data.revenue,
        });
        return sdkJson({ success: true, recorded });
    } catch (error) {
        console.error('custom event failed', error);
        return sdkJson({ error: 'Failed to record event' }, 500);
    }
}
