import { NextRequest, NextResponse } from 'next/server';
import { db } from './db';
import { requireUserContext } from './requestAuth';
import { orgIdForProject } from './access';
import { canUseFeature, UPGRADE_NOTE } from './entitlements';
import { PROJECT_COOKIE } from './currentProject';
import { parsePopupConfig } from './popups';

/** The signed-in user's current project for the Popups page, with the plan check. */
export async function popupProject(request: NextRequest): Promise<NextResponse | { projectId: string; orgId: string; userId: string | null; projectIds: string[] }> {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    const selected = request.cookies.get(PROJECT_COOKIE)?.value;
    const projectId = selected && ctx.projectIds.includes(selected) ? selected : ctx.projectIds[0];
    if (!projectId) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const orgId = await orgIdForProject(projectId);
    if (!orgId || !(await canUseFeature(orgId, 'popups'))) {
        return NextResponse.json({ error: 'Popups need a paid plan', upgrade: UPGRADE_NOTE.popups }, { status: 403 });
    }
    return { projectId, orgId, userId: ctx.userId, projectIds: ctx.projectIds };
}

export function popupJson(p: Awaited<ReturnType<typeof db.getPopup>>) {
    if (!p) return null;
    return { id: p.id, name: p.name, status: p.status, config: parsePopupConfig(p.config), created_at: p.created_at, updated_at: p.updated_at };
}
