import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment } from '@/lib/access';
import { controlUrlOf, previewBlocker } from '@/lib/preview';
import { createPreviewToken, previewUrl, PREVIEW_TOKEN_TTL_MS } from '@/lib/previewToken';

type Params = { params: Promise<{ id: string; variationId: string }> };

/** POST: a QA link that shows this variation on the control page for 7 days, without entering the test or being counted. */
export async function POST(request: NextRequest, { params }: Params) {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    const { id, variationId } = await params;
    const experiment = await getAccessibleExperiment(ctx, id);
    if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    const variations = await db.getVariations(experiment.id);
    const blocker = previewBlocker(experiment, variations, variationId);
    if (blocker) return NextResponse.json({ error: blocker }, { status: blocker === 'Variation not found' ? 404 : 400 });
    const now = Date.now();
    const token = createPreviewToken({ experimentId: id, variationId }, now);
    return NextResponse.json({ url: previewUrl(controlUrlOf(experiment, variations), token), expires_at: new Date(now + PREVIEW_TOKEN_TTL_MS).toISOString() });
}
