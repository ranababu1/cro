import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { RateLimiter } from '@/lib/rateLimit';
import { clientIpFromHeaders } from '@/lib/telemetry';
import { PLUGIN_STATUS_MESSAGES, verifyPluginKey } from '@/lib/pluginLicense';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const limiter = new RateLimiter(30, 60_000);
const bodySchema = z.object({ key: z.string().min(1).max(200), site_url: z.string().min(1).max(2000), plugin_version: z.string().max(20).optional() });

/**
 * POST /api/plugin/verify: called by the WordPress plugin from the site's server when a key is saved and
 * once a day after. The plugin prints the snippet only while this returns status "ok".
 */
export async function POST(request: NextRequest) {
    const limit = limiter.check(clientIpFromHeaders(request.headers));
    if (!limit.allowed) return NextResponse.json({ status: 'rate_limited', message: 'Too many checks. Try again in a minute.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ status: 'invalid_key', message: PLUGIN_STATUS_MESSAGES.invalid_key }, { status: 400 });
    try {
        const status = await verifyPluginKey(parsed.data.key.trim(), parsed.data.site_url);
        return NextResponse.json({ status, message: PLUGIN_STATUS_MESSAGES[status] }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        console.error('plugin verify failed', err);
        return NextResponse.json({ status: 'error', message: 'Could not check the key right now. Try again later.' }, { status: 503 });
    }
}
