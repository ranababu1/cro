import { after } from 'next/server';
import { db } from './db';
import { checkStart, afterStatusChange } from './experimentStatus';
import { orgIdForProject } from './access';
import type { Experiment } from './types';

/**
 * Scheduled start and stop, and the traffic ramp. No cron: busy SDK routes call scheduleSchedules(), and at most
 * once a minute across instances (claimed in maintenance_runs) one request applies due starts and stops after its
 * response. A scheduled start passes the same plan checks as a manual start; if one fails, the scheduled start is
 * cancelled and the reason is saved on the test. Past its stop time a test assigns nobody, even before the job runs.
 * The ramp needs no writes: the share of new visitors entering the test is worked out from the time of each visit.
 */
export const SCHEDULE_JOB = 'schedule';
export const SCHEDULE_EVERY_MS = 60_000;
const LOCAL_CHECK_MS = 30_000;
const HOUR_MS = 3_600_000;

type Timed = Pick<Experiment, 'status' | 'traffic_allocation' | 'started_at' | 'schedule_stop_at' | 'ramp_start' | 'ramp_step' | 'ramp_every_hours'>;

export const hasRamp = (e: Pick<Experiment, 'ramp_start' | 'ramp_step' | 'ramp_every_hours'>) => !!(e.ramp_start && e.ramp_step && e.ramp_every_hours);

/** True once the scheduled stop time has passed. */
export function pastStop(e: Pick<Experiment, 'schedule_stop_at'>, now = Date.now()): boolean {
    return !!e.schedule_stop_at && Date.parse(e.schedule_stop_at) <= now;
}

/** Percent of new visitors the ramp lets in now, capped at the test's traffic setting. */
export function rampAllocation(e: Timed, now = Date.now()): number {
    if (!hasRamp(e) || !e.started_at) return e.traffic_allocation;
    const steps = Math.max(0, Math.floor((now - Date.parse(e.started_at)) / (e.ramp_every_hours! * HOUR_MS)));
    return Math.min(e.traffic_allocation, e.ramp_start! + e.ramp_step! * steps);
}

/** Traffic allocation to use for new visitors right now: 0 past the stop time, else the ramp (or the full setting). */
export function effectiveAllocation(e: Timed, now = Date.now()): number {
    return pastStop(e, now) ? 0 : rampAllocation(e, now);
}

/** When the ramp reaches the full traffic setting (ISO), or null without a ramp or before the first start. */
export function rampFullAt(e: Timed): string | null {
    if (!hasRamp(e) || !e.started_at) return null;
    const steps = Math.max(0, Math.ceil((e.traffic_allocation - e.ramp_start!) / e.ramp_step!));
    return new Date(Date.parse(e.started_at) + steps * e.ramp_every_hours! * HOUR_MS).toISOString();
}

/** Applies due scheduled starts and stops if no instance did in the last minute. Returns what it did, or null when not due. */
export async function runSchedules(now = new Date()): Promise<{ started: string[]; stopped: string[]; failed: string[] } | null> {
    const claimed = await db.claimMaintenance(SCHEDULE_JOB, new Date(now.getTime() - SCHEDULE_EVERY_MS).toISOString(), now.toISOString());
    if (!claimed) return null;
    const out = { started: [] as string[], stopped: [] as string[], failed: [] as string[] };
    const nowIso = now.toISOString();
    for (const e of await db.getDueSchedules(nowIso)) {
        const orgId = await orgIdForProject(e.project_id);
        const audit = (action: string, diff: unknown) => db.audit({ orgId, actorId: null, entity: 'experiment', entityId: e.id, action, diff });
        const stopDue = !!e.schedule_stop_at && e.schedule_stop_at <= nowIso;
        if (stopDue && (e.status === 'running' || e.status === 'paused')) {
            await db.updateExperiment(e.id, { status: 'completed', ended_at: e.ended_at ?? nowIso, schedule_start_at: null, schedule_stop_at: null });
            await afterStatusChange(e, 'completed', null, { userId: null });
            await audit('schedule:stop', { scheduled_for: e.schedule_stop_at });
            out.stopped.push(e.id);
            continue;
        }
        if (stopDue) {
            // A draft whose stop time passed before it ever started: drop the whole schedule.
            await db.updateExperiment(e.id, { schedule_start_at: null, schedule_stop_at: null, schedule_error: 'The stop time passed before the test started.' });
            await audit('schedule:start_failed', { reason: 'stop_passed' });
            out.failed.push(e.id);
            continue;
        }
        const check = await checkStart(e, null);
        if (!check.ok) {
            await db.updateExperiment(e.id, { schedule_start_at: null, schedule_error: check.error });
            await audit('schedule:start_failed', { reason: check.reason, error: check.error, scheduled_for: e.schedule_start_at });
            out.failed.push(e.id);
            continue;
        }
        await db.updateExperiment(e.id, { status: 'running', ...(check.startedAt ? { started_at: check.startedAt } : {}), schedule_start_at: null, schedule_error: null });
        await afterStatusChange(e, 'running', check, { userId: null });
        await audit('schedule:start', { scheduled_for: e.schedule_start_at });
        out.started.push(e.id);
    }
    return out;
}

let lastLocalCheck = 0;

/** Call from busy routes. Checks at most every 30 seconds per instance and runs after the response is sent. */
export function scheduleSchedules(now = Date.now()): void {
    if (now - lastLocalCheck < LOCAL_CHECK_MS) return;
    lastLocalCheck = now;
    const run = () => runSchedules().then(() => undefined).catch((err) => console.error('scheduled start or stop failed', err));
    try { after(run); } catch { void run(); }
}

/** Tests only. */
export function resetScheduleThrottle(): void {
    lastLocalCheck = 0;
}
