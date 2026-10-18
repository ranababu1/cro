import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment } from '@/lib/access';
import { formatZodError } from '@/lib/validation';
import { parseChanges, visualChangesSchema } from '@/lib/visualChanges';
import { editableVariation, saveChanges } from '@/lib/visualEditor';

type Params = { params: Promise<{ id: string; variationId: string }> };

/** GET: the visual changes of one variation. */
export async function GET(request: NextRequest, { params }: Params) {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    const { id, variationId } = await params;
    const experiment = await getAccessibleExperiment(ctx, id);
    if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    const r = await editableVariation(experiment, variationId);
    if ('error' in r && r.status === 404) return NextResponse.json({ error: r.error }, { status: 404 });
    const variation = 'variation' in r ? r.variation : null;
    return NextResponse.json({ changes: parseChanges(variation?.changes), editable: 'variation' in r });
}

/** PUT: replace the visual changes of one variation. Applies to the next page load of everyone in that variation. */
export async function PUT(request: NextRequest, { params }: Params) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const { id, variationId } = await params;
        const experiment = await getAccessibleExperiment(ctx, id);
        if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
        const r = await editableVariation(experiment, variationId);
        if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
        const parsed = visualChangesSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        const changes = await saveChanges(experiment, r.variation, parsed.data.changes, ctx.userId ?? 'api', 'dashboard');
        return NextResponse.json({ changes });
    } catch (error) {
        console.error('Failed to save visual changes:', error);
        return NextResponse.json({ error: 'Failed to save visual changes' }, { status: 500 });
    }
}
