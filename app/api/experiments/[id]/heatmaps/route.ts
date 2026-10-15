import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment, orgIdForProject } from '@/lib/access';
import { canUseFeature, UPGRADE_NOTE } from '@/lib/entitlements';
import { heatmapReport, DEVICES, type Device } from '@/lib/heatmaps';

// GET /api/experiments/:id/heatmaps?variation=&device= - Heatmap report for one variation. Paid plans only.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const experiment = await getAccessibleExperiment(ctx, id);
        if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
        if (!(await canUseFeature(await orgIdForProject(experiment.project_id), 'heatmaps'))) {
            return NextResponse.json({ error: 'Heatmaps need a paid plan', upgrade: UPGRADE_NOTE.heatmaps }, { status: 403 });
        }
        const variations = await db.getVariations(experiment.id);
        const sp = request.nextUrl.searchParams;
        const variation = variations.find((v) => v.id === sp.get('variation')) ?? variations.find((v) => v.is_control) ?? variations[0];
        if (!variation) return NextResponse.json({ error: 'No variations' }, { status: 400 });
        const deviceParam = sp.get('device') ?? 'all';
        const device = (deviceParam === 'all' || (DEVICES as readonly string[]).includes(deviceParam) ? deviceParam : 'all') as Device | 'all';
        const report = await heatmapReport(experiment.id, variation.id, device);
        return NextResponse.json({
            variation: { id: variation.id, name: variation.name, url: variation.url ?? experiment.control_url },
            variations: variations.map((v) => ({ id: v.id, name: v.name, url: v.url ?? experiment.control_url, is_control: v.is_control })),
            device,
            ...report,
        });
    } catch (error) {
        console.error('heatmap report failed', error);
        return NextResponse.json({ error: 'Failed to load heatmaps' }, { status: 500 });
    }
}
