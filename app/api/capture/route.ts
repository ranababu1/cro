import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { captureSchema, ingestCapture, PAGE_TABLES } from '@/lib/heatmaps';
import { isPageHeatmapId, pageCollection, PAGE_VARIATION } from '@/lib/pageHeatmaps';
import { heatmapCollection } from '@/lib/heatmapRules';
import { scheduleRetention } from '@/lib/retention';
import { formatZodError } from '@/lib/validation';
import { authenticateSdkRequest, sdkJson, SDK_CORS_HEADERS } from '@/lib/requestAuth';
import { checkSdkOrigin } from '@/lib/sdkOrigin';
import { canUseFeature } from '@/lib/entitlements';

export function OPTIONS() {
    return new Response(null, { status: 204, headers: SDK_CORS_HEADERS });
}

/** Heatmap capture ingest, for tests and page heatmaps. Refused for organizations without the heatmaps entitlement. */
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
        // Page heatmap (a page without a test): same batch format, its own tables and stop rules.
        if (isPageHeatmapId(b.experiment_id)) {
            const h = await db.getPageHeatmap(b.experiment_id);
            if (!h || h.project_id !== auth.ctx.projectId || h.status !== 'active') return sdkJson({ error: 'Page heatmap not found or paused' }, 404);
            if (b.variation_id !== PAGE_VARIATION) return sdkJson({ error: 'Unknown variation' }, 400);
            if (!pageCollection(h).collecting) return sdkJson({ success: true, accepted: 0, stopped: true }, 202);
            const accepted = await ingestCapture(auth.ctx.orgId, b, PAGE_TABLES);
            await db.addPageHeatmapViews(h.id, b.events.filter((e) => e.t === 's').length);
            scheduleRetention();
            return sdkJson({ success: true, accepted }, 202);
        }
        const experiment = await db.getExperiment(b.experiment_id);
        if (!experiment || experiment.project_id !== auth.ctx.projectId || experiment.status !== 'running') {
            return sdkJson({ error: 'Experiment not found or not running' }, 404);
        }
        const variations = await db.getVariations(experiment.id);
        if (!variations.some((v) => v.id === b.variation_id)) return sdkJson({ error: 'Unknown variation' }, 400);
        // Stop rules: once the test's heatmap reaches its day or page view limit, batches are dropped quietly.
        if (!heatmapCollection(experiment).collecting) return sdkJson({ success: true, accepted: 0, stopped: true }, 202);
        const accepted = await ingestCapture(auth.ctx.orgId, b);
        // One scroll entry is sent with the last batch of each page view, so it counts captured page views.
        await db.addHeatmapViews(experiment.id, b.events.filter((e) => e.t === 's').length);
        // Retention cleanup (raw clicks past 30 days, old survey answers) runs at most hourly, after the response.
        scheduleRetention();
        return sdkJson({ success: true, accepted }, 202);
    } catch (error) {
        console.error('capture failed', error);
        return sdkJson({ error: 'Failed to record capture' }, 500);
    }
}
