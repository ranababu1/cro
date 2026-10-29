import { NextRequest, NextResponse } from 'next/server';
import { currentProject } from '@/lib/popupRoutes';
import { formatZodError } from '@/lib/validation';
import { aiErrorResponse, askText, prepareAi } from '@/lib/ai/service';
import { ideasInput, ideasPrompt, parseIdeas } from '@/lib/ai/features';
import { fetchPageText, pageUrlError } from '@/lib/ai/pageText';

export const maxDuration = 60;

/**
 * POST /api/ai/ideas { url, objective }: reads the public page on the server and asks the organization's AI provider
 * for up to 5 test ideas. Nothing is saved here; the planner adds the ones the user picks through POST /api/ideas.
 */
export async function POST(request: NextRequest) {
    const r = await currentProject(request);
    if (r instanceof NextResponse) return r;
    const parsed = ideasInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    const bad = pageUrlError(parsed.data.url);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
    const ai = await prepareAi(r.orgId);
    if (ai instanceof NextResponse) return ai;
    try {
        const page = await fetchPageText(parsed.data.url);
        const ideas = parseIdeas(await askText(ai, ideasPrompt(page, parsed.data.objective)));
        return NextResponse.json({ page: { url: page.url, title: page.title }, ideas, provider: ai.provider, model: ai.model });
    } catch (err) {
        return aiErrorResponse(err, 'suggest test ideas');
    }
}
