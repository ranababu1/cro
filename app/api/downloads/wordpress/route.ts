import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildWordpressZip } from '@/lib/wordpressPlugin';
import { recordProductEvent, clientIpFromHeaders } from '@/lib/telemetry';
import { pluginDownloadOrg, PLUGIN_DOWNLOAD_LIMITS } from '@/lib/pluginDownload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function backTo(request: NextRequest, reason: 'signin' | 'upgrade' | 'limit') {
    const url = new URL('/wordpress', request.nextUrl.origin);
    url.searchParams.set('download', reason);
    url.hash = 'download';
    return NextResponse.redirect(url, { status: 303, headers: { 'Cache-Control': 'no-store' } });
}

/**
 * GET /api/downloads/wordpress: the plugin zip, for paid accounts, special friends with the grant and
 * platform admins. The session is checked on every download; there is no public copy of the zip.
 * Signed-out visitors go to the sign-up form on /wordpress, free users to the upgrade prompt.
 */
export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return backTo(request, 'signin');
    const orgId = await pluginDownloadOrg(userId, session.user?.email ?? null);
    if (!orgId) return backTo(request, 'upgrade');

    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const [hour, day] = await Promise.all([db.countPluginDownloads(userId, orgId, hourAgo), db.countPluginDownloads(userId, orgId, dayAgo)]);
    if (hour.user >= PLUGIN_DOWNLOAD_LIMITS.userPerHour || day.org >= PLUGIN_DOWNLOAD_LIMITS.orgPerDay) return backTo(request, 'limit');

    const ip = clientIpFromHeaders(request.headers);
    const { version } = buildWordpressZip();
    const downloadId = await db.recordPluginDownload({ plugin: 'wordpress', version, orgId, userId, ipHash: createHash('sha256').update(`wp-dl:${ip}`).digest('hex').slice(0, 32) });
    const { zip } = buildWordpressZip({ orgId, downloadId, date: new Date().toISOString().slice(0, 10) });
    void recordProductEvent({ action: 'download.wordpress', userId, orgId }).catch(() => undefined);
    return new NextResponse(Buffer.from(zip), {
        headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="freeabtest-${version}.zip"`,
            'Content-Length': String(zip.byteLength),
            'Cache-Control': 'private, no-store',
            'X-Robots-Tag': 'noindex',
        },
    });
}
