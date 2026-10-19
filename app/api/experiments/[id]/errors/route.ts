import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment, orgIdForProject } from '@/lib/access';
import { canUseFeature, UPGRADE_NOTE } from '@/lib/entitlements';
import { ERROR_RANGES, summarizeErrors } from '@/lib/jsErrors';
import { lastDays } from '@/lib/traffic';
import { flushTelemetry } from '@/lib/telemetry';

// GET /api/experiments/:id/errors?days=7|30|90 - JavaScript errors per version. Paid plans only.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const experiment = await getAccessibleExperiment(ctx, id);
        if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
        if (!(await canUseFeature(await orgIdForProject(experiment.project_id), 'error_tracking'))) {
            return NextResponse.json({ error: 'Error tracking needs a paid plan', upgrade: UPGRADE_NOTE.error_tracking }, { status: 403 });
        }
        const asked = Number(request.nextUrl.searchParams.get('days') ?? 30);
        const range = (ERROR_RANGES as readonly number[]).includes(asked) ? asked : 30;
        const days = lastDays(range);
        // Counts still in memory on this instance are written first, so a fresh error shows right away.
        await flushTelemetry();
        const [rows, variations, visitors] = await Promise.all([
            db.getErrors(experiment.id, days[0], days[days.length - 1]),
            db.getVariations(experiment.id),
            db.getAssignmentCounts(experiment.id),
        ]);
        return NextResponse.json({ range, from: days[0], to: days[days.length - 1], ...summarizeErrors(rows, variations, visitors) });
    } catch (error) {
        console.error('error report failed', error);
        return NextResponse.json({ error: 'Failed to load errors' }, { status: 500 });
    }
}
