import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticateSdkRequest, sdkJson, SDK_CORS_HEADERS } from '@/lib/requestAuth';
import { checkSdkOrigin } from '@/lib/sdkOrigin';
import { canUseFeature } from '@/lib/entitlements';
import { formatZodError } from '@/lib/validation';
import { answerPath, normalizeAnswer, parseSurveyConfig, surveyEventSchema } from '@/lib/surveys';
import { bumpSurvey } from '@/lib/telemetry';

export function OPTIONS() {
    return new Response(null, { status: 204, headers: SDK_CORS_HEADERS });
}

/** Survey view, close or answer from surveys.js. Kept in memory and written with the telemetry batch. */
export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateSdkRequest(request);
        if ('error' in auth) return auth.error;
        if (!(await canUseFeature(auth.ctx.orgId, 'surveys'))) return sdkJson({ error: 'Surveys need a paid plan' }, 403);
        const origin = await checkSdkOrigin(request, auth.ctx);
        if (!origin.ok) return sdkJson({ error: origin.message }, 403);
        const raw = await request.text().catch(() => '');
        if (raw.length > 6000) return sdkJson({ error: 'Too large' }, 413);
        let body: unknown = null;
        try { body = JSON.parse(raw); } catch { /* invalid */ }
        const parsed = surveyEventSchema.safeParse(body);
        if (!parsed.success) return sdkJson({ error: formatZodError(parsed.error) }, 400);
        // Active surveys come from the short-lived config cache, so this adds no reads per event.
        const survey = (await db.getActiveSurveys(auth.ctx.projectId)).find((p) => p.id === parsed.data.survey_id);
        const c = survey && parseSurveyConfig(survey.config);
        if (!survey || !c) return sdkJson({ error: 'Survey not found or not active' }, 404);
        if (parsed.data.event !== 'response') {
            void bumpSurvey(survey.id, parsed.data.event);
            return sdkJson({ success: true }, 202);
        }
        const answer = normalizeAnswer(c, parsed.data.answer, parsed.data.comment);
        if (!answer) return sdkJson({ error: 'The answer does not fit this question' }, 400);
        void bumpSurvey(survey.id, 'response', { ...answer, path: answerPath(parsed.data.url) });
        return sdkJson({ success: true }, 202);
    } catch (error) {
        console.error('survey event failed', error);
        return sdkJson({ error: 'Failed to record survey event' }, 500);
    }
}
