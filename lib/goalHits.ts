import { db } from './db';
import { matchesPageGoal } from './goals';
import { bumpMetric, METRICS } from './telemetry';
import { canUseFeature } from './entitlements';
import { MAX_REVENUE_EVENTS_PER_VISITOR } from './revenue';

interface HitInput {
    orgId: string;
    projectId: string;
    environmentId: string | null;
    userId: string;
    /** Page URL for page-visit goals. */
    url?: string;
    /** Event name for custom-event goals. */
    eventName?: string;
    /** Order value sent with a custom event. Kept only when the org may use revenue goals. */
    revenue?: number;
}

/**
 * Records conversions for page-visit and custom-event goals across the project's running tests.
 * Only visitors already assigned to a test count, and each goal counts once per visitor.
 * Revenue goals (custom events sent with a revenue amount, paid plans) record every order,
 * up to MAX_REVENUE_EVENTS_PER_VISITOR per visitor and goal, so totals add up.
 * Returns the number of events recorded.
 */
export async function recordGoalHits(input: HitInput): Promise<number> {
    // Page visit and custom event goals are paid (advanced goals); the free plan counts click goals only.
    if (!(await canUseFeature(input.orgId, 'advanced_goals'))) return 0;
    const running = await db.getRunningExperimentGoals(input.projectId);
    let recorded = 0;
    // Resolved on the first matching test: the amount, or null when the plan does not include revenue goals.
    let revenue: number | null | undefined;
    for (const { experiment, goals } of running) {
        const hits = goals.filter((g) =>
            (input.url && g.type === 'page' && matchesPageGoal(input.url, g.match_type, g.selector)) ||
            (input.eventName && g.type === 'event' && g.selector === input.eventName),
        );
        if (hits.length === 0) continue;
        if (revenue === undefined && input.revenue !== undefined) revenue = (await canUseFeature(input.orgId, 'revenue_goals')) ? input.revenue : null;
        const assignment = await db.getAssignment(experiment.id, input.userId);
        if (!assignment) continue;
        for (const g of hits) {
            const withRevenue = g.type === 'event' && typeof revenue === 'number';
            const seen = await db.hasConversion(experiment.id, input.userId, g.id);
            if (seen && (!withRevenue || (await db.countRevenueEvents(experiment.id, input.userId, g.id)) >= MAX_REVENUE_EVENTS_PER_VISITOR)) continue;
            await db.createEvent({
                experiment_id: experiment.id,
                variation_id: assignment.variation_id,
                environment_id: input.environmentId,
                user_id: input.userId,
                event_type: 'conversion',
                event_name: g.name,
                goal_id: g.id,
                metadata: null,
                revenue: withRevenue ? revenue : null,
            });
            recorded++;
            const scope = { orgId: input.orgId, projectId: input.projectId, experimentId: experiment.id };
            await bumpMetric(METRICS.sdk_goal, scope);
            if (!seen) await bumpMetric(METRICS.conversions, scope);
        }
    }
    return recorded;
}
