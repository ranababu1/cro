import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment, orgIdForProject } from '@/lib/access';
import { canUseFeature, UPGRADE_NOTE } from '@/lib/entitlements';
import { computeRevenue } from '@/lib/revenue';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/experiments/[id]/revenue: revenue per variation for each custom event goal
 * (orders sent with ABTest.track('name', { revenue })). Paid plans only.
 */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const experiment = await getAccessibleExperiment(ctx, id);
        if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
        const orgId = await orgIdForProject(experiment.project_id);
        if (!orgId || !(await canUseFeature(orgId, 'revenue_goals'))) {
            return NextResponse.json({ error: 'Revenue goals need a paid plan', upgrade: UPGRADE_NOTE.revenue_goals }, { status: 403 });
        }
        const envKey = request.nextUrl.searchParams.get('environment');
        let environmentId: string | undefined;
        if (envKey) {
            const env = (await db.getEnvironments(experiment.project_id)).find((e) => e.key === envKey);
            if (!env) return NextResponse.json({ error: 'Unknown environment' }, { status: 400 });
            environmentId = env.id;
        }
        const [goals, variations] = await Promise.all([db.getGoals(experiment.id), db.getVariations(experiment.id)]);
        const eventGoals = goals.filter((g) => g.type === 'event');
        const [rows, totals] = await Promise.all([
            db.getRevenueStats(experiment.id, environmentId, eventGoals.map((g) => g.id)),
            db.getEventStatsByGoal(experiment.id, environmentId, []),
        ]);
        const visitors = new Map((totals.get('') ?? []).map((r) => [r.variation_id, Number(r.total_users)]));
        const vars = [...variations].sort((a, b) => Number(b.is_control) - Number(a.is_control)).map((v) => ({ id: v.id, name: v.name, is_control: !!v.is_control }));
        const out = eventGoals.map((g) => {
            const mine = rows.filter((r) => r.goal_id === g.id);
            return { goal_id: g.id, goal_name: g.name, event_name: g.selector, has_revenue: mine.some((r) => r.revenue > 0 || r.orders > 0), ...computeRevenue(vars, visitors, mine) };
        });
        return NextResponse.json({ goals: out });
    } catch (error) {
        console.error('Failed to load revenue:', error);
        return NextResponse.json({ error: 'Failed to load revenue' }, { status: 500 });
    }
}
