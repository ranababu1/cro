import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticateSdkRequest, sdkJson, SDK_CORS_HEADERS } from '@/lib/requestAuth';
import { checkSdkOrigin } from '@/lib/sdkOrigin';
import { canUseFeature } from '@/lib/entitlements';
import { formatZodError } from '@/lib/validation';
import { popupEventSchema } from '@/lib/popups';
import { bumpPopup } from '@/lib/telemetry';

export function OPTIONS() {
    return new Response(null, { status: 204, headers: SDK_CORS_HEADERS });
}

/** Popup view, click or close from popups.js. Counted in memory and written with the telemetry batch. */
export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateSdkRequest(request);
        if ('error' in auth) return auth.error;
        if (!(await canUseFeature(auth.ctx.orgId, 'popups'))) return sdkJson({ error: 'Popups need a paid plan' }, 403);
        const origin = await checkSdkOrigin(request, auth.ctx);
        if (!origin.ok) return sdkJson({ error: origin.message }, 403);
        const raw = await request.text().catch(() => '');
        if (raw.length > 2000) return sdkJson({ error: 'Too large' }, 413);
        let body: unknown = null;
        try { body = JSON.parse(raw); } catch { /* invalid */ }
        const parsed = popupEventSchema.safeParse(body);
        if (!parsed.success) return sdkJson({ error: formatZodError(parsed.error) }, 400);
        // Active popups come from the short-lived config cache, so this adds no reads per event.
        if (!(await db.getActivePopups(auth.ctx.projectId)).some((p) => p.id === parsed.data.popup_id)) return sdkJson({ error: 'Popup not found or not active' }, 404);
        void bumpPopup(parsed.data.popup_id, parsed.data.event);
        return sdkJson({ success: true }, 202);
    } catch (error) {
        console.error('popup event failed', error);
        return sdkJson({ error: 'Failed to record popup event' }, 500);
    }
}
