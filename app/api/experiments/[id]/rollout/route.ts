import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment, orgIdForProject } from '@/lib/access';
import { formatZodError } from '@/lib/validation';
import { ROLLOUT_FROM } from '@/lib/rollout';
import { bumpMetric, METRICS } from '@/lib/telemetry';
import { emitTestCompleted } from '@/lib/webhooks';

type Params = { params: Promise<{ id: string }> };
const body = z.object({ variation_id: z.string().min(1).max(100) });

/**
 * POST /api/experiments/[id]/rollout { variation_id }: ends the test (if it is still running or paused) and sends
 * every visitor to that variation until the rollout is stopped. DELETE stops the rollout; the test stays completed.
 */
export async function POST(request: NextRequest, { params }: Params) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const experiment = await getAccessibleExperiment(ctx, id);
        if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
        const parsed = body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        if (!ROLLOUT_FROM.includes(experiment.status)) {
            return NextResponse.json({ error: 'Start the test first. A draft has no results to roll out.' }, { status: 400 });
        }
        const variation = (await db.getVariations(id)).find((v) => v.id === parsed.data.variation_id);
        if (!variation) return NextResponse.json({ error: 'Variation not found' }, { status: 404 });
        const now = new Date().toISOString();
        const ending = experiment.status !== 'completed';
        await db.updateExperiment(id, { status: 'completed', ...(experiment.ended_at ? {} : { ended_at: now }), rollout_variation_id: variation.id, rollout_at: now });
        const orgId = await orgIdForProject(experiment.project_id);
        if (ending) {
            await bumpMetric(METRICS.tests_completed, { userId: ctx.userId, orgId, projectId: experiment.project_id, experimentId: id });
            await emitTestCompleted(orgId, experiment, 'rollout');
        }
        await db.audit({ orgId, actorId: ctx.userId, entity: 'experiment', entityId: id, action: 'rollout:start', diff: { variation: variation.name, ended_test: ending } });
        return NextResponse.json({ experiment: await db.getExperiment(id) });
    } catch (error) {
        console.error('Failed to roll out:', error);
        return NextResponse.json({ error: 'Failed to roll out' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const experiment = await getAccessibleExperiment(ctx, id);
        if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
        if (!experiment.rollout_variation_id) return NextResponse.json({ experiment });
        await db.updateExperiment(id, { rollout_variation_id: null, rollout_at: null });
        await db.audit({ orgId: await orgIdForProject(experiment.project_id), actorId: ctx.userId, entity: 'experiment', entityId: id, action: 'rollout:stop' });
        return NextResponse.json({ experiment: await db.getExperiment(id) });
    } catch (error) {
        console.error('Failed to stop rollout:', error);
        return NextResponse.json({ error: 'Failed to stop rollout' }, { status: 500 });
    }
}
