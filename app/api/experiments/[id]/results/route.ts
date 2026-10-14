import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment } from '@/lib/access';
import type { ExperimentResults, GoalResults, VariationMetrics } from '@/lib/types';
import { buildLiveStats } from '@/lib/liveStats';
import { calculateConfidenceInterval, calculateStatisticalSignificance } from '@/lib/statistics';

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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const experiment = await getAccessibleExperiment(ctx, id);
        if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });

        const variations = await db.getVariations(id);
        const goals = await db.getGoals(id);
        const envKey = request.nextUrl.searchParams.get('environment');
        let environmentId: string | undefined;
        if (envKey) {
            const env = (await db.getEnvironments(experiment.project_id)).find((e) => e.key === envKey);
            if (!env) return NextResponse.json({ error: 'Unknown environment' }, { status: 400 });
            environmentId = env.id;
        }

        // Overall / primary goal metrics (visitors from any event; conversions from primary or all)
        const primary = goals.find((g) => g.is_primary) || goals[0];
        const overallStats = primary
            ? await db.getEventStats(id, environmentId, primary.id)
            : await db.getEventStats(id, environmentId);
        // Visitors should count assignments/exposures, not only converters — refresh visitors from all events
        const visitorStats = await db.getEventStats(id, environmentId);
        const visitorMap = new Map(visitorStats.map((v) => [v.variation_id, Number(v.total_users)]));
        const overallWithVisitors = overallStats.map((s) => ({
            ...s,
            total_users: visitorMap.get(s.variation_id) ?? Number(s.total_users),
        }));
        const variationMetrics = metricsFromStats(variations, overallWithVisitors);
        const { statisticalSignificance, winner } = significanceAndWinner(variationMetrics);

        const goalResults: GoalResults[] = [];
        for (const goal of goals) {
            const stats = await db.getEventStats(id, environmentId, goal.id);
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
            live: buildLiveStats(variations, goals, await db.getLiveCounts(id, environmentId)),
        };
        return NextResponse.json(results);
    } catch (error) {
        console.error('Failed to fetch experiment results:', error);
        return NextResponse.json({ error: 'Failed to fetch experiment results' }, { status: 500 });
    }
}
