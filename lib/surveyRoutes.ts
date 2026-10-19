import { NextRequest, NextResponse } from 'next/server';
import { db } from './db';
import { featureProject, ownerScope } from './popupRoutes';
import { lastDays } from './traffic';
import { parseSurveyConfig } from './surveys';

export const SURVEY_RANGES = [7, 30, 90] as const;

/** A survey of the signed-in user's projects, with the plan check. Other projects' surveys are not found. */
export async function loadSurvey(request: NextRequest, params: Promise<{ id: string }>) {
    const r = await featureProject(request, 'surveys');
    if (r instanceof NextResponse) return r;
    const { id } = await params;
    const survey = await db.getSurvey(id);
    if (!survey || !r.projectIds.includes(survey.project_id)) return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    const scope = await ownerScope(r, survey.project_id, 'surveys');
    if (scope instanceof NextResponse) return scope;
    return { ...scope, survey };
}

export function surveyRange(request: NextRequest) {
    const asked = Number(request.nextUrl.searchParams.get('days') ?? 30);
    const range = (SURVEY_RANGES as readonly number[]).includes(asked) ? asked : 30;
    const days = lastDays(range);
    return { range, from: days[0], to: days[days.length - 1] };
}

export function surveyJson(p: Awaited<ReturnType<typeof db.getSurvey>>) {
    if (!p) return null;
    return { id: p.id, name: p.name, status: p.status, config: parseSurveyConfig(p.config), created_at: p.created_at, updated_at: p.updated_at };
}
