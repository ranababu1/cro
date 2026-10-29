import { profileGate } from '@/lib/profileGate';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateId } from '@/lib/ids';
import { validateVariationWeights } from '@/lib/assignment';
import { requireUserContext } from '@/lib/requestAuth';
import { createExperimentSchema, formatZodError } from '@/lib/validation';
import { orgIdForProject } from '@/lib/access';
import { PROJECT_COOKIE } from '@/lib/currentProject';
import { upgradeHintForVariations } from '@/lib/plans';
import { getOrgEntitlements, UPGRADE_NOTE } from '@/lib/entitlements';
import { checkNewTest, recordNewTest } from '@/lib/freeTests';
import { goalPlanError } from '@/lib/goals';
import { normalizeHost, normalizePageUrl, urlsMatch } from '@/lib/domains';
import { serializeTargeting } from '@/lib/targeting';
import { noteOrNull, serializeTags } from '@/lib/experimentManage';
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
        const gate = await profileGate(ctx);
        if (gate) return gate;

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
        const ent = await getOrgEntitlements(orgId);
        const goalError = goalPlanError({ maxGoals: ent.limits.maxGoals, advancedGoals: ent.features.advanced_goals }, body.goals);
        if (goalError) return NextResponse.json({ error: goalError, upgrade: UPGRADE_NOTE.advanced_goals, reason: 'goals' }, { status: 403 });
        const maxVars = ent.limits.maxVariations;
        const nonControl = body.variations.filter((v) => !v.is_control);
        if (maxVars !== null && nonControl.length > maxVars) {
            return NextResponse.json(
                { error: `Your plan allows up to ${maxVars} variation${maxVars === 1 ? '' : 's'}. ${upgradeHintForVariations(ent.plan)}`.trim() },
                { status: 403 },
            );
        }

        // Variations without a URL use the visual editor (Growth and above).
        if (nonControl.some((v) => !v.url) && !ent.features.visual_editor) {
            return NextResponse.json({ error: UPGRADE_NOTE.visual_editor, upgrade: UPGRADE_NOTE.visual_editor }, { status: 403 });
        }

        const domains = await db.getDomainHosts(projectId);
        if (domains.length === 0) {
            return NextResponse.json({ error: 'Add a domain to this project before creating a test' }, { status: 400 });
        }
        const allUrls = body.variations.map((v) => v.url).filter((u): u is string => !!u);
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
        if (!controlVar.url || !urlsMatch(controlVar.url, body.control_url)) {
            return NextResponse.json({ error: 'The control variation URL must match the control URL' }, { status: 400 });
        }
        // Unique URLs (variations without a URL run on the control page with visual changes)
        const norms = allUrls.map((u) => normalizePageUrl(u)!);
        if (new Set(norms).size !== norms.length) {
            return NextResponse.json({ error: 'Each variation needs its own URL' }, { status: 400 });
        }

        // Free plan: new tests per calendar month (UTC), per account and per domain. Deleting a test does not give it back.
        const monthly = await checkNewTest(orgId, body.control_url);
        if (!monthly.ok) {
            return NextResponse.json({ error: monthly.error, reason: monthly.reason, resets_at: monthly.resets_at, limit: monthly.limit }, { status: 403 });
        }

        const experimentId = generateId('exp');
        await db.createExperiment(
            {
                id: experimentId,
                project_id: projectId,
                user_id: ctx.userId,
                name: body.name,
                description: body.description,
                hypothesis: noteOrNull(body.hypothesis),
                expected_outcome: noteOrNull(body.expected_outcome),
                tags: serializeTags(body.tags ?? []),
                status: 'draft',
                traffic_allocation: body.traffic_allocation ?? 100,
                control_url: normalizePageUrl(body.control_url),
                targeting: serializeTargeting(body.targeting),
            },
            body.variations.map((v) => ({ ...v, url: v.url ? normalizePageUrl(v.url) : null })),
            body.goals,
        );
        if (monthly.limit !== null) await recordNewTest(orgId, monthly.domain);
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
