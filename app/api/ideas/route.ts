import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatZodError } from '@/lib/validation';
import { currentProject } from '@/lib/popupRoutes';
import { createIdeaSchema, ideaJson, MAX_IDEAS } from '@/lib/planner';

/** GET /api/ideas: test ideas of the current project, newest change first. All plans. */
export async function GET(request: NextRequest) {
    try {
        const r = await currentProject(request);
        if (r instanceof NextResponse) return r;
        return NextResponse.json({ project_id: r.projectId, max: MAX_IDEAS, ideas: (await db.listIdeas(r.projectId)).map(ideaJson) });
    } catch (error) {
        console.error('Failed to list ideas:', error);
        return NextResponse.json({ error: 'Failed to load the test planner' }, { status: 500 });
    }
}

/** POST /api/ideas { title, hypothesis?, page_url?, baseline_rate?, expected_lift?, daily_visitors?, variations?, priority? } */
export async function POST(request: NextRequest) {
    try {
        const r = await currentProject(request);
        if (r instanceof NextResponse) return r;
        const parsed = createIdeaSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        if ((await db.countIdeas(r.projectId)) >= MAX_IDEAS) {
            return NextResponse.json({ error: `A project can hold up to ${MAX_IDEAS} ideas. Delete ones you dropped.` }, { status: 400 });
        }
        const v = parsed.data;
        const idea = await db.createIdea({
            project_id: r.projectId, title: v.title, hypothesis: v.hypothesis, page_url: v.page_url ?? null, baseline_rate: v.baseline_rate ?? null,
            expected_lift: v.expected_lift ?? null, daily_visitors: v.daily_visitors ?? null, variations: v.variations, priority: v.priority, created_by: r.userId,
        });
        await db.audit({ orgId: r.orgId, actorId: r.userId, entity: 'idea', entityId: idea.id, action: 'create', diff: { title: v.title } });
        return NextResponse.json({ idea: ideaJson(idea) }, { status: 201 });
    } catch (error) {
        console.error('Failed to create idea:', error);
        return NextResponse.json({ error: 'Failed to save the idea' }, { status: 500 });
    }
}
