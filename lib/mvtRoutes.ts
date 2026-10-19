import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from './requestAuth';
import { getAccessibleExperiment, orgIdForProject } from './access';
import { canUseFeature } from './entitlements';
import type { Experiment } from './types';

/** Shared loader for the multi-page and multivariate routes: access, org and the Growth feature. */
export async function loadVisualTest(request: NextRequest, id: string): Promise<{ experiment: Experiment; orgId: string; userId: string | null; allowed: boolean } | NextResponse> {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    const experiment = await getAccessibleExperiment(ctx, id);
    if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    const orgId = await orgIdForProject(experiment.project_id);
    if (!orgId) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    return { experiment, orgId, userId: ctx.userId, allowed: await canUseFeature(orgId, 'visual_editor') };
}
