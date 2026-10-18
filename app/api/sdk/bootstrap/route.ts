import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticateSdkRequest, sdkJson, SDK_CORS_HEADERS } from '@/lib/requestAuth';
import { bootstrapSchema, formatZodError } from '@/lib/validation';
import { normalizePageUrl, urlsMatch } from '@/lib/domains';
import { checkSdkOrigin } from '@/lib/sdkOrigin';
import { heatmapSampleRate, isSampled } from '@/lib/heatmaps';
import { assignUserToVariation, isExperimentEligible } from '@/lib/assignment';
import { checkVisitorQuota, recordNewVisitor } from '@/lib/quotas';
import type { BootstrapResponse } from '@/lib/types';
import { bumpMetric, bumpTraffic, METRICS } from '@/lib/telemetry';
import { trafficDimensions } from '@/lib/traffic';
import { scheduleAutoShift } from '@/lib/autoShiftRun';
import { recordGoalHits } from '@/lib/goalHits';
import { failedRule, parseTargeting } from '@/lib/targeting';
import { countPageview, getPageviewStatus } from '@/lib/pageviewQuota';
import { canUseFeature } from '@/lib/entitlements';

export function OPTIONS() {
    return new Response(null, { status: 204, headers: SDK_CORS_HEADERS });
}

/**
 * SDK entry point: given the current page URL and visitor id, match a running experiment,
 * sticky-assign if needed, and tell the SDK whether to stay, redirect, or guard.
 */
export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateSdkRequest(request);
        if ('error' in auth) return auth.error;
        void bumpMetric(METRICS.sdk_bootstrap, { orgId: auth.ctx.orgId, projectId: auth.ctx.projectId });

        const parsed = bootstrapSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return sdkJson({ error: formatZodError(parsed.error) }, 400);
        const { url, user_id, referrer, visitor } = parsed.data;
        const page = normalizePageUrl(url);
        if (!page) return sdkJson({ error: 'Invalid url' }, 400);

        // The SDK only runs on registered domains (Origin or Referer; localhost for development keys).
        const origin = await checkSdkOrigin(request, auth.ctx);
        if (!origin.ok) {
            return sdkJson({ matched: false, action: 'none', reason: origin.reason } satisfies BootstrapResponse);
        }

        // Monthly pageview cap reached: pause collection. Visitors see the original page.
        if ((await getPageviewStatus(auth.ctx.orgId)).paused) {
            return sdkJson({ matched: false, action: 'none', reason: 'quota_paused' } satisfies BootstrapResponse);
        }

        // Traffic overview (paid): one page view into the daily counters, flushed with telemetry in one batch.
        if (auth.ctx.environmentId && (await canUseFeature(auth.ctx.orgId, 'traffic'))) {
            void bumpTraffic(
                { environmentId: auth.ctx.environmentId, projectId: auth.ctx.projectId },
                trafficDimensions({ url, referrer, userAgent: request.headers.get('user-agent'), country: request.headers.get('x-vercel-ip-country'), visitor }),
            );
        }

        // Heavy capture (heatmaps) is offered only to entitled orgs; free orgs never get a capture config.
        // Sampling is per visitor and experiment, so the capture module only loads for sampled sessions.
        const entitled = await canUseFeature(auth.ctx.orgId, 'heatmaps');
        const reply = (b: BootstrapResponse) => {
            if (!entitled || !b.matched || !b.variation_id || !b.experiment_id || b.action === 'guard' || b.action === 'redirect') return sdkJson(b);
            const rate = heatmapSampleRate();
            return sdkJson({ ...b, capture: { heatmaps: isSampled(user_id, b.experiment_id, rate), sample_rate: rate } });
        };

        // Page-visit goals: any page on a registered domain can complete a goal for visitors already in a test.
        await recordGoalHits({ orgId: auth.ctx.orgId, projectId: auth.ctx.projectId, environmentId: auth.ctx.environmentId, userId: user_id, url })
            .catch((err) => console.error('page goal failed', err));

        const match = await db.findExperimentByPageUrl(auth.ctx.projectId, url);
        if (!match) {
            return reply({ matched: false, action: 'none', reason: 'no_match' });
        }
        const { experiment, variations, goals } = match;
        if (!isExperimentEligible(experiment.status, experiment.traffic_allocation)) {
            return reply({ matched: false, action: 'none', reason: 'not_running' });
        }
        // Auto-shift (Growth+): recompute the split at most hourly, after the response is sent.
        scheduleAutoShift(experiment, auth.ctx.orgId);

        // Only click and form goals run in the browser. Page and event goals are matched on the server.
        await countPageview(auth.ctx.orgId);

        const goalPayload = goals.filter((g) => g.type === 'click' || g.type === 'form').map((g) => ({ id: g.id, name: g.name, type: g.type, selector: g.selector, is_primary: g.is_primary }));
        const controlUrl = experiment.control_url || variations.find((v) => v.is_control)?.url || '';
        const onControl = !!(controlUrl && urlsMatch(controlUrl, url));
        const onVariation = variations.find((v) => !v.is_control && v.url && urlsMatch(v.url, url));

        let assignment = await db.getAssignment(experiment.id, user_id);
        let variation = assignment ? variations.find((v) => v.id === assignment!.variation_id) : null;

        if (!assignment) {
            const failed = failedRule(parseTargeting(experiment.targeting), {
                url,
                userAgent: request.headers.get('user-agent'),
                referrer: referrer ?? null,
                visitorType: visitor ?? null,
            });
            if (failed) {
                return reply({ matched: true, action: 'stay', experiment_id: experiment.id, reason: 'not_targeted', control_url: controlUrl || undefined });
            }
            const quota = await checkVisitorQuota(auth.ctx.orgId, user_id);
            if (!quota.allowed) {
                return reply({ matched: true, action: 'stay', experiment_id: experiment.id, reason: 'quota_exceeded', goals: goalPayload, control_url: controlUrl || undefined });
            }
            const active = variations.filter((v) => !v.paused && v.weight > 0);
            const assigned = active.length ? assignUserToVariation(user_id, experiment.id, experiment.traffic_allocation, active) : null;
            if (!assigned) {
                return reply({ matched: true, action: 'stay', experiment_id: experiment.id, reason: 'outside_traffic', goals: goalPayload, control_url: controlUrl || undefined });
            }
            if (await db.createAssignment({
                experiment_id: experiment.id,
                variation_id: assigned.id,
                user_id,
                environment_id: auth.ctx.environmentId,
            })) await recordNewVisitor(auth.ctx.orgId, user_id);
            variation = assigned;
            assignment = { id: '', experiment_id: experiment.id, variation_id: assigned.id, user_id, environment_id: auth.ctx.environmentId, assigned_at: '' };
        }

        if (!variation) {
            return reply({ matched: true, action: 'stay', experiment_id: experiment.id, goals: goalPayload });
        }

        // On a variation page but assigned elsewhere: guard (do not count as this variation's exposure).
        if (onVariation && onVariation.id !== variation.id) {
            return reply({
                matched: true,
                action: 'guard',
                experiment_id: experiment.id,
                variation_id: variation.id,
                variation_name: variation.name,
                variation_url: variation.url ?? undefined,
                is_control: !!variation.is_control,
                control_url: controlUrl || undefined,
                goals: goalPayload,
            });
        }

        // On control, assigned to a variation: redirect.
        if (onControl && !variation.is_control && variation.url) {
            // Record the redirect server side so it counts even if the visitor leaves before the variation loads.
            await db.createEvent({
                experiment_id: experiment.id,
                variation_id: variation.id,
                environment_id: auth.ctx.environmentId,
                user_id,
                event_type: 'redirect',
                event_name: null,
                goal_id: null,
                metadata: null,
            }).catch((err) => console.error('redirect event failed', err));
            return reply({
                matched: true,
                action: 'redirect',
                experiment_id: experiment.id,
                variation_id: variation.id,
                variation_name: variation.name,
                variation_url: variation.url,
                is_control: false,
                control_url: controlUrl || undefined,
                goals: goalPayload,
            });
        }

        return reply({
            matched: true,
            action: 'stay',
            experiment_id: experiment.id,
            variation_id: variation.id,
            variation_name: variation.name,
            variation_url: variation.url ?? undefined,
            is_control: !!variation.is_control,
            control_url: controlUrl || undefined,
            goals: goalPayload,
        });
    } catch (error) {
        console.error('bootstrap failed', error);
        return sdkJson({ error: 'Failed to bootstrap' }, 500);
    }
}
