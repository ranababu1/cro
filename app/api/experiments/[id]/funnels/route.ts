import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment, orgIdForProject } from '@/lib/access';
import { canUseFeature, UPGRADE_NOTE } from '@/lib/entitlements';
import { computeFunnel, computeFunnelTrend, funnelSchema, MAX_FUNNELS, parseSteps, pickBucket } from '@/lib/funnels';
import { formatZodError } from '@/lib/validation';
import type { Experiment } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

/** Shared guard: signed in, can see the experiment, and the org may use funnels (paid only). */
async function guard(request: NextRequest, params: Params['params']): Promise<{ experiment: Experiment; orgId: string; userId: string | null } | NextResponse> {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    const { id } = await params;
    const experiment = await getAccessibleExperiment(ctx, id);
    if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    const orgId = await orgIdForProject(experiment.project_id);
    if (!orgId || !(await canUseFeature(orgId, 'funnels'))) return NextResponse.json({ error: 'Funnels need a paid plan', upgrade: UPGRADE_NOTE.funnels }, { status: 403 });
    return { experiment, orgId, userId: ctx.userId };
}

/** GET /api/experiments/[id]/funnels?environment=&trend=day|week: funnels with per-variation step counts and a trend. */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const g = await guard(request, params);
        if (g instanceof NextResponse) return g;
        const { experiment } = g;
        const envKey = request.nextUrl.searchParams.get('environment');
        let environmentId: string | undefined;
        if (envKey) {
            const env = (await db.getEnvironments(experiment.project_id)).find((e) => e.key === envKey);
            if (!env) return NextResponse.json({ error: 'Unknown environment' }, { status: 400 });
            environmentId = env.id;
        }
        const [list, goals, variations] = await Promise.all([db.listFunnels(experiment.id), db.getGoals(experiment.id), db.getVariations(experiment.id)]);
        const names = new Map(goals.map((x) => [x.id, x.name]));
        const allSteps = [...new Set(list.flatMap((f) => parseSteps(f.steps)).filter((id) => names.has(id)))];
        const [hits, totals] = await Promise.all([
            db.getFirstGoalHits(experiment.id, environmentId, allSteps),
            db.getEventStatsByGoal(experiment.id, environmentId, []),
        ]);
        const visitors = new Map((totals.get('') ?? []).map((r) => [r.variation_id, Number(r.total_users)]));
        const vars = [...variations].sort((a, b) => Number(b.is_control) - Number(a.is_control)).map((v) => ({ id: v.id, name: v.name, is_control: !!v.is_control }));
        // Trend periods: days for up to 60 days of data, weeks after that, unless ?trend= asks for one.
        const times = hits.map((h) => h.t).sort();
        const bucket = pickBucket(times[0] ?? null, times[times.length - 1] ?? null, request.nextUrl.searchParams.get('trend'));
        const funnels = list.map((f) => {
            const steps = parseSteps(f.steps);
            const live = steps.filter((id) => names.has(id)).map((id) => ({ id, name: names.get(id)! }));
            const own = hits.filter((h) => live.some((s) => s.id === h.goal_id));
            return {
                id: f.id,
                name: f.name,
                steps: live,
                removed_steps: steps.length - live.length,
                variations: live.length >= 2 ? computeFunnel(live, vars, visitors, own) : [],
                trend: live.length >= 2 ? computeFunnelTrend(live, vars, own, bucket) : null,
            };
        });
        return NextResponse.json({ funnels, max: MAX_FUNNELS });
    } catch (error) {
        console.error('Failed to load funnels:', error);
        return NextResponse.json({ error: 'Failed to load funnels' }, { status: 500 });
    }
}

/** POST /api/experiments/[id]/funnels: { name, steps: goal ids in order }. */
export async function POST(request: NextRequest, { params }: Params) {
    try {
        const g = await guard(request, params);
        if (g instanceof NextResponse) return g;
        const parsed = funnelSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        const goals = await db.getGoals(g.experiment.id);
        if (!parsed.data.steps.every((id) => goals.some((x) => x.id === id))) return NextResponse.json({ error: 'Every step must be a goal of this test' }, { status: 400 });
        if ((await db.listFunnels(g.experiment.id)).length >= MAX_FUNNELS) return NextResponse.json({ error: `A test can have up to ${MAX_FUNNELS} funnels` }, { status: 400 });
        const id = await db.createFunnel(g.experiment.id, parsed.data.name, parsed.data.steps);
        await db.audit({ orgId: g.orgId, actorId: g.userId, entity: 'experiment', entityId: g.experiment.id, action: 'funnel:add', diff: { id, ...parsed.data } });
        return NextResponse.json({ id }, { status: 201 });
    } catch (error) {
        console.error('Failed to add funnel:', error);
        return NextResponse.json({ error: 'Failed to add funnel' }, { status: 500 });
    }
}

/** DELETE /api/experiments/[id]/funnels?funnel=ID */
export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const g = await guard(request, params);
        if (g instanceof NextResponse) return g;
        const funnelId = request.nextUrl.searchParams.get('funnel') ?? '';
        if (!(await db.deleteFunnel(g.experiment.id, funnelId))) return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
        await db.audit({ orgId: g.orgId, actorId: g.userId, entity: 'experiment', entityId: g.experiment.id, action: 'funnel:remove', diff: { id: funnelId } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Failed to remove funnel:', error);
        return NextResponse.json({ error: 'Failed to remove funnel' }, { status: 500 });
    }
}
