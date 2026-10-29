import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment, orgIdForProject } from '@/lib/access';
import { formatZodError } from '@/lib/validation';
import { profileGate } from '@/lib/profileGate';
import { checkStart } from '@/lib/experimentStatus';
import { effectiveAllocation, rampFullAt } from '@/lib/schedule';
import type { Experiment } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };
const YEAR_MS = 366 * 86_400_000;
const iso = z.string().datetime({ offset: true }).nullable();
const scheduleSchema = z.object({
    start_at: iso,
    stop_at: iso,
    ramp: z.object({
        start: z.number().int().min(1).max(100),
        step: z.number().int().min(1).max(100),
        every_hours: z.number().int().min(1).max(168),
    }).nullable(),
}).strict();

const view = (e: Experiment) => ({
    start_at: e.schedule_start_at,
    stop_at: e.schedule_stop_at,
    error: e.schedule_error,
    ramp: e.ramp_start && e.ramp_step && e.ramp_every_hours ? { start: e.ramp_start, step: e.ramp_step, every_hours: e.ramp_every_hours } : null,
    traffic_now: e.status === 'running' ? effectiveAllocation(e) : null,
    ramp_full_at: rampFullAt(e),
});

type Loaded = { res: NextResponse } | { ctx: Exclude<Awaited<ReturnType<typeof requireUserContext>>, NextResponse>; experiment: Experiment };

async function load(request: NextRequest, params: Params['params']): Promise<Loaded> {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return { res: ctx };
    const experiment = await getAccessibleExperiment(ctx, (await params).id);
    if (!experiment) return { res: NextResponse.json({ error: 'Experiment not found' }, { status: 404 }) };
    return { ctx, experiment };
}

// GET /api/experiments/[id]/schedule
export async function GET(request: NextRequest, { params }: Params): Promise<NextResponse> {
    const l = await load(request, params);
    if ('res' in l) return l.res;
    return NextResponse.json({ schedule: view(l.experiment) });
}

/**
 * PUT /api/experiments/[id]/schedule { start_at, stop_at, ramp }: replaces the schedule. Times are ISO with a zone.
 * A start applies to drafts and paused tests and passes the same plan checks as a manual start when it fires.
 */
export async function PUT(request: NextRequest, { params }: Params): Promise<NextResponse> {
    try {
        const l = await load(request, params);
        if ('res' in l) return l.res;
        const { ctx, experiment: e } = l;
        const parsed = scheduleSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        const { start_at, stop_at, ramp } = parsed.data;
        if (e.archived_at) return NextResponse.json({ error: 'Unarchive this test before scheduling it.' }, { status: 400 });
        if (e.status === 'completed') return NextResponse.json({ error: 'This test is completed. Schedules apply to drafts, running and paused tests.' }, { status: 400 });
        const now = Date.now();
        const start = start_at ? Date.parse(start_at) : null;
        const stop = stop_at ? Date.parse(stop_at) : null;
        if (start !== null) {
            if (e.status === 'running') return NextResponse.json({ error: 'This test is already running. Set a stop time instead.' }, { status: 400 });
            if (start <= now) return NextResponse.json({ error: 'The start time must be in the future.' }, { status: 400 });
            if (start > now + YEAR_MS) return NextResponse.json({ error: 'The start time must be within a year.' }, { status: 400 });
        }
        if (stop !== null) {
            if (stop <= now) return NextResponse.json({ error: 'The stop time must be in the future.' }, { status: 400 });
            if (stop > now + YEAR_MS) return NextResponse.json({ error: 'The stop time must be within a year.' }, { status: 400 });
            if (start !== null && stop <= start) return NextResponse.json({ error: 'The stop time must be after the start time.' }, { status: 400 });
            if (start === null && e.status === 'draft') return NextResponse.json({ error: 'Set a start time too, or start the test, before scheduling a stop.' }, { status: 400 });
        }
        if (start !== null) {
            // Starting later on your behalf needs the same complete profile as starting now.
            const gate = await profileGate(ctx);
            if (gate) return gate;
        }
        await db.updateExperiment(e.id, {
            schedule_start_at: start !== null ? new Date(start).toISOString() : null,
            schedule_stop_at: stop !== null ? new Date(stop).toISOString() : null,
            schedule_error: null,
            ramp_start: ramp?.start ?? null,
            ramp_step: ramp?.step ?? null,
            ramp_every_hours: ramp?.every_hours ?? null,
        });
        await db.audit({ orgId: await orgIdForProject(e.project_id), actorId: ctx.userId, entity: 'experiment', entityId: e.id, action: 'schedule:set', diff: parsed.data });
        // Heads-up only: limits are checked again when the start fires.
        let warning: string | null = null;
        if (start !== null) {
            const check = await checkStart(e, ctx.userId, { dryRun: true });
            if (!check.ok) warning = `If nothing changes before then, the start will be cancelled: ${check.error}`;
        }
        const updated = (await db.getExperiment(e.id))!;
        return NextResponse.json({ schedule: view(updated), warning });
    } catch (error) {
        console.error('Failed to save schedule:', error);
        return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 });
    }
}

// DELETE /api/experiments/[id]/schedule: clears the start, stop and ramp.
export async function DELETE(request: NextRequest, { params }: Params): Promise<NextResponse> {
    const l = await load(request, params);
    if ('res' in l) return l.res;
    const { ctx, experiment: e } = l;
    await db.updateExperiment(e.id, { schedule_start_at: null, schedule_stop_at: null, schedule_error: null, ramp_start: null, ramp_step: null, ramp_every_hours: null });
    await db.audit({ orgId: await orgIdForProject(e.project_id), actorId: ctx.userId, entity: 'experiment', entityId: e.id, action: 'schedule:clear' });
    return NextResponse.json({ schedule: view((await db.getExperiment(e.id))!) });
}
