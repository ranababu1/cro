import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment, orgIdForProject } from '@/lib/access';
import { canUseFeature, UPGRADE_NOTE } from '@/lib/entitlements';
import { computeSegments } from '@/lib/segments';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/experiments/[id]/segments?goal=<goal id>&environment=<key>: results per device, landing source and
 * new or returning visitors. Defaults to the primary goal. Paid plans only.
 */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const experiment = await getAccessibleExperiment(ctx, id);
        if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
        const orgId = await orgIdForProject(experiment.project_id);
        if (!orgId || !(await canUseFeature(orgId, 'segments'))) {
            return NextResponse.json({ error: 'Results by segment need a paid plan', upgrade: UPGRADE_NOTE.segments }, { status: 403 });
        }
        const sp = request.nextUrl.searchParams;
        let environmentId: string | undefined;
        const envKey = sp.get('environment');
        if (envKey) {
            const env = (await db.getEnvironments(experiment.project_id)).find((e) => e.key === envKey);
            if (!env) return NextResponse.json({ error: 'Unknown environment' }, { status: 400 });
            environmentId = env.id;
        }
        const [goals, variations] = await Promise.all([db.getGoals(experiment.id), db.getVariations(experiment.id)]);
        const goalParam = sp.get('goal');
        const goal = goalParam ? goals.find((g) => g.id === goalParam) : goals.find((g) => g.is_primary) || goals[0];
        if (goalParam && !goal) return NextResponse.json({ error: 'Unknown goal' }, { status: 400 });
        const rows = await db.getSegmentStats(experiment.id, environmentId, goal?.id ?? null);
        const vars = [...variations].sort((a, b) => Number(b.is_control) - Number(a.is_control)).map((v) => ({ id: v.id, name: v.name, is_control: !!v.is_control }));
        return NextResponse.json({
            goal_id: goal?.id ?? null,
            goal_name: goal?.name ?? null,
            goals: goals.map((g) => ({ goal_id: g.id, goal_name: g.name, is_primary: !!g.is_primary })),
            dimensions: computeSegments(vars, rows),
        });
    } catch (error) {
        console.error('Failed to load segments:', error);
        return NextResponse.json({ error: 'Failed to load segments' }, { status: 500 });
    }
}
