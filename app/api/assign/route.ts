import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { AssignmentResponse } from '@/lib/types';
import { assignUserToVariation, isExperimentEligible } from '@/lib/assignment';
import { authenticateSdkRequest, sdkJson, SDK_CORS_HEADERS } from '@/lib/requestAuth';
import { assignSchema, formatZodError } from '@/lib/validation';
import { checkVisitorQuota } from '@/lib/quotas';

const notAssigned = (experimentId: string): AssignmentResponse => ({
    experiment_id: experimentId,
    variation_id: '',
    variation_name: '',
    assigned: false,
});

export function OPTIONS() {
    return new Response(null, { status: 204, headers: SDK_CORS_HEADERS });
}

// POST /api/assign - Get or create a visitor's assignment. Requires an SDK key.
export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateSdkRequest(request);
        if ('error' in auth) return auth.error;

        const parsed = assignSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return sdkJson({ error: formatZodError(parsed.error) }, 400);
        const body = parsed.data;

        const experiment = await db.getExperiment(body.experiment_id);
        // Experiments from other projects look the same as missing ones.
        if (!experiment || experiment.project_id !== auth.ctx.projectId) {
            return sdkJson({ error: 'Experiment not found' }, 404);
        }

        const variations = await db.getVariations(body.experiment_id);

        const existing = await db.getAssignment(body.experiment_id, body.user_id);
        if (existing) {
            const variation = variations.find((v) => v.id === existing.variation_id);
            if (variation && experiment.status === 'running') {
                return sdkJson({
                    experiment_id: body.experiment_id,
                    variation_id: variation.id,
                    variation_name: variation.name,
                    variation_url: variation.url ?? undefined,
                    assigned: true,
                } satisfies AssignmentResponse);
            }
        }

        if (!isExperimentEligible(experiment.status, experiment.traffic_allocation)) {
            return sdkJson(notAssigned(body.experiment_id));
        }
        if (variations.length === 0) {
            return sdkJson({ error: 'No variations found for this experiment' }, 400);
        }

        const assigned = assignUserToVariation(body.user_id, body.experiment_id, experiment.traffic_allocation, variations);
        if (!assigned) return sdkJson(notAssigned(body.experiment_id));

        // Quota hook: stop enrolling new visitors past the plan's monthly limit.
        const quota = await checkVisitorQuota(auth.ctx.orgId);
        if (!quota.allowed) {
            return sdkJson({ ...notAssigned(body.experiment_id), reason: 'quota_exceeded' } satisfies AssignmentResponse);
        }

        await db.createAssignment({
            experiment_id: body.experiment_id,
            variation_id: assigned.id,
            user_id: body.user_id,
            environment_id: auth.ctx.environmentId,
        });

        return sdkJson({
            experiment_id: body.experiment_id,
            variation_id: assigned.id,
            variation_name: assigned.name,
            variation_url: assigned.url ?? undefined,
            assigned: true,
        } satisfies AssignmentResponse);
    } catch (error) {
        console.error('Failed to assign user:', error);
        return sdkJson({ error: 'Failed to assign user' }, 500);
    }
}
