import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { responsesCsv } from '@/lib/surveys';
import { loadSurvey, surveyRange } from '@/lib/surveyRoutes';
import { flushTelemetry } from '@/lib/telemetry';

/** GET /api/surveys/[id]/export?days=7|30|90: kept answers as CSV, newest first. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const r = await loadSurvey(request, params);
        if (r instanceof NextResponse) return r;
        await flushTelemetry();
        const { range, from, to } = surveyRange(request);
        const rows = await db.getSurveyResponses(r.survey.id, from, to, { limit: 50_000 });
        const name = r.survey.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'survey';
        return new NextResponse(responsesCsv(rows), {
            headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}-last-${range}-days.csv"`, 'Cache-Control': 'no-store' },
        });
    } catch (error) {
        console.error('Failed to export survey:', error);
        return NextResponse.json({ error: 'Failed to export answers' }, { status: 500 });
    }
}
