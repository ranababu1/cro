import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment, orgIdForProject } from '@/lib/access';
import { canUseFeature, UPGRADE_NOTE } from '@/lib/entitlements';
import { formatZodError } from '@/lib/validation';
import { heatmapCollection, heatmapSettingsSchema } from '@/lib/heatmapRules';
import type { Experiment } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

async function load(request: NextRequest, params: Params['params']): Promise<{ experiment: Experiment; orgId: string; userId: string | null } | NextResponse> {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    const { id } = await params;
    const experiment = await getAccessibleExperiment(ctx, id);
    if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    const orgId = await orgIdForProject(experiment.project_id);
    if (!orgId) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    if (!(await canUseFeature(orgId, 'heatmaps'))) {
        return NextResponse.json({ error: 'Heatmaps need a paid plan', upgrade: UPGRADE_NOTE.heatmaps }, { status: 403 });
    }
    return { experiment, orgId, userId: ctx.userId };
}

/** GET /api/experiments/:id/heatmaps/settings - Sample rate, stop rules and collection status. Paid plans only. */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const r = await load(request, params);
        if (r instanceof NextResponse) return r;
        return NextResponse.json(heatmapCollection(r.experiment));
    } catch (error) {
        console.error('heatmap settings read failed', error);
        return NextResponse.json({ error: 'Failed to read heatmap settings' }, { status: 500 });
    }
}

/**
 * PATCH /api/experiments/:id/heatmaps/settings { sample_percent?, stop_days?, stop_views?, restart? }
 * null clears a value (default sample, no stop rule). restart starts a new collection period.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const r = await load(request, params);
        if (r instanceof NextResponse) return r;
        const parsed = heatmapSettingsSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        if (r.experiment.status === 'completed') return NextResponse.json({ error: 'A completed test cannot be edited' }, { status: 400 });
        await db.setHeatmapSettings(r.experiment.id, parsed.data);
        await db.audit({ orgId: r.orgId, actorId: r.userId, entity: 'experiment', entityId: r.experiment.id, action: parsed.data.restart ? 'heatmaps:restart' : 'heatmaps:settings' });
        const updated = await db.getExperiment(r.experiment.id);
        return NextResponse.json(heatmapCollection(updated ?? r.experiment));
    } catch (error) {
        console.error('heatmap settings update failed', error);
        return NextResponse.json({ error: 'Failed to save heatmap settings' }, { status: 500 });
    }
}
