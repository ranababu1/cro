import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateId } from '@/lib/ids';
import { validateVariationWeights } from '@/lib/assignment';
import { requireUserContext } from '@/lib/requestAuth';
import { createExperimentSchema, formatZodError } from '@/lib/validation';
import { orgIdForProject } from '@/lib/access';

// GET /api/experiments - List experiments the caller can access
export async function GET(request: NextRequest) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const experiments = await db.getExperiments(ctx.projectIds);
        return NextResponse.json({ experiments });
    } catch (error) {
        console.error('Failed to fetch experiments:', error);
        return NextResponse.json({ error: 'Failed to fetch experiments' }, { status: 500 });
    }
}

// POST /api/experiments - Create a new experiment
export async function POST(request: NextRequest) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;

        const parsed = createExperimentSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        }
        const body = parsed.data;

        if (!validateVariationWeights(body.variations)) {
            return NextResponse.json({ error: 'Variation weights must sum to 100' }, { status: 400 });
        }
        if (body.variations.filter((v) => v.is_control).length !== 1) {
            return NextResponse.json({ error: 'Exactly one variation must be marked as control' }, { status: 400 });
        }

        const projectId = body.project_id ?? ctx.projectIds[0];
        if (!projectId || !ctx.projectIds.includes(projectId)) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
        // Experiments need a human owner. Secret-key callers have none yet.
        if (!ctx.userId) {
            return NextResponse.json({ error: 'Creating experiments with a secret key is not supported yet' }, { status: 403 });
        }

        const experimentId = generateId('exp');
        await db.createExperiment(
            {
                id: experimentId,
                project_id: projectId,
                user_id: ctx.userId,
                name: body.name,
                description: body.description,
                status: 'draft',
                traffic_allocation: body.traffic_allocation ?? 100,
            },
            body.variations,
        );
        await db.audit({
            orgId: await orgIdForProject(projectId),
            actorId: ctx.userId,
            entity: 'experiment',
            entityId: experimentId,
            action: 'create',
            diff: body,
        });

        const experiment = await db.getExperiment(experimentId);
        const variations = await db.getVariations(experimentId);
        return NextResponse.json({ experiment, variations }, { status: 201 });
    } catch (error) {
        console.error('Failed to create experiment:', error);
        return NextResponse.json({ error: 'Failed to create experiment' }, { status: 500 });
    }
}
