import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment, orgIdForProject } from '@/lib/access';
import { buildExperimentResults } from '@/lib/results';
import { aiErrorResponse, askText, prepareAi } from '@/lib/ai/service';
import { followupsPrompt, parseFollowups, parseSummary, summaryPrompt, verdictOf } from '@/lib/ai/features';

export const maxDuration = 60;

const bodySchema = z.object({ kind: z.enum(['summary', 'followups']) });

/**
 * POST /api/experiments/[id]/ai { kind }: a plain-words summary of the results ("summary"), or follow-up test ideas
 * for a finished test ("followups"). The verdict is the one from the statistics engine; an answer that contradicts
 * it is not shown.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    if (ctx.via !== 'session') return NextResponse.json({ error: 'Use AI features from the dashboard' }, { status: 403 });
    const experiment = await getAccessibleExperiment(ctx, (await params).id);
    if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Choose summary or followups' }, { status: 400 });
    if (experiment.status === 'draft') return NextResponse.json({ error: 'Start the test first. There are no results to explain yet.' }, { status: 400 });
    if (parsed.data.kind === 'followups' && experiment.status !== 'completed') return NextResponse.json({ error: 'Follow-up ideas are available once the test is stopped.' }, { status: 400 });
    const ai = await prepareAi(await orgIdForProject(experiment.project_id));
    if (ai instanceof NextResponse) return ai;
    try {
        const results = await buildExperimentResults(experiment);
        const extra = { hypothesis: experiment.hypothesis, page_url: experiment.control_url };
        if (parsed.data.kind === 'summary') {
            return NextResponse.json({ ...parseSummary(await askText(ai, summaryPrompt(results, extra)), results), provider: ai.provider, model: ai.model });
        }
        return NextResponse.json({ verdict: verdictOf(results), ideas: parseFollowups(await askText(ai, followupsPrompt(results, extra))), page_url: experiment.control_url, provider: ai.provider, model: ai.model });
    } catch (err) {
        return aiErrorResponse(err, parsed.data.kind === 'summary' ? 'summarize the results' : 'suggest follow-up tests');
    }
}
