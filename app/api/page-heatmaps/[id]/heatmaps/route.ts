import { NextRequest, NextResponse } from 'next/server';
import { heatmapReport, heatmapSources, hasFilters, parseHeatmapQuery, PAGE_TABLES, RAW_RETENTION_DAYS } from '@/lib/heatmaps';
import { PAGE_VARIATION, pagePreviewUrl } from '@/lib/pageHeatmaps';
import { deviceParam, loadPageHeatmap } from '@/lib/pageHeatmapRoutes';

// GET /api/page-heatmaps/:id/heatmaps?device=&days=&source= - Report for a page heatmap, in the same shape as a test's.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const r = await loadPageHeatmap(request, (await params).id);
        if (r instanceof NextResponse) return r;
        const h = r.heatmap;
        const sp = request.nextUrl.searchParams;
        const device = deviceParam(sp);
        const { days, filters } = parseHeatmapQuery(sp);
        // No test, so no conversions to filter by.
        delete filters.converted;
        const filtered = hasFilters(filters);
        const [report, sources] = await Promise.all([
            heatmapReport(h.id, PAGE_VARIATION, device, days, filters, PAGE_TABLES),
            heatmapSources(h.id, PAGE_VARIATION, PAGE_TABLES),
        ]);
        const variation = { id: PAGE_VARIATION, name: h.name, url: pagePreviewUrl(h), is_control: false };
        return NextResponse.json({
            variation: { id: variation.id, name: variation.name, url: variation.url },
            variations: [variation],
            device,
            days: filtered ? Math.min(days, RAW_RETENTION_DAYS) : days,
            filters,
            sources,
            ...report,
        });
    } catch (error) {
        console.error('page heatmap report failed', error);
        return NextResponse.json({ error: 'Failed to load heatmaps' }, { status: 500 });
    }
}
