import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatZodError } from '@/lib/validation';
import { createSurveySchema, MAX_SURVEYS_PER_PROJECT, surveyStats } from '@/lib/surveys';
import { featureProject } from '@/lib/popupRoutes';
import { surveyJson } from '@/lib/surveyRoutes';
import { flushTelemetry } from '@/lib/telemetry';
import { lastDays } from '@/lib/traffic';

/** GET /api/surveys: surveys of the current project with views and responses for the last 30 days. Paid only. */
export async function GET(request: NextRequest) {
    try {
        const r = await featureProject(request, 'surveys');
        if (r instanceof NextResponse) return r;
        await flushTelemetry();
        const days = lastDays(30);
        const [list, rows] = await Promise.all([db.listSurveys(r.projectId), db.getSurveyStats(r.projectId, days[0], days[days.length - 1])]);
        const stats = surveyStats(rows);
        return NextResponse.json({
            project_id: r.projectId,
            max: MAX_SURVEYS_PER_PROJECT,
            surveys: list.map((p) => ({ ...surveyJson(p), stats: stats.get(p.id) ?? { views: 0, closes: 0, responses: 0, rate: null } })),
        });
    } catch (error) {
        console.error('Failed to list surveys:', error);
        return NextResponse.json({ error: 'Failed to load surveys' }, { status: 500 });
    }
}

/** POST /api/surveys: create a survey in the current project. */
export async function POST(request: NextRequest) {
    try {
        const r = await featureProject(request, 'surveys');
        if (r instanceof NextResponse) return r;
        const parsed = createSurveySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        if ((await db.listSurveys(r.projectId)).length >= MAX_SURVEYS_PER_PROJECT) {
            return NextResponse.json({ error: `A project can have up to ${MAX_SURVEYS_PER_PROJECT} surveys. Delete one you no longer use.` }, { status: 400 });
        }
        const p = await db.createSurvey({ project_id: r.projectId, name: parsed.data.name, status: parsed.data.status, config: JSON.stringify(parsed.data.config) });
        await db.audit({ orgId: r.orgId, actorId: r.userId, entity: 'survey', entityId: p.id, action: 'create', diff: parsed.data });
        return NextResponse.json({ survey: surveyJson(p) }, { status: 201 });
    } catch (error) {
        console.error('Failed to create survey:', error);
        return NextResponse.json({ error: 'Failed to create survey' }, { status: 500 });
    }
}
