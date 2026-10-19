import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatZodError } from '@/lib/validation';
import { pageHeatmapJson, updatePageHeatmapSchema } from '@/lib/pageHeatmaps';
import { loadPageHeatmap } from '@/lib/pageHeatmapRoutes';

type Params = { params: Promise<{ id: string }> };

/** GET /api/page-heatmaps/[id] */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const r = await loadPageHeatmap(request, (await params).id);
        if (r instanceof NextResponse) return r;
        return NextResponse.json({ heatmap: pageHeatmapJson(r.heatmap) });
    } catch (error) {
        console.error('Failed to read page heatmap:', error);
        return NextResponse.json({ error: 'Failed to load page heatmap' }, { status: 500 });
    }
}

/** PATCH /api/page-heatmaps/[id] { name?, status?, match?, match_value?, preview_url? } */
export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const r = await loadPageHeatmap(request, (await params).id);
        if (r instanceof NextResponse) return r;
        const parsed = updatePageHeatmapSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        const h = await db.updatePageHeatmap(r.heatmap.id, parsed.data);
        await db.audit({ orgId: r.orgId, actorId: r.userId, entity: 'page_heatmap', entityId: r.heatmap.id, action: 'update', diff: parsed.data });
        return NextResponse.json({ heatmap: h ? pageHeatmapJson(h) : null });
    } catch (error) {
        console.error('Failed to update page heatmap:', error);
        return NextResponse.json({ error: 'Failed to update page heatmap' }, { status: 500 });
    }
}

/** DELETE /api/page-heatmaps/[id]: removes the page heatmap and its data. */
export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const r = await loadPageHeatmap(request, (await params).id);
        if (r instanceof NextResponse) return r;
        await db.deletePageHeatmap(r.heatmap.id);
        await db.audit({ orgId: r.orgId, actorId: r.userId, entity: 'page_heatmap', entityId: r.heatmap.id, action: 'delete', diff: { name: r.heatmap.name } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete page heatmap:', error);
        return NextResponse.json({ error: 'Failed to delete page heatmap' }, { status: 500 });
    }
}
