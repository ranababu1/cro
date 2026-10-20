import { db } from './db';
import { orgIdForProject } from './access';
import { checkExperimentStartQuota, quotaMessage } from './quotas';
import { bumpMetric, METRICS, recordProductEvent } from './telemetry';
import type { Experiment } from './types';
import { emitTestCompleted } from './webhooks';

/**
 * Shared start and stop rules for experiments, used by the dashboard PATCH and by scheduled starts and stops,
 * so a scheduled start passes exactly the same plan checks as a manual one.
 */
export type StartCheck =
    | { ok: true; startedAt: string | null }
    | { ok: false; error: string; reason: string };

/**
 * Plan limits on a start: the running-tests limit on every start or resume, and the admin-set monthly start limit on
 * the first start. The free plan's new-tests-per-month rule is checked when a test is created (lib/freeTests.ts).
 * dryRun is a preview when saving a schedule; nothing is written either way.
 */
export async function checkStart(experiment: Experiment, _actorId: string | null, _opts: { dryRun?: boolean } = {}): Promise<StartCheck> {
    const orgId = await orgIdForProject(experiment.project_id);
    if ((await db.getGoals(experiment.id)).length === 0) return { ok: false, error: 'Add a goal before starting this test', reason: 'no_goal' };
    const firstStart = !experiment.started_at;
    const quota = await checkExperimentStartQuota(orgId, firstStart);
    if (!quota.allowed) return { ok: false, error: quotaMessage(quota), reason: quota.reason ?? 'quota' };
    return { ok: true, startedAt: firstStart ? new Date().toISOString() : null };
}

/** Counters, telemetry and product events after a status change has been saved. */
export async function afterStatusChange(
    experiment: Experiment,
    to: string,
    start: { startedAt: string | null } | null,
    actor: { userId: string | null; ip?: string | null },
): Promise<void> {
    const orgId = await orgIdForProject(experiment.project_id);
    if (start?.startedAt) await db.incrementExperimentsStarted(orgId);
    const base = { userId: actor.userId ?? undefined, orgId, projectId: experiment.project_id, experimentId: experiment.id };
    if (to === 'running' && experiment.status !== 'running') {
        await bumpMetric(METRICS.tests_started, base);
        await recordProductEvent({ action: 'experiment.start', ...base, userId: actor.userId, ip: actor.ip ?? null });
    }
    if (to === 'completed' && experiment.status !== 'completed') {
        await bumpMetric(METRICS.tests_completed, base);
        await recordProductEvent({ action: 'experiment.complete', ...base, userId: actor.userId, ip: actor.ip ?? null });
        await emitTestCompleted(orgId, experiment, actor.userId ? 'manual' : 'schedule');
    }
}
