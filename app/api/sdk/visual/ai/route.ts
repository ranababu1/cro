import { NextRequest, NextResponse } from 'next/server';
import { formatZodError } from '@/lib/validation';
import { orgIdForProject } from '@/lib/access';
import { CORS, json, load } from '@/lib/visualEditorRequest';
import { aiErrorResponse, askText, prepareAi } from '@/lib/ai/service';
import { copyInput, copyPrompt, parseCopy } from '@/lib/ai/features';

export const maxDuration = 60;

export function OPTIONS() {
    return new Response(null, { status: 204, headers: CORS });
}

/**
 * POST /api/sdk/visual/ai { text, tag?, page_title?, goal? }: up to 5 alternative texts for the element selected in
 * the visual editor. Same credential and checks as the editor itself (editor token, project access, domain).
 */
export async function POST(request: NextRequest) {
    const r = await load(request);
    if ('error' in r) return r.error;
    const parsed = copyInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: formatZodError(parsed.error) }, 400);
    const ai = await prepareAi(await orgIdForProject(r.experiment.project_id));
    if (ai instanceof NextResponse) return json(await ai.json(), ai.status);
    try {
        const goal = parsed.data.goal || r.experiment.hypothesis || '';
        return json({ suggestions: parseCopy(await askText(ai, copyPrompt({ ...parsed.data, goal })), parsed.data.text), provider: ai.provider, model: ai.model });
    } catch (err) {
        return aiErrorResponse(err, 'suggest text', CORS);
    }
}
