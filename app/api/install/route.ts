import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { PROJECT_COOKIE } from '@/lib/currentProject';
import { publicAppOrigin } from '@/lib/publicOrigin';

/**
 * Returns a pre-filled install snippet for the current project.
 * Lazily creates default public SDK keys for Production and Development when missing.
 */
export async function GET(request: NextRequest) {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    if (ctx.via !== 'session') return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const selected = request.cookies.get(PROJECT_COOKIE)?.value;
    const projectId = selected && ctx.projectIds.includes(selected) ? selected : ctx.projectIds[0];
    if (!projectId) return NextResponse.json({ error: 'No project' }, { status: 404 });

    let keys: { prod: string | null; dev: string | null };
    try {
        keys = await db.getInstallSdkKeys(projectId, ctx.userId);
    } catch (err) {
        console.error('install snippet: failed to load SDK keys', err);
        return NextResponse.json(
            { error: 'Could not load SDK keys. Open API keys to create one, or try again shortly.' },
            { status: 500 },
        );
    }
    const origin = publicAppOrigin();
    return NextResponse.json({
        origin,
        project_id: projectId,
        keys: {
            prod: keys.prod,
            dev: keys.dev,
        },
        default_env: 'prod' as const,
    });
}
