import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment } from '@/lib/access';
import { createEditorToken, editorUrl, EDITOR_TOKEN_TTL_MS } from '@/lib/visualEditorToken';
import { editableVariation } from '@/lib/visualEditor';

type Params = { params: Promise<{ id: string; variationId: string }> };

/** POST: a link that opens the control page with the visual editor for this variation (valid for 2 hours). */
export async function POST(request: NextRequest, { params }: Params) {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    if (!ctx.userId) return NextResponse.json({ error: 'Open the visual editor from the dashboard' }, { status: 403 });
    const { id, variationId } = await params;
    const experiment = await getAccessibleExperiment(ctx, id);
    if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    const r = await editableVariation(experiment, variationId);
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
    const token = createEditorToken({ experimentId: id, variationId, userId: ctx.userId });
    return NextResponse.json({ url: editorUrl(experiment.control_url!, token), expires_in: EDITOR_TOKEN_TTL_MS / 1000 });
}
