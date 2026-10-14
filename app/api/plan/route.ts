import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { orgIdForProject } from '@/lib/access';
import { PROJECT_COOKIE } from '@/lib/currentProject';
import { maxVariationUrlsForPlan } from '@/lib/plans';

export async function GET(request: NextRequest) {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    const selected = request.cookies.get(PROJECT_COOKIE)?.value;
    const projectId = selected && ctx.projectIds.includes(selected) ? selected : ctx.projectIds[0];
    if (!projectId) return NextResponse.json({ plan: 'free', max_variations: 1 });
    const org = await db.getOrganization(await orgIdForProject(projectId));
    const plan = org?.plan || 'free';
    return NextResponse.json({ plan, max_variations: maxVariationUrlsForPlan(plan) });
}
