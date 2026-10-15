import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment } from '@/lib/access';
import { buildExperimentResults } from '@/lib/results';

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

        return NextResponse.json(await buildExperimentResults(experiment, environmentId));
    } catch (error) {
        console.error('Failed to fetch experiment results:', error);
        return NextResponse.json({ error: 'Failed to fetch experiment results' }, { status: 500 });
    }
}
