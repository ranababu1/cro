import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatZodError } from '@/lib/validation';
import { currentProject } from '@/lib/popupRoutes';
import { orgIdForProject } from '@/lib/access';
import { ideaJson, updateIdeaSchema, type IdeaRow } from '@/lib/planner';

type Params = { params: Promise<{ id: string }> };

async function load(request: NextRequest, id: string): Promise<NextResponse | { idea: IdeaRow; orgId: string; userId: string | null }> {
    const r = await currentProject(request);
    if (r instanceof NextResponse) return r;
    const idea = await db.getIdea(id);
    // Reached through one of the user's projects, never by id alone.
    if (!idea || !r.projectIds.includes(idea.project_id)) return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    const orgId = await orgIdForProject(idea.project_id);
    if (!orgId) return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    return { idea, orgId, userId: r.userId };
}

export async function GET(request: NextRequest, { params }: Params) {
    try {
        const r = await load(request, (await params).id);
        if (r instanceof NextResponse) return r;
        return NextResponse.json({ idea: ideaJson(r.idea) });
    } catch (error) {
        console.error('Failed to read idea:', error);
        return NextResponse.json({ error: 'Failed to load the idea' }, { status: 500 });
    }
}

/** PATCH /api/ideas/[id]: edit fields, move between columns, or link the test made from it. */
export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const r = await load(request, (await params).id);
        if (r instanceof NextResponse) return r;
        const parsed = updateIdeaSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        const u = parsed.data;
        if (u.experiment_id) {
            const e = await db.getExperiment(u.experiment_id);
            if (!e || e.project_id !== r.idea.project_id) return NextResponse.json({ error: 'That test is not in this project' }, { status: 400 });
            if (!u.status) u.status = 'started';
        }
        const idea = await db.updateIdea(r.idea.id, u);
        await db.audit({ orgId: r.orgId, actorId: r.userId, entity: 'idea', entityId: r.idea.id, action: u.experiment_id ? 'idea:start' : 'update', diff: u });
        return NextResponse.json({ idea: idea ? ideaJson(idea) : null });
    } catch (error) {
        console.error('Failed to update idea:', error);
        return NextResponse.json({ error: 'Failed to save the idea' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const r = await load(request, (await params).id);
        if (r instanceof NextResponse) return r;
        await db.deleteIdea(r.idea.id);
        await db.audit({ orgId: r.orgId, actorId: r.userId, entity: 'idea', entityId: r.idea.id, action: 'delete', diff: { title: r.idea.title } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete idea:', error);
        return NextResponse.json({ error: 'Failed to delete the idea' }, { status: 500 });
    }
}
