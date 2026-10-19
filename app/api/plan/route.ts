import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/lib/requestAuth';
import { orgIdForProject } from '@/lib/access';
import { PROJECT_COOKIE } from '@/lib/currentProject';
import { getPageviewStatus } from '@/lib/pageviewQuota';
import { getOrgEntitlements } from '@/lib/entitlements';

export async function GET(request: NextRequest) {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    const selected = request.cookies.get(PROJECT_COOKIE)?.value;
    const projectId = selected && ctx.projectIds.includes(selected) ? selected : ctx.projectIds[0];
    if (!projectId) return NextResponse.json({ plan: 'free', max_variations: 1, features: { heatmaps: false, recordings: false, raw_capture: false } });
    const orgId = await orgIdForProject(projectId);
    const pv = await getPageviewStatus(orgId, { fresh: true });
    const ent = await getOrgEntitlements(orgId);
    return NextResponse.json({ plan: ent.plan, features: ent.features, max_variations: ent.limits.maxVariations, pageviews: { used: pv.used, limit: pv.limit, paused: pv.paused } });
}
