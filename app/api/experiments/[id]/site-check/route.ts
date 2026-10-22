import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment } from '@/lib/access';
import { siteCheck } from '@/lib/siteVerification';

type Params = { params: Promise<{ id: string }> };

// GET /api/experiments/[id]/site-check - Whether the test's site has been verified (Free: script seen live recently).
export async function GET(request: NextRequest, { params }: Params) {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    const { id } = await params;
    const experiment = await getAccessibleExperiment(ctx, id);
    if (!experiment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ site: await siteCheck(experiment) });
}
