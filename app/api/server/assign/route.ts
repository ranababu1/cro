import { NextRequest, NextResponse } from 'next/server';
import { authenticateServerRequest } from '@/lib/requestAuth';
import { bumpMetric, METRICS } from '@/lib/telemetry';
import { assignVisitor } from '@/lib/sdkFlows';

/** Server SDK: same assignment as /api/assign, authenticated with a secret key instead of a page origin. */
export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateServerRequest(request);
        if ('error' in auth) return auth.error;
        void bumpMetric(METRICS.sdk_assign, { orgId: auth.ctx.orgId, projectId: auth.ctx.projectId });
        const r = await assignVisitor(auth.ctx, await request.json().catch(() => null));
        return NextResponse.json(r.body, { status: r.status });
    } catch (error) {
        console.error('Failed to assign user (server):', error);
        void bumpMetric(METRICS.errors, {});
        return NextResponse.json({ error: 'Failed to assign user' }, { status: 500 });
    }
}
