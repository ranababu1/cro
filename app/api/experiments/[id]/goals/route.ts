import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment, orgIdForProject } from '@/lib/access';
import { goalSchema, formatZodError } from '@/lib/validation';
import { MAX_GOALS, goalPlanError } from '@/lib/goals';
import { getOrgEntitlements, UPGRADE_NOTE } from '@/lib/entitlements';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };


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
        const ent = await getOrgEntitlements(await orgIdForProject(experiment.project_id));
        const planError = goalPlanError({ maxGoals: ent.limits.maxGoals, advancedGoals: ent.features.advanced_goals }, [parsed.data], existing.length);
        if (planError) return NextResponse.json({ error: planError, upgrade: UPGRADE_NOTE.advanced_goals, reason: 'goals' }, { status: 403 });
        // The first goal of a test without one is its primary goal.
        const goal = await db.addGoal(id, existing.length === 0 ? { ...parsed.data, is_primary: true } : parsed.data);
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

const patchSchema = z.union([
    z.object({ order: z.array(z.string().min(1).max(100)).min(1).max(MAX_GOALS) }).strict(),
    z.object({ primary: z.string().min(1).max(100) }).strict(),
]);

/** PATCH /api/experiments/[id]/goals: reorder ({ order: ids }) or pick the primary goal ({ primary: id }). */
export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const experiment = await getAccessibleExperiment(ctx, id);
        if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
        if (experiment.status === 'completed') return NextResponse.json({ error: 'A completed test cannot be edited' }, { status: 400 });
        const parsed = patchSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: 'Send an order list or a primary goal id' }, { status: 400 });
        const ok = 'order' in parsed.data ? await db.reorderGoals(id, parsed.data.order) : await db.setPrimaryGoal(id, parsed.data.primary);
        if (!ok) return NextResponse.json({ error: 'order' in parsed.data ? 'The order must list every goal once' : 'Goal not found' }, { status: 400 });
        await db.audit({ orgId: await orgIdForProject(experiment.project_id), actorId: ctx.userId, entity: 'experiment', entityId: id, action: 'order' in parsed.data ? 'goal:reorder' : 'goal:primary', diff: parsed.data });
        return NextResponse.json({ goals: await db.getGoals(id) });
    } catch (error) {
        console.error('Failed to update goals:', error);
        return NextResponse.json({ error: 'Failed to update goals' }, { status: 500 });
    }
}

/**
 * DELETE /api/experiments/[id]/goals?goal=ID: remove a goal. A draft may remove its only goal (so a one-goal plan can
 * swap it); a test that has started keeps at least one, and a test needs a goal to start.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const experiment = await getAccessibleExperiment(ctx, id);
        if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
        if (experiment.status === 'completed') return NextResponse.json({ error: 'A completed test cannot be edited' }, { status: 400 });
        const goalId = request.nextUrl.searchParams.get('goal') ?? '';
        const existing = await db.getGoals(id);
        if (!existing.some((g) => g.id === goalId)) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
        if (existing.length <= 1 && experiment.status !== 'draft') return NextResponse.json({ error: 'A test needs at least one goal' }, { status: 400 });
        await db.deleteGoal(id, goalId);
        await db.audit({ orgId: await orgIdForProject(experiment.project_id), actorId: ctx.userId, entity: 'experiment', entityId: id, action: 'goal:remove', diff: { goal_id: goalId } });
        return NextResponse.json({ goals: await db.getGoals(id) });
    } catch (error) {
        console.error('Failed to remove goal:', error);
        return NextResponse.json({ error: 'Failed to remove goal' }, { status: 500 });
    }
}
