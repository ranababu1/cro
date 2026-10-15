import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { AssignmentResponse } from '@/lib/types';
import { assignUserToVariation, isExperimentEligible } from '@/lib/assignment';
import { authenticateSdkRequest, sdkJson, SDK_CORS_HEADERS } from '@/lib/requestAuth';
import { z } from 'zod';
import { formatZodError } from '@/lib/validation';
import { checkVisitorQuota, recordNewVisitor } from '@/lib/quotas';
import { bumpMetric, METRICS } from '@/lib/telemetry';

const assignBody = z.object({
    experiment_id: z.string().min(1).max(100),
    user_id: z.string().min(1).max(200).regex(/^[\x21-\x7e]+$/),
});

const notAssigned = (experimentId: string): AssignmentResponse => ({
    experiment_id: experimentId,
    variation_id: '',
    variation_name: '',
    assigned: false,
});

export function OPTIONS() {
    return new Response(null, { status: 204, headers: SDK_CORS_HEADERS });
}

export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateSdkRequest(request);
        if ('error' in auth) return auth.error;

        // Count every assign request; unique_visitors only when a new assignment is stored.
        void bumpMetric(METRICS.sdk_assign, { orgId: auth.ctx.orgId, projectId: auth.ctx.projectId });

        const parsed = assignBody.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return sdkJson({ error: formatZodError(parsed.error) }, 400);
        const { experiment_id: experimentId, user_id: userId } = parsed.data;

        const experiment = await db.getExperiment(experimentId);
        if (!experiment || experiment.project_id !== auth.ctx.projectId) {
            return sdkJson({ error: 'Experiment not found' }, 404);
        }

        const variations = await db.getVariations(experimentId);
        const existing = await db.getAssignment(experimentId, userId);
        if (existing) {
            const variation = variations.find((v) => v.id === existing.variation_id);
            if (variation && experiment.status === 'running') {
                return sdkJson({
                    experiment_id: experimentId,
                    variation_id: variation.id,
                    variation_name: variation.name,
                    variation_url: variation.url ?? undefined,
                    assigned: true,
                } satisfies AssignmentResponse);
            }
        }

        if (!isExperimentEligible(experiment.status, experiment.traffic_allocation)) {
            return sdkJson(notAssigned(experimentId));
        }
        if (variations.length === 0) {
            return sdkJson({ error: 'No variations found for this experiment' }, 400);
        }

        const active = variations.filter((v) => !v.paused && v.weight > 0);
        const assigned = active.length ? assignUserToVariation(userId, experimentId, experiment.traffic_allocation, active) : null;
        if (!assigned) return sdkJson(notAssigned(experimentId));

        const quota = await checkVisitorQuota(auth.ctx.orgId);
        if (!quota.allowed) {
            return sdkJson({ ...notAssigned(experimentId), reason: 'quota_exceeded' } satisfies AssignmentResponse);
        }

        await bumpMetric(METRICS.unique_visitors, { orgId: auth.ctx.orgId, projectId: auth.ctx.projectId, experimentId });
        if (await db.createAssignment({
            experiment_id: experimentId,
            variation_id: assigned.id,
            user_id: userId,
            environment_id: auth.ctx.environmentId,
        })) await recordNewVisitor(auth.ctx.orgId, userId);

        return sdkJson({
            experiment_id: experimentId,
            variation_id: assigned.id,
            variation_name: assigned.name,
            variation_url: assigned.url ?? undefined,
            assigned: true,
        } satisfies AssignmentResponse);
    } catch (error) {
        console.error('Failed to assign user:', error);
        void bumpMetric(METRICS.errors, {});
        return sdkJson({ error: 'Failed to assign user' }, 500);
    }
}
