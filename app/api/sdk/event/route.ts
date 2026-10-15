import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticateSdkRequest, sdkJson, SDK_CORS_HEADERS } from '@/lib/requestAuth';
import { customEventSchema, formatZodError } from '@/lib/validation';
import { hostFromRequestHeaders, isHostAllowed } from '@/lib/domains';
import { recordGoalHits } from '@/lib/goalHits';

export function OPTIONS() {
    return new Response(null, { status: 204, headers: SDK_CORS_HEADERS });
}

/** Custom event from ABTest.track('name'): counts toward every running test with a matching event goal. */
export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateSdkRequest(request);
        if ('error' in auth) return auth.error;
        const hosts = await db.getDomainHosts(auth.ctx.projectId);
        const reqHost = hostFromRequestHeaders(request.headers.get('origin'), request.headers.get('referer'));
        if (hosts.length === 0) return sdkJson({ error: 'No domains registered for this project' }, 403);
        if (reqHost && !isHostAllowed(reqHost, hosts)) return sdkJson({ error: 'Domain not allowed' }, 403);
        const parsed = customEventSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return sdkJson({ error: formatZodError(parsed.error) }, 400);
        const recorded = await recordGoalHits({
            orgId: auth.ctx.orgId,
            projectId: auth.ctx.projectId,
            environmentId: auth.ctx.environmentId,
            userId: parsed.data.user_id,
            eventName: parsed.data.event_name,
        });
        return sdkJson({ success: true, recorded });
    } catch (error) {
        console.error('custom event failed', error);
        return sdkJson({ error: 'Failed to record event' }, 500);
    }
}
