import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticateSdkRequest, sdkJson, SDK_CORS_HEADERS } from '@/lib/requestAuth';
import { trackSchema, formatZodError } from '@/lib/validation';
import { hostFromRequestHeaders, isHostAllowed } from '@/lib/domains';

const MAX_METADATA_BYTES = 4096;

export function OPTIONS() {
    return new Response(null, { status: 204, headers: SDK_CORS_HEADERS });
}

export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateSdkRequest(request);
        if ('error' in auth) return auth.error;

        const hosts = await db.getDomainHosts(auth.ctx.projectId);
        const reqHost = hostFromRequestHeaders(request.headers.get('origin'), request.headers.get('referer'));
        if (hosts.length === 0 || (reqHost && !isHostAllowed(reqHost, hosts))) {
            // Also allow when Origin is missing but we still have a key (server tests); still require domains configured.
            if (hosts.length === 0) return sdkJson({ error: 'No domains registered for this project' }, 403);
            if (reqHost && !isHostAllowed(reqHost, hosts)) return sdkJson({ error: 'Domain not allowed' }, 403);
        }

        const parsed = trackSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return sdkJson({ error: formatZodError(parsed.error) }, 400);
        const body = parsed.data;

        const metadata = body.metadata ? JSON.stringify(body.metadata) : null;
        if (metadata && metadata.length > MAX_METADATA_BYTES) {
            return sdkJson({ error: `metadata must be under ${MAX_METADATA_BYTES} bytes` }, 400);
        }

        const experiment = await db.getExperiment(body.experiment_id);
        if (!experiment || experiment.project_id !== auth.ctx.projectId) {
            return sdkJson({ error: 'Experiment not found' }, 404);
        }

        const variations = await db.getVariations(body.experiment_id);
        if (!variations.some((v) => v.id === body.variation_id)) {
            return sdkJson({ error: 'Variation not found' }, 404);
        }

        if (body.event_type === 'conversion' && body.goal_id) {
            const goals = await db.getGoals(body.experiment_id);
            if (!goals.some((g) => g.id === body.goal_id)) {
                return sdkJson({ error: 'Goal not found' }, 404);
            }
            // Dedupe: one conversion per visitor per goal.
            if (await db.hasConversion(body.experiment_id, body.user_id, body.goal_id)) {
                return sdkJson({ success: true, deduped: true }, 200);
            }
        }

        await db.createEvent({
            experiment_id: body.experiment_id,
            variation_id: body.variation_id,
            environment_id: auth.ctx.environmentId,
            user_id: body.user_id,
            event_type: body.event_type,
            event_name: body.event_name ?? null,
            goal_id: body.goal_id ?? null,
            metadata,
        });

        return sdkJson({ success: true }, 201);
    } catch (error) {
        console.error('Failed to track event:', error);
        return sdkJson({ error: 'Failed to track event' }, 500);
    }
}
