import { z } from 'zod';
import { db, type SdkKeyContext } from './db';
import type { AssignmentResponse, Event, Experiment, Goal, Variation } from './types';
import { assignUserToVariation, isExperimentEligible } from './assignment';
import { rolloutVariation } from './rollout';
import { formatZodError, trackBatchSchema, trackSchema } from './validation';
import { checkVisitorQuota, recordNewVisitor } from './quotas';
import { bumpMetric, METRICS } from './telemetry';
import { scheduleAutoShift } from './autoShiftRun';
import { scheduleSchedules, effectiveAllocation, pastStop } from './schedule';
import { scheduleWebhooks } from './webhooks';
import { getPageviewStatus } from './pageviewQuota';

/**
 * Shared cores of the browser SDK endpoints (/api/assign, /api/track) and the server endpoints
 * (/api/server/*). Routes handle auth and origin; these return a status and a JSON body.
 */
export type FlowResult = { status: number; body: unknown };

export const assignBody = z.object({
    experiment_id: z.string().min(1).max(100),
    user_id: z.string().min(1).max(200).regex(/^[\x21-\x7e]+$/),
});

const notAssigned = (experimentId: string): AssignmentResponse => ({
    experiment_id: experimentId,
    variation_id: '',
    variation_name: '',
    assigned: false,
});

/** Picks (or returns the stored) variation for one visitor and stores new assignments. */
export async function assignVisitor(ctx: SdkKeyContext, raw: unknown): Promise<FlowResult> {
    const parsed = assignBody.safeParse(raw);
    if (!parsed.success) return { status: 400, body: { error: formatZodError(parsed.error) } };
    const { experiment_id: experimentId, user_id: userId } = parsed.data;

    scheduleSchedules();
    scheduleWebhooks();
    const experiment = await db.getExperiment(experimentId);
    if (!experiment || experiment.project_id !== ctx.projectId) return { status: 404, body: { error: 'Experiment not found' } };

    const variations = await db.getVariations(experimentId);
    // Rolled-out winner: every visitor gets that variation, and nothing is stored or counted.
    const rolled = rolloutVariation(experiment, variations);
    if (rolled) {
        return { status: 200, body: { experiment_id: experimentId, variation_id: rolled.id, variation_name: rolled.name, variation_url: rolled.url ?? undefined, assigned: false, reason: 'rollout' } satisfies AssignmentResponse };
    }
    const existing = await db.getAssignment(experimentId, userId);
    if (existing) {
        const variation = variations.find((v) => v.id === existing.variation_id);
        if (variation && experiment.status === 'running' && !pastStop(experiment)) {
            return { status: 200, body: { experiment_id: experimentId, variation_id: variation.id, variation_name: variation.name, variation_url: variation.url ?? undefined, assigned: true } satisfies AssignmentResponse };
        }
    }

    if (!isExperimentEligible(experiment.status, effectiveAllocation(experiment))) return { status: 200, body: notAssigned(experimentId) };
    scheduleAutoShift(experiment, ctx.orgId);
    if (variations.length === 0) return { status: 400, body: { error: 'No variations found for this experiment' } };

    const active = variations.filter((v) => !v.paused && v.weight > 0);
    const assigned = active.length ? assignUserToVariation(userId, experimentId, effectiveAllocation(experiment), active) : null;
    if (!assigned) return { status: 200, body: notAssigned(experimentId) };

    const quota = await checkVisitorQuota(ctx.orgId, userId);
    if (!quota.allowed) return { status: 200, body: { ...notAssigned(experimentId), reason: 'quota_exceeded' } satisfies AssignmentResponse };

    await bumpMetric(METRICS.unique_visitors, { orgId: ctx.orgId, projectId: ctx.projectId, experimentId });
    if (await db.createAssignment({ experiment_id: experimentId, variation_id: assigned.id, user_id: userId, environment_id: ctx.environmentId })) {
        await recordNewVisitor(ctx.orgId, userId);
    }
    return { status: 200, body: { experiment_id: experimentId, variation_id: assigned.id, variation_name: assigned.name, variation_url: assigned.url ?? undefined, assigned: true } satisfies AssignmentResponse };
}

const MAX_METADATA_BYTES = 4096;
type TrackBody = z.infer<typeof trackSchema>;
type Outcome = { status: number; body: Record<string, unknown>; event?: Omit<Event, 'id' | 'created_at' | 'revenue'> };

export interface TrackOptions {
    /**
     * Server SDK: a page view from a visitor with no stored assignment stores one (the server decided
     * locally with the same hash), counting the visitor against the quota like /api/assign does.
     */
    storeExposureAssignments?: boolean;
}

async function checkEvent(body: TrackBody, ctx: SdkKeyContext, seen: Set<string>, opts: TrackOptions): Promise<Outcome> {
    const metadata = body.metadata ? JSON.stringify(body.metadata) : null;
    if (metadata && metadata.length > MAX_METADATA_BYTES) return { status: 400, body: { error: `metadata must be under ${MAX_METADATA_BYTES} bytes` } };
    const config = await db.getExperimentConfig(body.experiment_id);
    if (!config || config.experiment.project_id !== ctx.projectId) return { status: 404, body: { error: 'Experiment not found' } };
    if (!config.variations.some((v) => v.id === body.variation_id)) return { status: 404, body: { error: 'Variation not found' } };
    if (body.event_type === 'conversion' && body.goal_id) {
        if (!config.goals.some((g) => g.id === body.goal_id)) return { status: 404, body: { error: 'Goal not found' } };
        // Dedupe: one conversion per visitor per goal (also within one batch).
        const key = `${body.experiment_id}:${body.user_id}:${body.goal_id}`;
        if (seen.has(key) || (await db.hasConversion(body.experiment_id, body.user_id, body.goal_id))) return { status: 200, body: { success: true, deduped: true } };
        seen.add(key);
    }
    if (opts.storeExposureAssignments && body.event_type === 'page_view') {
        const stored = await storeExposure(body, config.experiment, ctx, seen);
        if (stored) return stored;
    }
    return {
        status: 201,
        body: { success: true },
        event: {
            experiment_id: body.experiment_id,
            variation_id: body.variation_id,
            environment_id: ctx.environmentId,
            user_id: body.user_id,
            event_type: body.event_type,
            event_name: body.event_name ?? null,
            goal_id: body.goal_id ?? null,
            metadata,
        },
    };
}

/** Returns an outcome that drops the event, or null to record it. */
async function storeExposure(body: TrackBody, experiment: Experiment, ctx: SdkKeyContext, seen: Set<string>): Promise<Outcome | null> {
    const key = `a:${body.experiment_id}:${body.user_id}`;
    if (seen.has(key)) return null;
    seen.add(key);
    const existing = await db.getAssignment(body.experiment_id, body.user_id);
    if (existing) {
        // The stored assignment wins: an exposure for another variation is not counted.
        return existing.variation_id === body.variation_id ? null : { status: 409, body: { error: 'Visitor is assigned to another variation', variation_id: existing.variation_id } };
    }
    if (experiment.status !== 'running' || pastStop(experiment)) return { status: 409, body: { error: 'Experiment is not running' } };
    const quota = await checkVisitorQuota(ctx.orgId, body.user_id);
    if (!quota.allowed) return { status: 200, body: { success: true, reason: 'quota_exceeded' } };
    await bumpMetric(METRICS.unique_visitors, { orgId: ctx.orgId, projectId: ctx.projectId, experimentId: body.experiment_id });
    if (await db.createAssignment({ experiment_id: body.experiment_id, variation_id: body.variation_id, user_id: body.user_id, environment_id: ctx.environmentId })) {
        await recordNewVisitor(ctx.orgId, body.user_id);
    }
    return null;
}

/** One event, or { events: [...] } (up to 50). Batches insert in one statement. */
export async function ingestTrack(ctx: SdkKeyContext, raw: unknown, opts: TrackOptions = {}): Promise<FlowResult> {
    if ((await getPageviewStatus(ctx.orgId)).paused) return { status: 202, body: { success: true, paused: true } };
    const isBatch = !!raw && typeof raw === 'object' && Array.isArray((raw as { events?: unknown }).events);
    let items: TrackBody[];
    if (isBatch) {
        const parsed = trackBatchSchema.safeParse(raw);
        if (!parsed.success) return { status: 400, body: { error: formatZodError(parsed.error) } };
        items = parsed.data.events;
    } else {
        const parsed = trackSchema.safeParse(raw);
        if (!parsed.success) return { status: 400, body: { error: formatZodError(parsed.error) } };
        items = [parsed.data];
    }

    const seen = new Set<string>();
    const outcomes: Outcome[] = [];
    for (const item of items) outcomes.push(await checkEvent(item, ctx, seen, opts));
    const events = outcomes.flatMap((o) => (o.event ? [o.event] : []));
    await db.createEvents(events);

    for (const e of events) {
        const scope = { orgId: ctx.orgId, projectId: ctx.projectId, experimentId: e.experiment_id };
        if (e.event_type === 'conversion') {
            await bumpMetric(METRICS.sdk_goal, scope);
            await bumpMetric(METRICS.conversions, scope);
        } else {
            await bumpMetric(METRICS.sdk_exposure, scope);
        }
    }
    if (!isBatch) return { status: outcomes[0].status, body: outcomes[0].body };
    return { status: 200, body: { success: true, accepted: events.length, results: outcomes.map((o) => ({ status: o.status, ...o.body })) } };
}

/** Server SDK config entry: what a backend needs to decide locally with the same hash. */
export interface ServerExperiment {
    id: string;
    name: string;
    status: Experiment['status'];
    traffic_allocation: number;
    rollout_variation_id: string | null;
    variations: Array<{ id: string; name: string; url: string | null; weight: number; is_control: boolean; paused: boolean }>;
    goals: Array<{ id: string; name: string; type: Goal['type']; selector: string; is_primary: boolean }>;
}

export function serverExperiment(experiment: Experiment, variations: Variation[], goals: Goal[]): ServerExperiment {
    const rolled = rolloutVariation(experiment, variations);
    return {
        id: experiment.id,
        name: experiment.name,
        status: experiment.status,
        traffic_allocation: rolled ? 0 : effectiveAllocation(experiment),
        rollout_variation_id: rolled?.id ?? null,
        variations: variations.map((v) => ({ id: v.id, name: v.name, url: v.url, weight: v.weight, is_control: v.is_control, paused: v.paused })),
        goals: goals.map((g) => ({ id: g.id, name: g.name, type: g.type, selector: g.selector, is_primary: g.is_primary })),
    };
}

export const SERVER_CONFIG_TTL_SECONDS = 60;

/** Running and rolled-out experiments of the key's project. */
export async function serverConfig(ctx: SdkKeyContext): Promise<{ experiments: ServerExperiment[]; ttl_seconds: number; generated_at: string }> {
    scheduleSchedules();
    const running = await db.getRunningConfig(ctx.projectId);
    const rolled = await db.getRolloutConfig(ctx.projectId);
    const experiments = [
        ...running.map((r) => serverExperiment(r.experiment, r.variations, r.goals)),
        ...rolled.map((r) => serverExperiment(r.experiment, r.variations, [])),
    ];
    return { experiments, ttl_seconds: SERVER_CONFIG_TTL_SECONDS, generated_at: new Date().toISOString() };
}
