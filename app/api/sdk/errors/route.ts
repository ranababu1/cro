import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticateSdkRequest, sdkJson, SDK_CORS_HEADERS } from '@/lib/requestAuth';
import { checkSdkOrigin } from '@/lib/sdkOrigin';
import { canUseFeature } from '@/lib/entitlements';
import { formatZodError } from '@/lib/validation';
import { errorReportSchema, errorRows } from '@/lib/jsErrors';
import { bumpErrors } from '@/lib/telemetry';

export function OPTIONS() {
    return new Response(null, { status: 204, headers: SDK_CORS_HEADERS });
}

/**
 * JavaScript error reports from errors.js (paid). Counts go into the in-memory telemetry buffer and are written
 * in the same batch as other counters, so a burst of errors does not mean a burst of database writes.
 */
export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateSdkRequest(request);
        if ('error' in auth) return auth.error;
        if (!(await canUseFeature(auth.ctx.orgId, 'error_tracking'))) return sdkJson({ error: 'Error tracking needs a paid plan' }, 403);
        const origin = await checkSdkOrigin(request, auth.ctx);
        if (!origin.ok) return sdkJson({ error: origin.message }, 403);
        // Beacons arrive as text/plain, so parse the body ourselves.
        const raw = await request.text().catch(() => '');
        if (raw.length > 32_000) return sdkJson({ error: 'Report too large' }, 413);
        let body: unknown = null;
        try { body = JSON.parse(raw); } catch { /* invalid */ }
        const parsed = errorReportSchema.safeParse(body);
        if (!parsed.success) return sdkJson({ error: formatZodError(parsed.error) }, 400);
        const r = parsed.data;
        // Running tests of this project come from the short-lived config cache, so this adds no reads per report.
        const running = (await db.getRunningConfig(auth.ctx.projectId)).find((c) => c.experiment.id === r.experiment_id);
        if (!running) return sdkJson({ error: 'Experiment not found or not running' }, 404);
        if (!running.variations.some((v) => v.id === r.variation_id)) return sdkJson({ error: 'Unknown variation' }, 400);
        const rows = errorRows(r);
        void bumpErrors({ experimentId: r.experiment_id, variationId: r.variation_id }, rows);
        return sdkJson({ success: true, accepted: rows.length }, 202);
    } catch (error) {
        console.error('error report failed', error);
        return sdkJson({ error: 'Failed to record errors' }, 500);
    }
}
