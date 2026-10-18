import { db } from './db';
import type { Experiment, ExperimentResults, GoalResults, VariationMetrics } from './types';
import { buildLiveStats } from './liveStats';
import { calculateConfidenceInterval, calculateStatisticalSignificance, sampleRatioMismatch } from './statistics';

function metricsFromStats(
    variations: Awaited<ReturnType<typeof db.getVariations>>,
    eventStats: { variation_id: string; total_users: number; conversions: number }[],
): VariationMetrics[] {
    return variations.map((variation) => {
        const stats = eventStats.find((s) => s.variation_id === variation.id) || { total_users: 0, conversions: 0 };
        const totalUsers = Number(stats.total_users) || 0;
        const conversions = Number(stats.conversions) || 0;
        const conversionRate = totalUsers > 0 ? conversions / totalUsers : 0;
        return {
            variation_id: variation.id,
            variation_name: variation.name,
            is_control: variation.is_control,
            total_users: totalUsers,
            conversions,
            conversion_rate: conversionRate,
            confidence_interval: calculateConfidenceInterval(conversions, totalUsers, 0.95),
        };
    });
}

function significanceAndWinner(variationMetrics: VariationMetrics[]) {
    const control = variationMetrics.find((v) => v.is_control);
    let statisticalSignificance;
    let winner;
    if (control && variationMetrics.length > 1) {
        const others = variationMetrics.filter((v) => !v.is_control);
        const best = others.reduce((a, b) => (b.conversion_rate > a.conversion_rate ? b : a), others[0]);
        if (best) {
            const significance = calculateStatisticalSignificance(
                { total_users: control.total_users, conversions: control.conversions, conversion_rate: control.conversion_rate },
                { total_users: best.total_users, conversions: best.conversions, conversion_rate: best.conversion_rate },
            );
            statisticalSignificance = significance;
            if (significance.is_significant && best.conversion_rate > control.conversion_rate) {
                winner = best.variation_id;
            }
        }
    }
    return { statisticalSignificance, winner };
}

/** Full results for an experiment, used by the dashboard and public share links. */
export async function buildExperimentResults(experiment: Experiment, environmentId?: string): Promise<ExperimentResults> {
    const variations = await db.getVariations(experiment.id);
    const goals = await db.getGoals(experiment.id);

    // Overall / primary goal metrics (visitors from any event; conversions from primary or all)
    const primary = goals.find((g) => g.is_primary) || goals[0];
    // One rollup read for the whole test and every named goal.
    const byGoal = await db.getEventStatsByGoal(experiment.id, environmentId, goals.map((g) => g.id));
    const overallStats = byGoal.get(primary ? primary.id : '') ?? [];
    // Visitors should count assignments/exposures, not only converters (refresh visitors from all events)
    const visitorStats = byGoal.get('') ?? [];
    const visitorMap = new Map(visitorStats.map((v) => [v.variation_id, Number(v.total_users)]));
    const overallWithVisitors = overallStats.map((s) => ({
        ...s,
        total_users: visitorMap.get(s.variation_id) ?? Number(s.total_users),
    }));
    const variationMetrics = metricsFromStats(variations, overallWithVisitors);
    const { statisticalSignificance, winner } = significanceAndWinner(variationMetrics);

    const goalResults: GoalResults[] = [];
    for (const goal of goals) {
        const stats = byGoal.get(goal.id) ?? [];
        const withVisitors = stats.map((s) => ({
            ...s,
            total_users: visitorMap.get(s.variation_id) ?? Number(s.total_users),
        }));
        // ensure every variation appears
        for (const v of variations) {
            if (!withVisitors.some((s) => s.variation_id === v.id)) {
                withVisitors.push({ variation_id: v.id, total_users: visitorMap.get(v.id) || 0, conversions: 0 });
            }
        }
        const metrics = metricsFromStats(variations, withVisitors);
        const sig = significanceAndWinner(metrics);
        goalResults.push({
            goal_id: goal.id,
            goal_name: goal.name,
            is_primary: goal.is_primary,
            variations: metrics,
            statistical_significance: sig.statisticalSignificance,
            winner: sig.winner,
        });
    }

    const results: ExperimentResults = {
        experiment_id: experiment.id,
        experiment_name: experiment.name,
        status: experiment.status,
        variations: variationMetrics,
        goals: goalResults,
        statistical_significance: statisticalSignificance,
        sample_size: variationMetrics.reduce((sum, v) => sum + v.total_users, 0),
        winner,
        // Auto-shift moves the split on purpose, so the mismatch check would always fire.
        srm: experiment.auto_shift ? undefined : await srmFor(experiment.id, variations, environmentId),
        live: buildLiveStats(variations, goals, await db.getLiveCounts(experiment.id, environmentId)),
    };
    return results;
}

/** Sample ratio mismatch on enrolled visitors of active variations against their current weights. */
async function srmFor(experimentId: string, variations: Awaited<ReturnType<typeof db.getVariations>>, environmentId?: string) {
    const counts = await db.getAssignmentCounts(experimentId, environmentId);
    const active = variations.filter((v) => !v.paused && v.weight > 0);
    if (active.length < 2) return undefined;
    const observed = active.map((v) => counts.get(v.id) ?? 0);
    const r = sampleRatioMismatch(observed, active.map((v) => v.weight));
    return {
        ...r,
        variations: active.map((v, i) => ({ variation_id: v.id, variation_name: v.name, observed: observed[i], expected_share: v.weight / 100 })),
    };
}
