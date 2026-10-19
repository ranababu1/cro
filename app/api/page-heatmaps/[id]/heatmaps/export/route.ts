import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { heatmapReport, hasFilters, parseHeatmapQuery, EXPORT_FIELDS, EXPORT_SCHEMA, PAGE_TABLES, RAW_RETENTION_DAYS, exportFileName } from '@/lib/heatmaps';
import { PAGE_VARIATION, pagePreviewUrl, pageRuleText } from '@/lib/pageHeatmaps';
import { deviceParam, loadPageHeatmap } from '@/lib/pageHeatmapRoutes';

/** GET /api/page-heatmaps/:id/heatmaps/export?device=&days=&source= - the page heatmap as a JSON file. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const r = await loadPageHeatmap(request, (await params).id);
        if (r instanceof NextResponse) return r;
        const h = r.heatmap;
        const sp = request.nextUrl.searchParams;
        const device = deviceParam(sp);
        const { days, filters } = parseHeatmapQuery(sp);
        delete filters.converted;
        const now = new Date();
        const report = await heatmapReport(h.id, PAGE_VARIATION, device, days, filters, PAGE_TABLES);
        const body = {
            schema: EXPORT_SCHEMA,
            exported_at: now.toISOString(),
            page_heatmap: { id: h.id, name: h.name, pages: pageRuleText(h), status: h.status },
            device,
            period_days: hasFilters(filters) ? Math.min(days, RAW_RETENTION_DAYS) : days,
            filters,
            fields: EXPORT_FIELDS,
            variations: [{ id: PAGE_VARIATION, name: h.name, is_control: false, url: pagePreviewUrl(h), ...report }],
        };
        await db.audit({ orgId: r.orgId, actorId: r.userId, entity: 'page_heatmap', entityId: h.id, action: 'heatmap:export', diff: { device } });
        return new NextResponse(JSON.stringify(body, null, 2), {
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Disposition': `attachment; filename="${exportFileName(h.name, device, now)}"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        console.error('page heatmap export failed', error);
        return NextResponse.json({ error: 'Failed to export heatmaps' }, { status: 500 });
    }
}
