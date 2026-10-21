import { profileGate } from '@/lib/profileGate';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment, orgIdForProject } from '@/lib/access';
import { updateExperimentSchema, formatZodError } from '@/lib/validation';
import type { ExperimentStatus } from '@/lib/types';
import { checkStart, afterStatusChange } from '@/lib/experimentStatus';
import { scheduleSchedules } from '@/lib/schedule';
import { scheduleWebhooks } from '@/lib/webhooks';
import { serializeTargeting } from '@/lib/targeting';
import { clientIpFromHeaders } from '@/lib/telemetry';

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
        // Scheduled starts and stops also run from the dashboard, for sites with no traffic yet.
        scheduleSchedules();
        scheduleWebhooks();
        const experiment = await getAccessibleExperiment(ctx, id);
        if (!experiment) return notFound();
        const variations = await db.getVariations(id);
        const goals = await db.getGoals(id);
        return NextResponse.json({ experiment, variations, goals });
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
        const { targeting, ...rest } = parsed.data;
        const updates: Parameters<typeof db.updateExperiment>[1] = { ...rest };
        let start: { startedAt: string | null } | null = null;
        // Targeting applies to new visitors only; people already in the test keep their version.
        if (targeting !== undefined) updates.targeting = serializeTargeting(targeting);

        if (updates.status && updates.status !== experiment.status) {
            if (!VALID_TRANSITIONS[experiment.status].includes(updates.status)) {
                return NextResponse.json(
                    { error: `Cannot transition from ${experiment.status} to ${updates.status}` },
                    { status: 400 },
                );
            }
            if (updates.status === 'running') {
                const gate = await profileGate(ctx);
                if (gate) return gate;
                const check = await checkStart(experiment, ctx.userId);
                if (!check.ok) return NextResponse.json({ error: check.error, reason: check.reason }, { status: 403 });
                start = check;
                if (check.startedAt) updates.started_at = check.startedAt;
                // A manual start replaces a pending scheduled start.
                updates.schedule_start_at = null;
                updates.schedule_error = null;
            }
            if (updates.status === 'completed' && !experiment.ended_at) updates.ended_at = new Date().toISOString();
            if (updates.status === 'completed') { updates.schedule_start_at = null; updates.schedule_stop_at = null; }
        }

        await db.updateExperiment(id, updates);
        if (updates.status && updates.status !== experiment.status) {
            await afterStatusChange(experiment, updates.status, start, { userId: ctx.userId, ip: clientIpFromHeaders(request.headers) });
        }
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
        const goals = await db.getGoals(id);
        return NextResponse.json({ experiment: updatedExperiment, variations, goals });
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
