import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateId } from '@/lib/ids';
import { validateVariationWeights } from '@/lib/assignment';
import { requireUserContext } from '@/lib/requestAuth';
import { createExperimentSchema, formatZodError } from '@/lib/validation';
import { orgIdForProject } from '@/lib/access';
import { PROJECT_COOKIE } from '@/lib/currentProject';
import { upgradeHintForVariations } from '@/lib/plans';
import { getOrgEntitlements } from '@/lib/entitlements';
import { quotaMessage } from '@/lib/quotas';
import { normalizeHost, normalizePageUrl, urlsMatch } from '@/lib/domains';
import { serializeTargeting } from '@/lib/targeting';
import { bumpMetric, METRICS, recordProductEvent, clientIpFromHeaders } from '@/lib/telemetry';

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
        if (body.goals.filter((g) => g.is_primary).length !== 1) {
            return NextResponse.json({ error: 'Mark exactly one goal as primary' }, { status: 400 });
        }

        const selected = request.cookies.get(PROJECT_COOKIE)?.value;
        const projectId = body.project_id ?? (selected && ctx.projectIds.includes(selected) ? selected : ctx.projectIds[0]);
        if (!projectId || !ctx.projectIds.includes(projectId)) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
        if (!ctx.userId) {
            return NextResponse.json({ error: 'Creating experiments with a secret key is not supported yet' }, { status: 403 });
        }

        const orgId = await orgIdForProject(projectId);
        const org = await db.getOrganization(orgId);
        const ent = await getOrgEntitlements(orgId);
        if (ent.limits.lifetimeExperiments !== null && (org?.experiments_started_total ?? 0) >= ent.limits.lifetimeExperiments) {
            return NextResponse.json({ error: quotaMessage({ allowed: false, limit: ent.limits.lifetimeExperiments, used: org?.experiments_started_total ?? 0, reason: 'lifetime_experiments' }), reason: 'lifetime_experiments' }, { status: 403 });
        }
        const maxVars = ent.limits.maxVariations;
        const nonControl = body.variations.filter((v) => !v.is_control);
        if (maxVars !== null && nonControl.length > maxVars) {
            return NextResponse.json(
                { error: `Your plan allows up to ${maxVars} variation${maxVars === 1 ? '' : 's'}. ${upgradeHintForVariations(org?.plan)}`.trim() },
                { status: 403 },
            );
        }

        const domains = await db.getDomainHosts(projectId);
        if (domains.length === 0) {
            return NextResponse.json({ error: 'Add a domain to this project before creating a test' }, { status: 400 });
        }
        const allUrls = body.variations.map((v) => v.url);
        for (const u of [body.control_url, ...allUrls]) {
            const host = normalizeHost(u);
            if (!host || !domains.includes(host)) {
                return NextResponse.json({ error: `URL must be on a registered domain (${domains.join(', ')}): ${u}` }, { status: 400 });
            }
            if (!normalizePageUrl(u)) {
                return NextResponse.json({ error: `Invalid URL: ${u}` }, { status: 400 });
            }
        }
        const controlVar = body.variations.find((v) => v.is_control)!;
        if (!urlsMatch(controlVar.url, body.control_url)) {
            return NextResponse.json({ error: 'The control variation URL must match the control URL' }, { status: 400 });
        }
        // Unique URLs
        const norms = allUrls.map((u) => normalizePageUrl(u)!);
        if (new Set(norms).size !== norms.length) {
            return NextResponse.json({ error: 'Each variation needs its own URL' }, { status: 400 });
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
                control_url: normalizePageUrl(body.control_url),
                targeting: serializeTargeting(body.targeting),
            },
            body.variations.map((v) => ({ ...v, url: normalizePageUrl(v.url) })),
            body.goals,
        );
        await db.audit({
            orgId,
            actorId: ctx.userId,
            entity: 'experiment',
            entityId: experimentId,
            action: 'create',
            diff: body,
        });
        const variationCount = body.variations.filter((v) => !v.is_control).length;
        await bumpMetric(METRICS.tests_created, { userId: ctx.userId, orgId, projectId, experimentId });
        await bumpMetric(METRICS.variations_created, { userId: ctx.userId, orgId, projectId, experimentId, by: variationCount });
        await recordProductEvent({
            action: 'experiment.create',
            userId: ctx.userId,
            orgId,
            projectId,
            experimentId,
            ip: clientIpFromHeaders(request.headers),
            meta: { variations: body.variations.length, goals: body.goals?.length ?? 0 },
        });

        const experiment = await db.getExperiment(experimentId);
        const variations = await db.getVariations(experimentId);
        const goals = await db.getGoals(experimentId);
        return NextResponse.json({ experiment, variations, goals }, { status: 201 });
    } catch (error) {
        console.error('Failed to create experiment:', error);
        return NextResponse.json({ error: 'Failed to create experiment' }, { status: 500 });
    }
}
