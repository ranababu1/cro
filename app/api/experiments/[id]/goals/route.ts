import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment, orgIdForProject } from '@/lib/access';
import { goalSchema, formatZodError } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

const MAX_GOALS = 20;

/** POST /api/experiments/[id]/goals: add a goal, also while the test runs. It counts from now on. */
export async function POST(request: NextRequest, { params }: Params) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const experiment = await getAccessibleExperiment(ctx, id);
        if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
        if (experiment.status === 'completed') return NextResponse.json({ error: 'A completed test cannot be edited' }, { status: 400 });
        const parsed = goalSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        const existing = await db.getGoals(id);
        if (existing.length >= MAX_GOALS) return NextResponse.json({ error: `A test can have up to ${MAX_GOALS} goals` }, { status: 400 });
        const goal = await db.addGoal(id, parsed.data);
        await db.audit({
            orgId: await orgIdForProject(experiment.project_id),
            actorId: ctx.userId,
            entity: 'experiment',
            entityId: id,
            action: 'goal:add',
            diff: parsed.data,
        });
        return NextResponse.json({ goal, goals: await db.getGoals(id) }, { status: 201 });
    } catch (error) {
        console.error('Failed to add goal:', error);
        return NextResponse.json({ error: 'Failed to add goal' }, { status: 500 });
    }
}
