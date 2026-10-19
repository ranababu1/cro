import { db } from './db';
import { orgIdForProject } from './access';
import { checkExperimentStartQuota, quotaMessage } from './quotas';
import { getOrgEntitlements } from './entitlements';
import { checkDomainTests, countDomainTest } from './domainLedger';
import { logAbuse } from './abuse';
import { bumpMetric, METRICS, recordProductEvent } from './telemetry';
import type { Experiment } from './types';

/**
 * Shared start and stop rules for experiments, used by the dashboard PATCH and by scheduled starts and stops,
 * so a scheduled start passes exactly the same plan checks as a manual one.
 */
export type StartCheck =
    | { ok: true; startedAt: string | null; countDomain: string | null }
    | { ok: false; error: string; reason: string };

/** dryRun: a preview when saving a schedule, so nothing is logged. Plan limits: running tests at a time on every start or resume; lifetime and monthly limits and the free domain rule on the first start. */
export async function checkStart(experiment: Experiment, actorId: string | null, opts: { dryRun?: boolean } = {}): Promise<StartCheck> {
    const orgId = await orgIdForProject(experiment.project_id);
    const firstStart = !experiment.started_at;
    const quota = await checkExperimentStartQuota(orgId, firstStart);
    if (!quota.allowed) return { ok: false, error: quotaMessage(quota), reason: quota.reason ?? 'quota' };
    let countDomain: string | null = null;
    if (firstStart && (await getOrgEntitlements(orgId)).freeTierRules) {
        const dom = await checkDomainTests(experiment.control_url);
        if (!dom.ok) {
            if (!opts.dryRun) await logAbuse(orgId, 'domain_exhausted', { domain: dom.domain, experiment: experiment.id }, actorId);
            return { ok: false, error: dom.message, reason: 'domain_exhausted' };
        }
        countDomain = dom.domain;
    }
    return { ok: true, startedAt: firstStart ? new Date().toISOString() : null, countDomain };
}

/** Counters, telemetry and product events after a status change has been saved. */
export async function afterStatusChange(
    experiment: Experiment,
    to: string,
    start: { startedAt: string | null; countDomain: string | null } | null,
    actor: { userId: string | null; ip?: string | null },
): Promise<void> {
    const orgId = await orgIdForProject(experiment.project_id);
    if (start?.startedAt) {
        await db.incrementExperimentsStarted(orgId);
        if (start.countDomain) await countDomainTest(start.countDomain, orgId);
    }
    const base = { userId: actor.userId ?? undefined, orgId, projectId: experiment.project_id, experimentId: experiment.id };
    if (to === 'running' && experiment.status !== 'running') {
        await bumpMetric(METRICS.tests_started, base);
        await recordProductEvent({ action: 'experiment.start', ...base, userId: actor.userId, ip: actor.ip ?? null });
    }
    if (to === 'completed' && experiment.status !== 'completed') {
        await bumpMetric(METRICS.tests_completed, base);
        await recordProductEvent({ action: 'experiment.complete', ...base, userId: actor.userId, ip: actor.ip ?? null });
    }
}
