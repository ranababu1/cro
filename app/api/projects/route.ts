import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatZodError } from '@/lib/validation';
import { getOrgEntitlements } from '@/lib/entitlements';
import { projectLimitMessage, projectNameSchema, teamContext } from '@/lib/team';

/** POST /api/projects { name }: a new project in the current organization, with its own environments and keys. Owners only. */
export async function POST(request: NextRequest) {
    try {
        const t = await teamContext(request, { owner: true });
        if (t instanceof NextResponse) return t;
        const parsed = projectNameSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        const [ent, existing] = await Promise.all([getOrgEntitlements(t.orgId), db.getOrgProjects(t.orgId)]);
        const limit = ent.limits.projects;
        if (limit !== null && existing.length >= limit) return NextResponse.json({ error: projectLimitMessage(limit), reason: 'project_limit' }, { status: 403 });
        if (existing.some((p) => p.name.toLowerCase() === parsed.data.name.toLowerCase())) return NextResponse.json({ error: 'A project with this name already exists' }, { status: 400 });
        const project = await db.createProject(t.orgId, parsed.data.name, t.userId);
        await db.audit({ orgId: t.orgId, actorId: t.userId, entity: 'project', entityId: project.id, action: 'create', diff: { name: project.name } });
        return NextResponse.json({ project: { id: project.id, name: project.name, created_at: project.created_at } }, { status: 201 });
    } catch (error) {
        console.error('Failed to create project:', error);
        return NextResponse.json({ error: 'Failed to create the project' }, { status: 500 });
    }
}
