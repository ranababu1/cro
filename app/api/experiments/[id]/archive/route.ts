import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment, orgIdForProject } from '@/lib/access';
import { archiveError } from '@/lib/experimentManage';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/experiments/[id]/archive: archives a completed or paused test (all plans). It leaves the default list,
 * never serves in the snippet and keeps its results. Pending schedules are removed. DELETE unarchives it.
 */
export async function POST(request: NextRequest, { params }: Params) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const experiment = await getAccessibleExperiment(ctx, (await params).id);
        if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
        const err = archiveError(experiment);
        if (err) return NextResponse.json({ error: err }, { status: 400 });
        await db.updateExperiment(experiment.id, { archived_at: new Date().toISOString(), schedule_start_at: null, schedule_stop_at: null, schedule_error: null });
        await db.audit({
            orgId: await orgIdForProject(experiment.project_id), actorId: ctx.userId, entity: 'experiment', entityId: experiment.id, action: 'archive',
            diff: { status: experiment.status, ...(experiment.schedule_start_at || experiment.schedule_stop_at ? { schedule_removed: true } : {}) },
        });
        return NextResponse.json({ experiment: await db.getExperiment(experiment.id) });
    } catch (error) {
        console.error('Failed to archive experiment:', error);
        return NextResponse.json({ error: 'Failed to archive the test' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const experiment = await getAccessibleExperiment(ctx, (await params).id);
        if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
        if (!experiment.archived_at) return NextResponse.json({ experiment });
        await db.updateExperiment(experiment.id, { archived_at: null });
        await db.audit({ orgId: await orgIdForProject(experiment.project_id), actorId: ctx.userId, entity: 'experiment', entityId: experiment.id, action: 'unarchive', diff: { status: experiment.status } });
        return NextResponse.json({ experiment: await db.getExperiment(experiment.id) });
    } catch (error) {
        console.error('Failed to unarchive experiment:', error);
        return NextResponse.json({ error: 'Failed to unarchive the test' }, { status: 500 });
    }
}
