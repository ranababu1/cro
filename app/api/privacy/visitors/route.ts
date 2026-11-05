import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { PROJECT_COOKIE } from '@/lib/currentProject';
import { orgIdForProject } from '@/lib/access';
import { eraseVisitor, visitorRef } from '@/lib/dataRights';
import { formatZodError } from '@/lib/validation';

const bodySchema = z.object({ visitor_id: z.string().trim().min(1).max(200).regex(/^[\x21-\x7e]+$/, 'visitor_id must be printable ASCII without spaces') }).strict();

/**
 * DELETE /api/privacy/visitors { visitor_id }: erases one website visitor (a deletion request from one of your visitors).
 * Dashboard: owners, for the selected project. API: a secret key, for its project. The audit log keeps a hash, not the id.
 */
export async function DELETE(request: NextRequest) {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    let projectId: string | undefined;
    if (ctx.via === 'secret_key') projectId = ctx.projectIds[0];
    else {
        const selected = request.cookies.get(PROJECT_COOKIE)?.value;
        projectId = selected && ctx.projectIds.includes(selected) ? selected : ctx.projectIds[0];
    }
    if (!projectId) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const orgId = await orgIdForProject(projectId);
    if (ctx.via === 'session') {
        const m = await db.getMembership(orgId, ctx.userId!);
        if (m?.role !== 'owner') return NextResponse.json({ error: 'Only owners can do this' }, { status: 403 });
    }
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    const r = await eraseVisitor(orgId, projectId, parsed.data.visitor_id);
    await db.audit({ orgId, actorId: ctx.userId, entity: 'visitor', entityId: visitorRef(parsed.data.visitor_id), action: 'erase', diff: { project_id: projectId, ...r } });
    return NextResponse.json({ erased: true, project_id: projectId, ...r });
}
