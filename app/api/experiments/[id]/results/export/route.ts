import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment, orgIdForProject } from '@/lib/access';
import { dailyBuckets } from '@/lib/rollups';
import { resultsCsv, resultsCsvName } from '@/lib/resultsCsv';

/**
 * GET /api/experiments/:id/results/export?environment= - results per UTC day, version and goal as CSV. All plans.
 * Read from the daily rollups, so it costs about the same as opening the results.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const experiment = await getAccessibleExperiment(ctx, id);
        if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
        const envKey = request.nextUrl.searchParams.get('environment');
        let environmentId: string | undefined;
        if (envKey) {
            const env = (await db.getEnvironments(experiment.project_id)).find((e) => e.key === envKey);
            if (!env) return NextResponse.json({ error: 'Unknown environment' }, { status: 400 });
            environmentId = env.id;
        }
        const now = new Date();
        const [rows, variations, goals] = await Promise.all([dailyBuckets(experiment.id, environmentId, now), db.getVariations(experiment.id), db.getGoals(experiment.id)]);
        const csv = resultsCsv(rows, variations.map((v) => ({ id: v.id, name: v.name, is_control: !!v.is_control })), goals.map((g) => ({ id: g.id, name: g.name, is_primary: !!g.is_primary })));
        const orgId = await orgIdForProject(experiment.project_id);
        if (orgId) await db.audit({ orgId, actorId: ctx.userId, entity: 'experiment', entityId: experiment.id, action: 'results:export', diff: { environment: envKey ?? 'all' } });
        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${resultsCsvName(experiment.name, envKey, now)}"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        console.error('results export failed', error);
        return NextResponse.json({ error: 'Failed to export results' }, { status: 500 });
    }
}
