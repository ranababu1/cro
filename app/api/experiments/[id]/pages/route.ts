import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatZodError } from '@/lib/validation';
import { UPGRADE_NOTE } from '@/lib/entitlements';
import { multiPageAllowed, pagesSchema, parsePages, serializePages } from '@/lib/multipage';
import { loadVisualTest } from '@/lib/mvtRoutes';

type Params = { params: Promise<{ id: string }> };

/** GET /api/experiments/[id]/pages: the extra page rules of a multi-page test. */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const r = await loadVisualTest(request, (await params).id);
        if (r instanceof NextResponse) return r;
        const variations = await db.getVariations(r.experiment.id);
        return NextResponse.json({ pages: parsePages(r.experiment.pages), allowed: r.allowed, visual: multiPageAllowed(variations), ...(r.allowed ? {} : { upgrade: UPGRADE_NOTE.visual_editor }) });
    } catch (error) {
        console.error('Failed to read pages:', error);
        return NextResponse.json({ error: 'Failed to read pages' }, { status: 500 });
    }
}

/**
 * PUT /api/experiments/[id]/pages { pages: [{ match, value }] }: Growth and above, visual tests only. The changes of
 * every variation also apply on these pages. Clearing the list is always allowed.
 */
export async function PUT(request: NextRequest, { params }: Params) {
    try {
        const r = await loadVisualTest(request, (await params).id);
        if (r instanceof NextResponse) return r;
        const parsed = pagesSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        const pages = parsed.data.pages;
        if (r.experiment.status === 'completed') return NextResponse.json({ error: 'A completed test cannot be edited' }, { status: 400 });
        if (pages.length) {
            if (!r.allowed) return NextResponse.json({ error: 'Multi-page tests need the Growth plan or above', upgrade: UPGRADE_NOTE.visual_editor }, { status: 403 });
            if (!multiPageAllowed(await db.getVariations(r.experiment.id))) {
                return NextResponse.json({ error: 'Extra pages work with visual variations only. Split URL tests have one page per version' }, { status: 400 });
            }
        }
        const before = parsePages(r.experiment.pages);
        await db.setExperimentPages(r.experiment.id, serializePages(pages));
        await db.audit({ orgId: r.orgId, actorId: r.userId, entity: 'experiment', entityId: r.experiment.id, action: 'pages', diff: { before: before.length, after: pages.length } });
        return NextResponse.json({ pages });
    } catch (error) {
        console.error('Failed to save pages:', error);
        return NextResponse.json({ error: 'Failed to save pages' }, { status: 500 });
    }
}
