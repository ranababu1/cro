import { NextRequest, NextResponse } from 'next/server';
import { db } from './db';
import { requireUserContext } from './requestAuth';
import { orgIdForProject } from './access';
import { canUseFeature, UPGRADE_NOTE } from './entitlements';
import { PROJECT_COOKIE } from './currentProject';
import { parsePopupConfig } from './popups';

type Feature = 'popups' | 'surveys' | 'heatmaps';
const LOCKED: Record<Feature, string> = { popups: 'Popups need a paid plan', surveys: 'Surveys need a paid plan', heatmaps: 'Heatmaps need a paid plan' };

/** The signed-in user's current project for the Popups page, with the plan check. */
export function popupProject(request: NextRequest) {
    return featureProject(request, 'popups');
}

/** The signed-in user's current project (from the project switcher), on any plan. */
export async function currentProject(request: NextRequest): Promise<NextResponse | { projectId: string; orgId: string; userId: string | null; projectIds: string[] }> {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    const selected = request.cookies.get(PROJECT_COOKIE)?.value;
    const projectId = selected && ctx.projectIds.includes(selected) ? selected : ctx.projectIds[0];
    if (!projectId) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const orgId = await orgIdForProject(projectId);
    if (!orgId) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return { projectId, orgId, userId: ctx.userId, projectIds: ctx.projectIds };
}

/** The signed-in user's current project (from the project switcher) for a paid site feature, with the plan check. */
export async function featureProject(request: NextRequest, feature: Feature): Promise<NextResponse | { projectId: string; orgId: string; userId: string | null; projectIds: string[] }> {
    const r = await currentProject(request);
    if (r instanceof NextResponse) return r;
    if (!(await canUseFeature(r.orgId, feature))) {
        return NextResponse.json({ error: LOCKED[feature], upgrade: UPGRADE_NOTE[feature] }, { status: 403 });
    }
    return r;
}

/**
 * Scopes a request to the project that owns a popup or survey. The current project from the switcher may be in another
 * organization, so the plan check and the audit entry use the owner's organization.
 */
export async function ownerScope(
    r: { projectId: string; orgId: string; userId: string | null; projectIds: string[] },
    ownerProjectId: string,
    feature: Feature,
): Promise<NextResponse | { projectId: string; orgId: string; userId: string | null; projectIds: string[] }> {
    if (ownerProjectId === r.projectId) return r;
    const orgId = await orgIdForProject(ownerProjectId);
    if (orgId === r.orgId) return { ...r, projectId: ownerProjectId };
    if (!(await canUseFeature(orgId, feature))) return NextResponse.json({ error: LOCKED[feature], upgrade: UPGRADE_NOTE[feature] }, { status: 403 });
    return { ...r, projectId: ownerProjectId, orgId };
}

export function popupJson(p: Awaited<ReturnType<typeof db.getPopup>>) {
    if (!p) return null;
    return { id: p.id, name: p.name, status: p.status, config: parsePopupConfig(p.config), created_at: p.created_at, updated_at: p.updated_at };
}
