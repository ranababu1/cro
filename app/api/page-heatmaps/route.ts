import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatZodError } from '@/lib/validation';
import { createPageHeatmapSchema, MAX_PAGE_HEATMAPS, pageHeatmapJson } from '@/lib/pageHeatmaps';
import { pageHeatmapProject } from '@/lib/pageHeatmapRoutes';

/** GET /api/page-heatmaps: page heatmaps (pages without a test) of the current project. Paid only. */
export async function GET(request: NextRequest) {
    try {
        const r = await pageHeatmapProject(request);
        if (r instanceof NextResponse) return r;
        const list = await db.listPageHeatmaps(r.projectId);
        return NextResponse.json({ project_id: r.projectId, max: MAX_PAGE_HEATMAPS, heatmaps: list.map(pageHeatmapJson) });
    } catch (error) {
        console.error('Failed to list page heatmaps:', error);
        return NextResponse.json({ error: 'Failed to load page heatmaps' }, { status: 500 });
    }
}

/** POST /api/page-heatmaps { name, match, match_value, preview_url? }: starts collecting on matching pages right away. */
export async function POST(request: NextRequest) {
    try {
        const r = await pageHeatmapProject(request);
        if (r instanceof NextResponse) return r;
        const parsed = createPageHeatmapSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        if ((await db.listPageHeatmaps(r.projectId)).length >= MAX_PAGE_HEATMAPS) {
            return NextResponse.json({ error: `A project can have up to ${MAX_PAGE_HEATMAPS} page heatmaps. Delete one you no longer use.` }, { status: 400 });
        }
        const h = await db.createPageHeatmap({ project_id: r.projectId, name: parsed.data.name, match: parsed.data.match, match_value: parsed.data.match_value, preview_url: parsed.data.preview_url ?? null, created_by: r.userId });
        await db.audit({ orgId: r.orgId, actorId: r.userId, entity: 'page_heatmap', entityId: h.id, action: 'create', diff: parsed.data });
        return NextResponse.json({ heatmap: pageHeatmapJson(h) }, { status: 201 });
    } catch (error) {
        console.error('Failed to create page heatmap:', error);
        return NextResponse.json({ error: 'Failed to create page heatmap' }, { status: 500 });
    }
}
