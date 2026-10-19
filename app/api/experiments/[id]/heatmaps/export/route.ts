import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment, orgIdForProject } from '@/lib/access';
import { canUseFeature, UPGRADE_NOTE } from '@/lib/entitlements';
import { heatmapReport, hasFilters, parseHeatmapQuery, DEVICES, EXPORT_FIELDS, EXPORT_MAX_VARIATIONS, EXPORT_SCHEMA, RAW_RETENTION_DAYS, exportFileName, type Device } from '@/lib/heatmaps';

/**
 * GET /api/experiments/:id/heatmaps/export?device=&variation= - heatmap data as a JSON file, for any
 * analysis tool. All variations (up to 20) unless one is given. Paid plans only.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const experiment = await getAccessibleExperiment(ctx, id);
        if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
        const orgId = await orgIdForProject(experiment.project_id);
        if (!(await canUseFeature(orgId, 'heatmaps'))) {
            return NextResponse.json({ error: 'Heatmaps need a paid plan', upgrade: UPGRADE_NOTE.heatmaps }, { status: 403 });
        }
        const sp = request.nextUrl.searchParams;
        const deviceParam = sp.get('device') ?? 'all';
        const device = (deviceParam === 'all' || (DEVICES as readonly string[]).includes(deviceParam) ? deviceParam : 'all') as Device | 'all';
        const all = await db.getVariations(experiment.id);
        const one = sp.get('variation');
        const chosen = one ? all.filter((v) => v.id === one) : all.slice(0, EXPORT_MAX_VARIATIONS);
        if (!chosen.length) return NextResponse.json({ error: 'Variation not found' }, { status: 404 });
        const { days, filters } = parseHeatmapQuery(sp);
        const now = new Date();
        const variations = [];
        for (const v of chosen) {
            const r = await heatmapReport(experiment.id, v.id, device, days, filters);
            variations.push({ id: v.id, name: v.name, is_control: !!v.is_control, url: v.url ?? experiment.control_url, ...r });
        }
        const body = {
            schema: EXPORT_SCHEMA,
            exported_at: now.toISOString(),
            experiment: { id: experiment.id, name: experiment.name, status: experiment.status },
            device,
            period_days: hasFilters(filters) ? Math.min(days, RAW_RETENTION_DAYS) : days,
            filters,
            fields: EXPORT_FIELDS,
            truncated: !one && all.length > chosen.length ? `Only the first ${EXPORT_MAX_VARIATIONS} of ${all.length} variations are included. Export the others one at a time.` : undefined,
            variations,
        };
        if (orgId) await db.audit({ orgId, actorId: ctx.userId, entity: 'experiment', entityId: experiment.id, action: 'heatmap:export', diff: { device, variations: chosen.length } });
        return new NextResponse(JSON.stringify(body, null, 2), {
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Disposition': `attachment; filename="${exportFileName(experiment.name, device, now)}"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        console.error('heatmap export failed', error);
        return NextResponse.json({ error: 'Failed to export heatmaps' }, { status: 500 });
    }
}
