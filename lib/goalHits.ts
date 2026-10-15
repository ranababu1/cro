import { db } from './db';
import { matchesPageGoal } from './goals';
import { bumpMetric, METRICS } from './telemetry';

interface HitInput {
    orgId: string;
    projectId: string;
    environmentId: string | null;
    userId: string;
    /** Page URL for page-visit goals. */
    url?: string;
    /** Event name for custom-event goals. */
    eventName?: string;
}

/**
 * Records conversions for page-visit and custom-event goals across the project's running tests.
 * Only visitors already assigned to a test count, and each goal counts once per visitor.
 * Returns the number of new conversions.
 */
export async function recordGoalHits(input: HitInput): Promise<number> {
    const running = await db.getRunningExperimentGoals(input.projectId);
    let recorded = 0;
    for (const { experiment, goals } of running) {
        const hits = goals.filter((g) =>
            (input.url && g.type === 'page' && matchesPageGoal(input.url, g.match_type, g.selector)) ||
            (input.eventName && g.type === 'event' && g.selector === input.eventName),
        );
        if (hits.length === 0) continue;
        const assignment = await db.getAssignment(experiment.id, input.userId);
        if (!assignment) continue;
        for (const g of hits) {
            if (await db.hasConversion(experiment.id, input.userId, g.id)) continue;
            await db.createEvent({
                experiment_id: experiment.id,
                variation_id: assignment.variation_id,
                environment_id: input.environmentId,
                user_id: input.userId,
                event_type: 'conversion',
                event_name: g.name,
                goal_id: g.id,
                metadata: null,
            });
            recorded++;
            const scope = { orgId: input.orgId, projectId: input.projectId, experimentId: experiment.id };
            await bumpMetric(METRICS.sdk_goal, scope);
            await bumpMetric(METRICS.conversions, scope);
        }
    }
    return recorded;
}
