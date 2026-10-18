import { NextRequest, after } from 'next/server';
import { db } from '@/lib/db';
import { captureSchema, ingestCapture, pruneHeatmapPoints } from '@/lib/heatmaps';
import { formatZodError } from '@/lib/validation';
import { authenticateSdkRequest, sdkJson, SDK_CORS_HEADERS } from '@/lib/requestAuth';
import { checkSdkOrigin } from '@/lib/sdkOrigin';
import { canUseFeature } from '@/lib/entitlements';

export function OPTIONS() {
    return new Response(null, { status: 204, headers: SDK_CORS_HEADERS });
}

/** Heatmap capture ingest. Refused for organizations without the heatmaps entitlement. */
export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateSdkRequest(request);
        if ('error' in auth) return auth.error;
        if (!(await canUseFeature(auth.ctx.orgId, 'heatmaps'))) {
            return sdkJson({ error: 'Heatmaps need a paid plan' }, 403);
        }
        const origin = await checkSdkOrigin(request, auth.ctx);
        if (!origin.ok) return sdkJson({ error: origin.message }, 403);
        // Beacons arrive as text/plain, so parse the body ourselves.
        const raw = await request.text().catch(() => '');
        if (raw.length > 64_000) return sdkJson({ error: 'Batch too large' }, 413);
        let body: unknown = null;
        try { body = JSON.parse(raw); } catch { /* invalid */ }
        const parsed = captureSchema.safeParse(body);
        if (!parsed.success) return sdkJson({ error: formatZodError(parsed.error) }, 400);
        const b = parsed.data;
        const experiment = await db.getExperiment(b.experiment_id);
        if (!experiment || experiment.project_id !== auth.ctx.projectId || experiment.status !== 'running') {
            return sdkJson({ error: 'Experiment not found or not running' }, 404);
        }
        const variations = await db.getVariations(experiment.id);
        if (!variations.some((v) => v.id === b.variation_id)) return sdkJson({ error: 'Unknown variation' }, 400);
        const accepted = await ingestCapture(auth.ctx.orgId, b);
        if (Math.random() < 0.02) {
            const prune = () => pruneHeatmapPoints().catch((err) => console.error('heatmap prune failed', err));
            // after() throws outside a request scope (tests, scripts); prune inline then instead of failing the ingest.
            try { after(prune); } catch { void prune(); }
        }
        return sdkJson({ success: true, accepted }, 202);
    } catch (error) {
        console.error('capture failed', error);
        return sdkJson({ error: 'Failed to record capture' }, 500);
    }
}
