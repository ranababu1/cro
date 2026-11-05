import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatZodError } from '@/lib/validation';
import { projectNameSchema, teamContext } from '@/lib/team';
import { deleteProject } from '@/lib/dataRights';
import { PROJECT_COOKIE } from '@/lib/currentProject';

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

/**
 * DELETE /api/projects/[id] { confirm: "<project name>" }: deletes the project with its tests, results, domains, keys,
 * heatmaps, popups and surveys. Owners only. The last project of an organization cannot be deleted.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const t = await teamContext(request, { owner: true });
    if (t instanceof NextResponse) return t;
    const { id } = await params;
    const project = await db.getProject(id);
    if (!project || project.org_id !== t.orgId) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const body = await request.json().catch(() => null) as { confirm?: unknown } | null;
    if (typeof body?.confirm !== 'string' || body.confirm.trim() !== project.name) return NextResponse.json({ error: 'Type the project name to confirm' }, { status: 400 });
    const r = await deleteProject(t.orgId, id);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    await db.audit({ orgId: t.orgId, actorId: t.userId, entity: 'project', entityId: id, action: 'delete', diff: { name: project.name } });
    const res = NextResponse.json({ deleted: true });
    if (request.cookies.get(PROJECT_COOKIE)?.value === id) res.cookies.delete(PROJECT_COOKIE);
    return res;
}
