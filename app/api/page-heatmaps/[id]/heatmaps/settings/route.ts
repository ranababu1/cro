import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatZodError } from '@/lib/validation';
import { heatmapSettingsSchema } from '@/lib/heatmapRules';
import { pageCollection } from '@/lib/pageHeatmaps';
import { loadPageHeatmap } from '@/lib/pageHeatmapRoutes';

type Params = { params: Promise<{ id: string }> };

/** GET /api/page-heatmaps/:id/heatmaps/settings - Sample rate, stop rules and collection status. */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const r = await loadPageHeatmap(request, (await params).id);
        if (r instanceof NextResponse) return r;
        return NextResponse.json(pageCollection(r.heatmap));
    } catch (error) {
        console.error('page heatmap settings read failed', error);
        return NextResponse.json({ error: 'Failed to read heatmap settings' }, { status: 500 });
    }
}

/** PATCH /api/page-heatmaps/:id/heatmaps/settings { sample_percent?, stop_days?, stop_views?, restart? } */
export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const r = await loadPageHeatmap(request, (await params).id);
        if (r instanceof NextResponse) return r;
        const parsed = heatmapSettingsSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        const h = await db.updatePageHeatmap(r.heatmap.id, parsed.data);
        await db.audit({ orgId: r.orgId, actorId: r.userId, entity: 'page_heatmap', entityId: r.heatmap.id, action: parsed.data.restart ? 'heatmaps:restart' : 'heatmaps:settings' });
        return NextResponse.json(pageCollection(h ?? r.heatmap));
    } catch (error) {
        console.error('page heatmap settings update failed', error);
        return NextResponse.json({ error: 'Failed to save heatmap settings' }, { status: 500 });
    }
}
