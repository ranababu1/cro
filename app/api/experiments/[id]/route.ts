import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment, orgIdForProject } from '@/lib/access';
import { updateExperimentSchema, formatZodError } from '@/lib/validation';
import type { ExperimentStatus } from '@/lib/types';
import { checkExperimentStartQuota } from '@/lib/quotas';

type Params = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ error: 'Experiment not found' }, { status: 404 });

const VALID_TRANSITIONS: Record<ExperimentStatus, ExperimentStatus[]> = {
    draft: ['running'],
    running: ['paused', 'completed'],
    paused: ['running', 'completed'],
    completed: [],
};

// GET /api/experiments/[id]
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const experiment = await getAccessibleExperiment(ctx, id);
        if (!experiment) return notFound();
        const variations = await db.getVariations(id);
        return NextResponse.json({ experiment, variations });
    } catch (error) {
        console.error('Failed to fetch experiment:', error);
        return NextResponse.json({ error: 'Failed to fetch experiment' }, { status: 500 });
    }
}

// PATCH /api/experiments/[id]
export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const experiment = await getAccessibleExperiment(ctx, id);
        if (!experiment) return notFound();

        const parsed = updateExperimentSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        const updates: Parameters<typeof db.updateExperiment>[1] = { ...parsed.data };

        if (updates.status && updates.status !== experiment.status) {
            if (!VALID_TRANSITIONS[experiment.status].includes(updates.status)) {
                return NextResponse.json(
                    { error: `Cannot transition from ${experiment.status} to ${updates.status}` },
                    { status: 400 },
                );
            }
            if (updates.status === 'running' && !experiment.started_at) {
                // Quota hook: first start counts against the plan's monthly experiment limit.
                const quota = await checkExperimentStartQuota(await orgIdForProject(experiment.project_id));
                if (!quota.allowed) {
                    return NextResponse.json(
                        { error: `Monthly experiment limit reached (${quota.used} of ${quota.limit}). Contact support to upgrade.` },
                        { status: 403 },
                    );
                }
                updates.started_at = new Date().toISOString();
            }
            if (updates.status === 'completed' && !experiment.ended_at) updates.ended_at = new Date().toISOString();
        }

        await db.updateExperiment(id, updates);
        await db.audit({
            orgId: await orgIdForProject(experiment.project_id),
            actorId: ctx.userId,
            entity: 'experiment',
            entityId: id,
            action: updates.status && updates.status !== experiment.status ? `status:${updates.status}` : 'update',
            diff: parsed.data,
        });

        const updatedExperiment = await db.getExperiment(id);
        const variations = await db.getVariations(id);
        return NextResponse.json({ experiment: updatedExperiment, variations });
    } catch (error) {
        console.error('Failed to update experiment:', error);
        return NextResponse.json({ error: 'Failed to update experiment' }, { status: 500 });
    }
}

// DELETE /api/experiments/[id] - Only drafts can be deleted
export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const experiment = await getAccessibleExperiment(ctx, id);
        if (!experiment) return notFound();
        if (experiment.status !== 'draft') {
            return NextResponse.json({ error: 'Only draft experiments can be deleted' }, { status: 400 });
        }
        await db.deleteExperiment(id);
        await db.audit({
            orgId: await orgIdForProject(experiment.project_id),
            actorId: ctx.userId,
            entity: 'experiment',
            entityId: id,
            action: 'delete',
            diff: { name: experiment.name },
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete experiment:', error);
        return NextResponse.json({ error: 'Failed to delete experiment' }, { status: 500 });
    }
}
