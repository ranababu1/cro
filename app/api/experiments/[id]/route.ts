import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment, orgIdForProject } from '@/lib/access';
import { updateExperimentSchema, formatZodError } from '@/lib/validation';
import type { ExperimentStatus } from '@/lib/types';
import { checkExperimentStartQuota, quotaMessage } from '@/lib/quotas';
import { getOrgEntitlements } from '@/lib/entitlements';
import { checkDomainTests, countDomainTest } from '@/lib/domainLedger';
import { logAbuse } from '@/lib/abuse';
import { serializeTargeting } from '@/lib/targeting';
import { bumpMetric, METRICS, recordProductEvent, clientIpFromHeaders } from '@/lib/telemetry';

type Params = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ error: 'Experiment not found' }, { status: 404 });

const VALID_TRANSITIONS: Record<ExperimentStatus, ExperimentStatus[]> = {
    draft: ['running'],
    running: ['paused', 'completed'],
    paused: ['running', 'completed'],
    completed: [],
};

// GET /api/experiments/[id]
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const experiment = await getAccessibleExperiment(ctx, id);
        if (!experiment) return notFound();
        const variations = await db.getVariations(id);
        const goals = await db.getGoals(id);
        return NextResponse.json({ experiment, variations, goals });
    } catch (error) {
        console.error('Failed to fetch experiment:', error);
        return NextResponse.json({ error: 'Failed to fetch experiment' }, { status: 500 });
    }
}

// PATCH /api/experiments/[id]
export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const experiment = await getAccessibleExperiment(ctx, id);
        if (!experiment) return notFound();

        const parsed = updateExperimentSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        const { targeting, ...rest } = parsed.data;
        const updates: Parameters<typeof db.updateExperiment>[1] = { ...rest };
        let countDomain: string | null = null;
        // Targeting applies to new visitors only; people already in the test keep their version.
        if (targeting !== undefined) updates.targeting = serializeTargeting(targeting);

        if (updates.status && updates.status !== experiment.status) {
            if (!VALID_TRANSITIONS[experiment.status].includes(updates.status)) {
                return NextResponse.json(
                    { error: `Cannot transition from ${experiment.status} to ${updates.status}` },
                    { status: 400 },
                );
            }
            if (updates.status === 'running') {
                // Plan limits: running tests at a time on every start or resume; lifetime and monthly limits on first start.
                const firstStart = !experiment.started_at;
                const quota = await checkExperimentStartQuota(await orgIdForProject(experiment.project_id), firstStart);
                if (!quota.allowed) {
                    return NextResponse.json({ error: quotaMessage(quota), reason: quota.reason }, { status: 403 });
                }
                if (firstStart) {
                    const orgId = await orgIdForProject(experiment.project_id);
                    if ((await getOrgEntitlements(orgId)).freeTierRules) {
                        const dom = await checkDomainTests(experiment.control_url);
                        if (!dom.ok) {
                            await logAbuse(orgId, 'domain_exhausted', { domain: dom.domain, experiment: id }, ctx.userId);
                            return NextResponse.json({ error: dom.message, reason: 'domain_exhausted' }, { status: 403 });
                        }
                        countDomain = dom.domain;
                    }
                    updates.started_at = new Date().toISOString();
                }
            }
            if (updates.status === 'completed' && !experiment.ended_at) updates.ended_at = new Date().toISOString();
        }

        await db.updateExperiment(id, updates);
        if (updates.started_at) {
            const orgId = await orgIdForProject(experiment.project_id);
            await db.incrementExperimentsStarted(orgId);
            if (countDomain) await countDomainTest(countDomain, orgId);
        }
        if (updates.status === 'running' && experiment.status !== 'running') {
            const orgId = await orgIdForProject(experiment.project_id);
            await bumpMetric(METRICS.tests_started, { userId: ctx.userId, orgId, projectId: experiment.project_id, experimentId: id });
            await recordProductEvent({ action: 'experiment.start', userId: ctx.userId, orgId, projectId: experiment.project_id, experimentId: id, ip: clientIpFromHeaders(request.headers) });
        }
        if (updates.status === 'completed' && experiment.status !== 'completed') {
            const orgId = await orgIdForProject(experiment.project_id);
            await bumpMetric(METRICS.tests_completed, { userId: ctx.userId, orgId, projectId: experiment.project_id, experimentId: id });
            await recordProductEvent({ action: 'experiment.complete', userId: ctx.userId, orgId, projectId: experiment.project_id, experimentId: id, ip: clientIpFromHeaders(request.headers) });
        }
        await db.audit({
            orgId: await orgIdForProject(experiment.project_id),
            actorId: ctx.userId,
            entity: 'experiment',
            entityId: id,
            action: updates.status && updates.status !== experiment.status ? `status:${updates.status}` : 'update',
            diff: parsed.data,
        });

        const updatedExperiment = await db.getExperiment(id);
        const variations = await db.getVariations(id);
        const goals = await db.getGoals(id);
        return NextResponse.json({ experiment: updatedExperiment, variations, goals });
    } catch (error) {
        console.error('Failed to update experiment:', error);
        return NextResponse.json({ error: 'Failed to update experiment' }, { status: 500 });
    }
}

// DELETE /api/experiments/[id] - Only drafts can be deleted
export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const { id } = await params;
        const experiment = await getAccessibleExperiment(ctx, id);
        if (!experiment) return notFound();
        if (experiment.status !== 'draft') {
            return NextResponse.json({ error: 'Only draft experiments can be deleted' }, { status: 400 });
        }
        await db.deleteExperiment(id);
        await db.audit({
            orgId: await orgIdForProject(experiment.project_id),
            actorId: ctx.userId,
            entity: 'experiment',
            entityId: id,
            action: 'delete',
            diff: { name: experiment.name },
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete experiment:', error);
        return NextResponse.json({ error: 'Failed to delete experiment' }, { status: 500 });
    }
}
