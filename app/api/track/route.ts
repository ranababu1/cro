import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getPageviewStatus } from '@/lib/pageviewQuota';
import { authenticateSdkRequest, sdkJson, SDK_CORS_HEADERS } from '@/lib/requestAuth';
import { trackSchema, trackBatchSchema, formatZodError } from '@/lib/validation';
import { checkSdkOrigin } from '@/lib/sdkOrigin';
import { bumpMetric, METRICS } from '@/lib/telemetry';
import type { Event } from '@/lib/types';
import type { z } from 'zod';

const MAX_METADATA_BYTES = 4096;

export function OPTIONS() {
    return new Response(null, { status: 204, headers: SDK_CORS_HEADERS });
}

type TrackBody = z.infer<typeof trackSchema>;
type Outcome = { status: number; body: Record<string, unknown>; event?: Omit<Event, 'id' | 'created_at'> };

async function check(body: TrackBody, projectId: string, environmentId: string, seen: Set<string>): Promise<Outcome> {
    const metadata = body.metadata ? JSON.stringify(body.metadata) : null;
    if (metadata && metadata.length > MAX_METADATA_BYTES) return { status: 400, body: { error: `metadata must be under ${MAX_METADATA_BYTES} bytes` } };
    const config = await db.getExperimentConfig(body.experiment_id);
    if (!config || config.experiment.project_id !== projectId) return { status: 404, body: { error: 'Experiment not found' } };
    if (!config.variations.some((v) => v.id === body.variation_id)) return { status: 404, body: { error: 'Variation not found' } };
    if (body.event_type === 'conversion' && body.goal_id) {
        if (!config.goals.some((g) => g.id === body.goal_id)) return { status: 404, body: { error: 'Goal not found' } };
        // Dedupe: one conversion per visitor per goal (also within one batch).
        const key = `${body.experiment_id}:${body.user_id}:${body.goal_id}`;
        if (seen.has(key) || (await db.hasConversion(body.experiment_id, body.user_id, body.goal_id))) return { status: 200, body: { success: true, deduped: true } };
        seen.add(key);
    }
    return {
        status: 201,
        body: { success: true },
        event: {
            experiment_id: body.experiment_id,
            variation_id: body.variation_id,
            environment_id: environmentId,
            user_id: body.user_id,
            event_type: body.event_type,
            event_name: body.event_name ?? null,
            goal_id: body.goal_id ?? null,
            metadata,
        },
    };
}

/** Accepts one event, or { events: [...] } from the SDK's batched sendBeacon. Batches insert in one statement. */
export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateSdkRequest(request);
        if ('error' in auth) return auth.error;

        const origin = await checkSdkOrigin(request, auth.ctx);
        if (!origin.ok) return sdkJson({ error: origin.message }, 403);

        if ((await getPageviewStatus(auth.ctx.orgId)).paused) return sdkJson({ success: true, paused: true }, 202);
        const raw = await request.json().catch(() => null);
        const isBatch = !!raw && typeof raw === 'object' && Array.isArray((raw as { events?: unknown }).events);
        let items: TrackBody[];
        if (isBatch) {
            const parsed = trackBatchSchema.safeParse(raw);
            if (!parsed.success) return sdkJson({ error: formatZodError(parsed.error) }, 400);
            items = parsed.data.events;
        } else {
            const parsed = trackSchema.safeParse(raw);
            if (!parsed.success) return sdkJson({ error: formatZodError(parsed.error) }, 400);
            items = [parsed.data];
        }

        const seen = new Set<string>();
        const outcomes: Outcome[] = [];
        for (const item of items) outcomes.push(await check(item, auth.ctx.projectId, auth.ctx.environmentId, seen));
        const events = outcomes.flatMap((o) => (o.event ? [o.event] : []));
        await db.createEvents(events);

        for (const e of events) {
            const scope = { orgId: auth.ctx.orgId, projectId: auth.ctx.projectId, experimentId: e.experiment_id };
            if (e.event_type === 'conversion') {
                await bumpMetric(METRICS.sdk_goal, scope);
                await bumpMetric(METRICS.conversions, scope);
            } else {
                await bumpMetric(METRICS.sdk_exposure, scope);
            }
        }

        if (!isBatch) return sdkJson(outcomes[0].body, outcomes[0].status);
        return sdkJson({ success: true, accepted: events.length, results: outcomes.map((o) => ({ status: o.status, ...o.body })) }, 200);
    } catch (error) {
        console.error('Failed to track event:', error);
        void bumpMetric(METRICS.errors, {});
        return sdkJson({ error: 'Failed to track event' }, 500);
    }
}
