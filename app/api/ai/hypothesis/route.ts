import { NextRequest, NextResponse } from 'next/server';
import { currentProject } from '@/lib/popupRoutes';
import { formatZodError } from '@/lib/validation';
import { aiErrorResponse, askText, prepareAi } from '@/lib/ai/service';
import { hypothesisInput, hypothesisPrompt, parseHypotheses } from '@/lib/ai/features';

export const maxDuration = 60;

/** POST /api/ai/hypothesis { name?, page_url?, change?, goals?, variations? }: up to 3 hypotheses with an expected outcome. */
export async function POST(request: NextRequest) {
    const r = await currentProject(request);
    if (r instanceof NextResponse) return r;
    const parsed = hypothesisInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    const ai = await prepareAi(r.orgId);
    if (ai instanceof NextResponse) return ai;
    try {
        return NextResponse.json({ suggestions: parseHypotheses(await askText(ai, hypothesisPrompt(parsed.data))), provider: ai.provider, model: ai.model });
    } catch (err) {
        return aiErrorResponse(err, 'suggest a hypothesis');
    }
}
