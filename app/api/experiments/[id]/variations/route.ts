import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment, orgIdForProject } from '@/lib/access';
import { allocationSchema, formatZodError } from '@/lib/validation';
import { checkAllocation } from '@/lib/allocation';

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/experiments/[id]/variations: change weights and pause or resume variations.
 * Allowed for draft, running and paused tests. URLs and the set of variations cannot change once a test has started,
 * and visitors already assigned always keep their version.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const experiment = await getAccessibleExperiment(ctx, id);
        if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
        if (experiment.status === 'completed') return NextResponse.json({ error: 'A completed test cannot be edited' }, { status: 400 });

        const parsed = allocationSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

        const current = await db.getVariations(id);
        const check = checkAllocation(current, parsed.data.variations);
        if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

        await db.updateVariationAllocation(id, check.rows);
        await db.audit({
            orgId: await orgIdForProject(experiment.project_id),
            actorId: ctx.userId,
            entity: 'experiment',
            entityId: id,
            action: 'allocation',
            diff: check.rows,
        });
        return NextResponse.json({ variations: await db.getVariations(id) });
    } catch (error) {
        console.error('Failed to update allocation:', error);
        return NextResponse.json({ error: 'Failed to update variations' }, { status: 500 });
    }
}
