import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticateSdkRequest, sdkJson, SDK_CORS_HEADERS } from '@/lib/requestAuth';
import { bootstrapSchema, formatZodError } from '@/lib/validation';
import { normalizePageUrl, urlsMatch } from '@/lib/domains';
import { checkSdkOrigin } from '@/lib/sdkOrigin';
import { heatmapSampleRate, isSampled } from '@/lib/heatmaps';
import { heatmapRate } from '@/lib/heatmapRules';
import type { Experiment } from '@/lib/types';
import { assignUserToVariation, isExperimentEligible } from '@/lib/assignment';
import { checkVisitorQuota, recordNewVisitor } from '@/lib/quotas';
import type { BootstrapResponse } from '@/lib/types';
import { bumpMetric, bumpTraffic, METRICS } from '@/lib/telemetry';
import { trafficDimensions } from '@/lib/traffic';
import { scheduleAutoShift } from '@/lib/autoShiftRun';
import { recordGoalHits } from '@/lib/goalHits';
import { failedRule, parseTargeting } from '@/lib/targeting';
import { segmentOf } from '@/lib/segments';
import { rolloutCoversUrl, rolloutReply } from '@/lib/rollout';
import { countPageview, getPageviewStatus } from '@/lib/pageviewQuota';
import { canUseFeature } from '@/lib/entitlements';
import { parseChanges } from '@/lib/visualChanges';
import { scheduleRetention } from '@/lib/retention';
import { scheduleSchedules, effectiveAllocation } from '@/lib/schedule';
import { parsePopupConfig, popupMatchesUrl, sdkPopup } from '@/lib/popups';
import { parseSurveyConfig, sdkSurvey } from '@/lib/surveys';
import { previewReply } from '@/lib/preview';

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
        // Retention cleanup without a cron: at most hourly across instances, after the response is sent.
        scheduleRetention();
        // Scheduled starts and stops: at most once a minute across instances, after the response.
        scheduleSchedules();

        const parsed = bootstrapSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return sdkJson({ error: formatZodError(parsed.error) }, 400);
        const { url, user_id, referrer, visitor, preview, src } = parsed.data;
        const page = normalizePageUrl(url);
        if (!page) return sdkJson({ error: 'Invalid url' }, 400);

        // The SDK only runs on registered domains (Origin or Referer; localhost for development keys).
        const origin = await checkSdkOrigin(request, auth.ctx);
        if (!origin.ok) {
            return sdkJson({ matched: false, action: 'none', reason: origin.reason } satisfies BootstrapResponse);
        }

        // QA preview link: show the linked variation and record nothing (no assignment, counts or modules).
        if (preview) return sdkJson(await previewReply(preview, auth.ctx.projectId, url));

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
        // JavaScript error tracking (paid) loads errors.js for visitors in a test version.
        const entitled = await canUseFeature(auth.ctx.orgId, 'heatmaps');
        const errorsOn = await canUseFeature(auth.ctx.orgId, 'error_tracking');
        // Popups (paid): active popups whose page rule matches, from the short-lived config cache.
        // popups.js loads only when at least one matches, on any page with the snippet (not on redirects).
        const popups = (await canUseFeature(auth.ctx.orgId, 'popups'))
            ? (await db.getActivePopups(auth.ctx.projectId)).flatMap((p) => {
                const c = parsePopupConfig(p.config);
                return c && popupMatchesUrl(c, url) ? [sdkPopup(p.id, c)] : [];
            })
            : [];
        // Surveys (paid) work the same way and load surveys.js.
        const surveys = (await canUseFeature(auth.ctx.orgId, 'surveys'))
            ? (await db.getActiveSurveys(auth.ctx.projectId)).flatMap((p) => {
                const c = parseSurveyConfig(p.config);
                return c && popupMatchesUrl(c, url) ? [sdkSurvey(p.id, c)] : [];
            })
            : [];
        // The matched test, for its own heatmap sample rate and stop rules.
        let matched: Experiment | null = null;
        const reply = (b: BootstrapResponse) => {
            if (popups.length && b.action !== 'redirect') b = { ...b, popups, modules: [...(b.modules ?? []), 'popups'] };
            if (surveys.length && b.action !== 'redirect') b = { ...b, surveys, modules: [...(b.modules ?? []), 'surveys'] };
            if ((!entitled && !errorsOn) || !b.matched || !b.variation_id || !b.experiment_id || b.action === 'guard' || b.action === 'redirect') return sdkJson(b);
            const rate = matched && matched.id === b.experiment_id ? heatmapRate(matched) : heatmapSampleRate();
            const extra: Partial<BootstrapResponse> = entitled ? { capture: { heatmaps: isSampled(user_id, b.experiment_id, rate), sample_rate: rate } } : {};
            if (errorsOn) extra.modules = [...(b.modules ?? []), 'errors'];
            return sdkJson({ ...b, ...extra });
        };

        // Page-visit goals: any page on a registered domain can complete a goal for visitors already in a test.
        await recordGoalHits({ orgId: auth.ctx.orgId, projectId: auth.ctx.projectId, environmentId: auth.ctx.environmentId, userId: user_id, url })
            .catch((err) => console.error('page goal failed', err));

        const match = await db.findExperimentByPageUrl(auth.ctx.projectId, url);
        if (!match) {
            // Rolled-out winner: the chosen version for everyone, with nothing recorded beyond the page view count.
            const rolled = (await db.getRolloutConfig(auth.ctx.projectId)).find((r) => rolloutCoversUrl(r.experiment, r.variations, url));
            if (rolled) {
                await countPageview(auth.ctx.orgId);
                return reply(rolloutReply(rolled.experiment, rolled.variations, { url, userAgent: request.headers.get('user-agent'), referrer: referrer ?? null, visitorType: visitor ?? null }));
            }
            return reply({ matched: false, action: 'none', reason: 'no_match' });
        }
        const { experiment, variations, goals } = match;
        matched = experiment;
        if (!isExperimentEligible(experiment.status, effectiveAllocation(experiment))) {
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
            const assigned = active.length ? assignUserToVariation(user_id, experiment.id, effectiveAllocation(experiment), active) : null;
            if (!assigned) {
                return reply({ matched: true, action: 'stay', experiment_id: experiment.id, reason: 'outside_traffic', goals: goalPayload, control_url: controlUrl || undefined });
            }
            if (await db.createAssignment({
                experiment_id: experiment.id,
                variation_id: assigned.id,
                user_id,
                environment_id: auth.ctx.environmentId,
                ...segmentOf({ url, userAgent: request.headers.get('user-agent'), referrer, src, visitor }),
            })) await recordNewVisitor(auth.ctx.orgId, user_id);
            variation = assigned;
            assignment = { id: '', experiment_id: experiment.id, variation_id: assigned.id, user_id, environment_id: auth.ctx.environmentId, assigned_at: '', segment_device: null, segment_source: null, segment_visitor: null };
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

        // Visual variations have no URL of their own: on the control page the SDK applies their changes.
        const changes = !variation.is_control && !variation.url && onControl ? parseChanges(variation.changes) : [];
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
            ...(changes.length ? { changes } : {}),
        });
    } catch (error) {
        console.error('bootstrap failed', error);
        return sdkJson({ error: 'Failed to bootstrap' }, 500);
    }
}
