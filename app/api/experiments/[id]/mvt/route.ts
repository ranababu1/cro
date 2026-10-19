import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatZodError } from '@/lib/validation';
import { UPGRADE_NOTE } from '@/lib/entitlements';
import { buildCombos, buildMvtSchema, configFromVariations, evenWeights, parseMvt } from '@/lib/mvt';
import { serializeChanges } from '@/lib/visualChanges';
import { loadVisualTest } from '@/lib/mvtRoutes';

type Params = { params: Promise<{ id: string }> };

/** GET /api/experiments/[id]/mvt: the factors and levels, and whether the plan allows building combinations. */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const r = await loadVisualTest(request, (await params).id);
        if (r instanceof NextResponse) return r;
        return NextResponse.json({ mvt: parseMvt(r.experiment.mvt), allowed: r.allowed, ...(r.allowed ? {} : { upgrade: UPGRADE_NOTE.visual_editor }) });
    } catch (error) {
        console.error('Failed to read multivariate setup:', error);
        return NextResponse.json({ error: 'Failed to read multivariate setup' }, { status: 500 });
    }
}

/**
 * POST /api/experiments/[id]/mvt { factors: [{ name, variation_ids }] }: Growth and above, drafts only. Turns the
 * draft's visual variations into factor levels and replaces the variations with every combination, split evenly.
 */
export async function POST(request: NextRequest, { params }: Params) {
    try {
        const r = await loadVisualTest(request, (await params).id);
        if (r instanceof NextResponse) return r;
        if (!r.allowed) return NextResponse.json({ error: 'Multivariate tests need the Growth plan or above', upgrade: UPGRADE_NOTE.visual_editor }, { status: 403 });
        if (r.experiment.status !== 'draft') return NextResponse.json({ error: 'Combinations can only be built on a draft' }, { status: 400 });
        if (r.experiment.mvt) return NextResponse.json({ error: 'This draft is already multivariate. Undo the combinations first' }, { status: 400 });
        const parsed = buildMvtSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        const variations = await db.getVariations(r.experiment.id);
        const control = variations.find((v) => v.is_control);
        if (!control) return NextResponse.json({ error: 'This test has no control' }, { status: 400 });
        const config = configFromVariations(parsed.data, variations);
        if ('error' in config) return NextResponse.json({ error: config.error }, { status: 400 });
        const combos = buildCombos(config);
        if ('error' in combos) return NextResponse.json({ error: combos.error }, { status: 400 });
        await db.replaceVariations(r.experiment.id, combos.map((c) => ({
            name: c.is_control ? control.name : c.name,
            weight: c.weight,
            is_control: c.is_control,
            url: c.is_control ? control.url : null,
            changes: c.is_control ? null : serializeChanges(c.changes),
            combo: JSON.stringify(c.combo),
        })), JSON.stringify(config));
        await db.audit({ orgId: r.orgId, actorId: r.userId, entity: 'experiment', entityId: r.experiment.id, action: 'mvt:build', diff: { factors: config.factors.map((f) => f.name), combinations: combos.length } });
        return NextResponse.json({ experiment: await db.getExperiment(r.experiment.id), variations: await db.getVariations(r.experiment.id) });
    } catch (error) {
        console.error('Failed to build combinations:', error);
        return NextResponse.json({ error: 'Failed to build combinations' }, { status: 500 });
    }
}

/** DELETE /api/experiments/[id]/mvt: drafts only. Puts the levels back as visual variations, split evenly. */
export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const r = await loadVisualTest(request, (await params).id);
        if (r instanceof NextResponse) return r;
        if (r.experiment.status !== 'draft') return NextResponse.json({ error: 'Combinations can only be undone on a draft' }, { status: 400 });
        const config = parseMvt(r.experiment.mvt);
        if (!config) return NextResponse.json({ error: 'This test is not multivariate' }, { status: 400 });
        const control = (await db.getVariations(r.experiment.id)).find((v) => v.is_control);
        const levels = config.factors.flatMap((f) => f.levels.slice(1));
        const weights = evenWeights(levels.length + 1);
        await db.replaceVariations(r.experiment.id, [
            { name: control?.name ?? 'Control', weight: weights[0], is_control: true, url: control?.url ?? r.experiment.control_url, changes: null, combo: null },
            ...levels.map((l, i) => ({ name: l.name, weight: weights[i + 1], is_control: false, changes: serializeChanges(l.changes), combo: null })),
        ], null);
        await db.audit({ orgId: r.orgId, actorId: r.userId, entity: 'experiment', entityId: r.experiment.id, action: 'mvt:undo' });
        return NextResponse.json({ experiment: await db.getExperiment(r.experiment.id), variations: await db.getVariations(r.experiment.id) });
    } catch (error) {
        console.error('Failed to undo combinations:', error);
        return NextResponse.json({ error: 'Failed to undo combinations' }, { status: 500 });
    }
}
