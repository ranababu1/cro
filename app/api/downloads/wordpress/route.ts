import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { buildWordpressZip } from '@/lib/wordpressPlugin';
import { recordProductEvent } from '@/lib/telemetry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/downloads/wordpress - The FreeABTest plugin zip, for signed-in account holders only.
// Signed-out visitors are sent to /wordpress, which explains how to get it and returns here after sign-in.
export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        const url = new URL('/wordpress', request.nextUrl.origin);
        url.searchParams.set('download', 'signin');
        url.hash = 'download';
        return NextResponse.redirect(url, { status: 303, headers: { 'Cache-Control': 'no-store' } });
    }
    const { zip, version } = buildWordpressZip();
    void recordProductEvent({ action: 'download.wordpress', userId: session.user.id }).catch(() => undefined);
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
