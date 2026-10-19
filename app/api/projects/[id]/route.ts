import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatZodError } from '@/lib/validation';
import { projectNameSchema, teamContext } from '@/lib/team';

/** PATCH /api/projects/[id] { name }: rename a project of the current organization. Owners only. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const t = await teamContext(request, { owner: true });
    if (t instanceof NextResponse) return t;
    const { id } = await params;
    const project = await db.getProject(id);
    if (!project || project.org_id !== t.orgId) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const parsed = projectNameSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    const others = (await db.getOrgProjects(t.orgId)).filter((p) => p.id !== id);
    if (others.some((p) => p.name.toLowerCase() === parsed.data.name.toLowerCase())) return NextResponse.json({ error: 'A project with this name already exists' }, { status: 400 });
    await db.renameProject(id, parsed.data.name);
    await db.audit({ orgId: t.orgId, actorId: t.userId, entity: 'project', entityId: id, action: 'rename', diff: { from: project.name, to: parsed.data.name } });
    return NextResponse.json({ project: { id, name: parsed.data.name } });
}
