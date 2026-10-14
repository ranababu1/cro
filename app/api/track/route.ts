import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticateSdkRequest, sdkJson, SDK_CORS_HEADERS } from '@/lib/requestAuth';
import { trackSchema, formatZodError } from '@/lib/validation';

const MAX_METADATA_BYTES = 4096;

export function OPTIONS() {
    return new Response(null, { status: 204, headers: SDK_CORS_HEADERS });
}

// POST /api/track - Record a page view or conversion. Requires an SDK key.
export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateSdkRequest(request);
        if ('error' in auth) return auth.error;

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

        await db.createEvent({
            experiment_id: body.experiment_id,
            variation_id: body.variation_id,
            environment_id: auth.ctx.environmentId,
            user_id: body.user_id,
            event_type: body.event_type,
            event_name: body.event_name ?? null,
            metadata,
        });

        return sdkJson({ success: true }, 201);
    } catch (error) {
        console.error('Failed to track event:', error);
        return sdkJson({ error: 'Failed to track event' }, 500);
    }
}
