import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatZodError } from '@/lib/validation';
import { parseSurveyConfig, summarizeAnswers, surveyStats, updateSurveySchema } from '@/lib/surveys';
import { loadSurvey, surveyJson, surveyRange } from '@/lib/surveyRoutes';
import { flushTelemetry } from '@/lib/telemetry';

type Params = { params: Promise<{ id: string }> };

/** GET /api/surveys/[id]?days=7|30|90: answer breakdown and the latest written answers. */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const r = await loadSurvey(request, params);
        if (r instanceof NextResponse) return r;
        await flushTelemetry();
        const c = parseSurveyConfig(r.survey.config);
        if (!c) return NextResponse.json({ error: 'Survey settings are invalid' }, { status: 500 });
        const { range, from, to } = surveyRange(request);
        const [counts, stats, recent] = await Promise.all([
            db.getSurveyAnswerCounts(r.survey.id, from, to),
            db.getSurveyStats(r.survey.project_id, from, to),
            db.getSurveyResponses(r.survey.id, from, to, { limit: 50, withCommentOnly: c.type !== 'text' }),
        ]);
        return NextResponse.json({
            survey: surveyJson(r.survey),
            range,
            stats: surveyStats(stats).get(r.survey.id) ?? { views: 0, closes: 0, responses: 0, rate: null },
            answers: summarizeAnswers(c, counts),
            recent,
        });
    } catch (error) {
        console.error('Failed to load survey results:', error);
        return NextResponse.json({ error: 'Failed to load survey results' }, { status: 500 });
    }
}

/** PATCH /api/surveys/[id]: rename, change the question or targeting, turn on or pause. */
export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const r = await loadSurvey(request, params);
        if (r instanceof NextResponse) return r;
        const parsed = updateSurveySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        const { config, ...rest } = parsed.data;
        const p = await db.updateSurvey(r.survey.id, { ...rest, ...(config ? { config: JSON.stringify(config) } : {}) });
        await db.audit({ orgId: r.orgId, actorId: r.userId, entity: 'survey', entityId: r.survey.id, action: 'update', diff: parsed.data });
        return NextResponse.json({ survey: surveyJson(p) });
    } catch (error) {
        console.error('Failed to update survey:', error);
        return NextResponse.json({ error: 'Failed to update survey' }, { status: 500 });
    }
}

/** DELETE /api/surveys/[id]: removes the survey and all its answers. */
export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const r = await loadSurvey(request, params);
        if (r instanceof NextResponse) return r;
        await db.deleteSurvey(r.survey.id);
        await db.audit({ orgId: r.orgId, actorId: r.userId, entity: 'survey', entityId: r.survey.id, action: 'delete' });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete survey:', error);
        return NextResponse.json({ error: 'Failed to delete survey' }, { status: 500 });
    }
}
