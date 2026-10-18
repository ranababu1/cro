import { after } from 'next/server';
import { db } from './db';
import { canUseFeature } from './entitlements';
import { checkAllocation } from './allocation';
import { AUTO_SHIFT_INTERVAL_MS, hashSeed, planShift, seededRandom } from './autoShift';

/** Per-instance memo so busy pages do not hit the database on every request. */
const lastLocalCheck = new Map<string, number>();
const LOCAL_CHECK_MS = 5 * 60 * 1000;

export type AutoShiftOutcome = 'not_due' | 'not_entitled' | 'no_goal' | 'not_enough_data' | 'too_few_arms' | 'unchanged' | 'shifted';

/**
 * Rebalances an auto-shift test when its check is due (once an hour while it gets traffic).
 * Called after the SDK bootstrap response, so visitors never wait for it.
 */
export async function maybeAutoShift(experimentId: string, orgId: string, now = new Date(), opts: { skipLocalMemo?: boolean } = {}): Promise<AutoShiftOutcome> {
    const t = now.getTime();
    if (!opts.skipLocalMemo) {
        if ((lastLocalCheck.get(experimentId) ?? 0) > t - LOCAL_CHECK_MS) return 'not_due';
        lastLocalCheck.set(experimentId, t);
        if (lastLocalCheck.size > 5000) lastLocalCheck.clear();
    }
    const nowIso = now.toISOString();
    if (!(await db.claimAutoShift(experimentId, new Date(t - AUTO_SHIFT_INTERVAL_MS).toISOString(), nowIso))) return 'not_due';
    if (!(await canUseFeature(orgId, 'auto_shift'))) return 'not_entitled';

    const [variations, goals] = await Promise.all([db.getVariations(experimentId), db.getGoals(experimentId)]);
    const goal = goals.find((g) => g.is_primary) ?? goals[0];
    if (!goal) return 'no_goal';
    const stats = (await db.getEventStatsByGoal(experimentId, undefined, [goal.id])).get(goal.id) ?? [];
    const byVar = new Map(stats.map((r) => [r.variation_id, r]));
    const active = variations.filter((v) => !v.paused);
    const arms = active.map((v) => ({ id: v.id, visitors: Number(byVar.get(v.id)?.total_users ?? 0), conversions: Number(byVar.get(v.id)?.conversions ?? 0) }));
    const plan = planShift(arms, seededRandom(hashSeed(`${experimentId}|${nowIso}`)));
    if (!plan.ok) return plan.reason;

    const rows = variations.map((v) => ({ id: v.id, paused: !!v.paused, weight: v.paused ? 0 : plan.weights.get(v.id) ?? 0 }));
    if (rows.every((r) => variations.find((v) => v.id === r.id)?.weight === r.weight)) return 'unchanged';
    const check = checkAllocation(variations, rows);
    if (!check.ok) return 'unchanged';
    await db.updateVariationAllocation(experimentId, check.rows);
    await db.audit({
        orgId,
        actorId: null,
        entity: 'experiment',
        entityId: experimentId,
        action: 'allocation:auto',
        diff: { goal_id: goal.id, weights: Object.fromEntries(plan.weights), probability_best: Object.fromEntries([...plan.probabilities].map(([k, p]) => [k, Math.round(p * 1000) / 1000])) },
    });
    return 'shifted';
}

/** Schedules a check after the response for a running auto-shift test. Never throws. */
export function scheduleAutoShift(experiment: { id: string; status: string; auto_shift?: boolean | null }, orgId: string): void {
    if (!experiment.auto_shift || experiment.status !== 'running') return;
    const run = () => maybeAutoShift(experiment.id, orgId).catch((err) => { console.error('auto-shift failed', err); return 'not_due' as const; });
    try { after(run); } catch { void run(); }
}
