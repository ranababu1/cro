import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateId } from '@/lib/ids';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment, orgIdForProject } from '@/lib/access';
import { profileGate } from '@/lib/profileGate';
import { getOrgEntitlements, UPGRADE_NOTE } from '@/lib/entitlements';
import { checkNewTest, recordNewTest } from '@/lib/freeTests';
import { goalPlanError } from '@/lib/goals';
import { upgradeHintForVariations } from '@/lib/plans';
import { normalizeHost } from '@/lib/domains';
import { copyName } from '@/lib/experimentManage';
import { bumpMetric, METRICS, recordProductEvent, clientIpFromHeaders } from '@/lib/telemetry';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/experiments/[id]/duplicate: copies a test's setup into a new draft named "Copy of ...". Variations,
 * weights, visual changes, goals, funnels, targeting, pages, notes and tags are copied. Results, schedules, share
 * links and rollouts are not. It counts as a new test, so the same plan checks as creating one apply.
 */
export async function POST(request: NextRequest, { params }: Params) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const gate = await profileGate(ctx);
        if (gate) return gate;
        const source = await getAccessibleExperiment(ctx, (await params).id);
        if (!source) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
        if (!ctx.userId) return NextResponse.json({ error: 'Copying tests with a secret key is not supported yet' }, { status: 403 });

        const orgId = await orgIdForProject(source.project_id);
        const ent = await getOrgEntitlements(orgId);
        const [variations, goals, funnels] = await Promise.all([db.getVariations(source.id), db.getGoals(source.id), db.listFunnels(source.id)]);

        // The plan may have changed since the test was made, so check what the copy needs.
        const goalError = goalPlanError({ maxGoals: ent.limits.maxGoals, advancedGoals: ent.features.advanced_goals }, goals);
        if (goalError) return NextResponse.json({ error: goalError, upgrade: UPGRADE_NOTE.advanced_goals, reason: 'goals' }, { status: 403 });
        const nonControl = variations.filter((v) => !v.is_control);
        const maxVars = ent.limits.maxVariations;
        if (maxVars !== null && nonControl.length > maxVars) {
            return NextResponse.json({ error: `Your plan allows up to ${maxVars} variation${maxVars === 1 ? '' : 's'}. ${upgradeHintForVariations(ent.plan)}`.trim(), reason: 'variations' }, { status: 403 });
        }
        const visual = nonControl.some((v) => !v.url) || !!source.pages || !!source.mvt;
        if (visual && !ent.features.visual_editor) {
            return NextResponse.json({ error: UPGRADE_NOTE.visual_editor, upgrade: UPGRADE_NOTE.visual_editor, reason: 'visual_editor' }, { status: 403 });
        }
        if (!source.control_url) return NextResponse.json({ error: 'This test has no control URL to copy' }, { status: 400 });
        const hosts = await db.getDomainHosts(source.project_id);
        for (const u of [source.control_url, ...variations.map((v) => v.url).filter((x): x is string => !!x)]) {
            const host = normalizeHost(u);
            if (!host || !hosts.includes(host)) {
                return NextResponse.json({ error: `URL must be on a registered domain (${hosts.join(', ') || 'none yet'}): ${u}` }, { status: 400 });
            }
        }

        // Free plan: a copy is a new test (1 a month, per account and per domain). Admins and special friends follow their own limits.
        const monthly = await checkNewTest(orgId, source.control_url);
        if (!monthly.ok) {
            return NextResponse.json({ error: monthly.error, reason: monthly.reason, resets_at: monthly.resets_at, limit: monthly.limit }, { status: 403 });
        }

        const id = generateId('exp');
        await db.createExperiment(
            {
                id,
                project_id: source.project_id,
                user_id: ctx.userId,
                name: copyName(source.name),
                description: source.description,
                hypothesis: source.hypothesis,
                expected_outcome: source.expected_outcome,
                tags: source.tags,
                status: 'draft',
                traffic_allocation: source.traffic_allocation,
                control_url: source.control_url,
                targeting: source.targeting,
                pages: source.pages,
                mvt: source.mvt,
                auto_shift: source.auto_shift && ent.features.auto_shift,
                ramp_start: source.ramp_start,
                ramp_step: source.ramp_step,
                ramp_every_hours: source.ramp_every_hours,
                ...(ent.features.heatmaps ? { heatmap_sample: source.heatmap_sample, heatmap_stop_days: source.heatmap_stop_days, heatmap_stop_views: source.heatmap_stop_views } : {}),
            },
            variations.map((v) => ({ name: v.name, description: v.description, url: v.url, weight: v.weight, is_control: v.is_control, changes: v.changes, combo: v.combo })),
            goals.map((g) => ({ name: g.name, selector: g.selector, is_primary: g.is_primary, type: g.type, match_type: g.match_type })),
        );
        // Funnels point at goal ids, so map each old goal to its copy (goals keep their order).
        let funnelsCopied = 0;
        if (funnels.length && ent.features.funnels) {
            const newGoals = await db.getGoals(id);
            const map = new Map(goals.map((g, i) => [g.id, newGoals[i]?.id]));
            for (const f of funnels) {
                let steps: unknown;
                try { steps = JSON.parse(f.steps); } catch { continue; }
                if (!Array.isArray(steps)) continue;
                const mapped = steps.map((s) => map.get(String(s)));
                if (mapped.every((s): s is string => !!s)) { await db.createFunnel(id, f.name, mapped); funnelsCopied++; }
            }
        }
        if (monthly.limit !== null) await recordNewTest(orgId, monthly.domain);
        await db.audit({ orgId, actorId: ctx.userId, entity: 'experiment', entityId: id, action: 'create', diff: { name: copyName(source.name), duplicated_from: source.id } });
        await db.audit({ orgId, actorId: ctx.userId, entity: 'experiment', entityId: source.id, action: 'duplicate', diff: { copy: id } });
        await bumpMetric(METRICS.tests_created, { userId: ctx.userId, orgId, projectId: source.project_id, experimentId: id });
        await bumpMetric(METRICS.variations_created, { userId: ctx.userId, orgId, projectId: source.project_id, experimentId: id, by: nonControl.length });
        await recordProductEvent({
            action: 'experiment.duplicate', userId: ctx.userId, orgId, projectId: source.project_id, experimentId: id,
            ip: clientIpFromHeaders(request.headers), meta: { from: source.id, variations: variations.length, goals: goals.length, funnels: funnelsCopied },
        });
        return NextResponse.json({ experiment: await db.getExperiment(id), variations: await db.getVariations(id), goals: await db.getGoals(id) }, { status: 201 });
    } catch (error) {
        console.error('Failed to duplicate experiment:', error);
        return NextResponse.json({ error: 'Failed to copy the test' }, { status: 500 });
    }
}
