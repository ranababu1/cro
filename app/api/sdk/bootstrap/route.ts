import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticateSdkRequest, sdkJson, SDK_CORS_HEADERS } from '@/lib/requestAuth';
import { bootstrapSchema, formatZodError } from '@/lib/validation';
import { hostFromRequestHeaders, isHostAllowed, normalizePageUrl, urlsMatch } from '@/lib/domains';
import { assignUserToVariation, isExperimentEligible } from '@/lib/assignment';
import { checkVisitorQuota } from '@/lib/quotas';
import type { BootstrapResponse } from '@/lib/types';
import { bumpMetric, METRICS } from '@/lib/telemetry';

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

        const hosts = await db.getDomainHosts(auth.ctx.projectId);
        const reqHost = hostFromRequestHeaders(request.headers.get('origin'), request.headers.get('referer'));
        // Server-side / same-origin tools may omit Origin; still require a registered domain list and a matching URL host.
        const parsed = bootstrapSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return sdkJson({ error: formatZodError(parsed.error) }, 400);
        const { url, user_id } = parsed.data;
        const page = normalizePageUrl(url);
        if (!page) return sdkJson({ error: 'Invalid url' }, 400);

        let pageHost: string | null = null;
        try { pageHost = new URL(url).hostname.toLowerCase(); } catch { /* ignore */ }
        if (hosts.length === 0) {
            return sdkJson({ matched: false, action: 'none', reason: 'no_domains' } satisfies BootstrapResponse);
        }
        const allowed = isHostAllowed(reqHost, hosts) || isHostAllowed(pageHost, hosts);
        if (!allowed) {
            return sdkJson({ matched: false, action: 'none', reason: 'domain_not_allowed' } satisfies BootstrapResponse);
        }

        const match = await db.findExperimentByPageUrl(auth.ctx.projectId, url);
        if (!match) {
            return sdkJson({ matched: false, action: 'none', reason: 'no_match' } satisfies BootstrapResponse);
        }
        const { experiment, variations, goals } = match;
        if (!isExperimentEligible(experiment.status, experiment.traffic_allocation)) {
            return sdkJson({ matched: false, action: 'none', reason: 'not_running' } satisfies BootstrapResponse);
        }

        const goalPayload = goals.map((g) => ({ id: g.id, name: g.name, selector: g.selector, is_primary: g.is_primary }));
        const controlUrl = experiment.control_url || variations.find((v) => v.is_control)?.url || '';
        const onControl = !!(controlUrl && urlsMatch(controlUrl, url));
        const onVariation = variations.find((v) => !v.is_control && v.url && urlsMatch(v.url, url));

        let assignment = await db.getAssignment(experiment.id, user_id);
        let variation = assignment ? variations.find((v) => v.id === assignment!.variation_id) : null;

        if (!assignment) {
            const quota = await checkVisitorQuota(auth.ctx.orgId);
            if (!quota.allowed) {
                return sdkJson({ matched: true, action: 'stay', experiment_id: experiment.id, reason: 'quota_exceeded', goals: goalPayload, control_url: controlUrl || undefined } satisfies BootstrapResponse);
            }
            const assigned = assignUserToVariation(user_id, experiment.id, experiment.traffic_allocation, variations);
            if (!assigned) {
                return sdkJson({ matched: true, action: 'stay', experiment_id: experiment.id, reason: 'outside_traffic', goals: goalPayload, control_url: controlUrl || undefined } satisfies BootstrapResponse);
            }
            await db.createAssignment({
                experiment_id: experiment.id,
                variation_id: assigned.id,
                user_id,
                environment_id: auth.ctx.environmentId,
            });
            variation = assigned;
            assignment = { id: '', experiment_id: experiment.id, variation_id: assigned.id, user_id, environment_id: auth.ctx.environmentId, assigned_at: '' };
        }

        if (!variation) {
            return sdkJson({ matched: true, action: 'stay', experiment_id: experiment.id, goals: goalPayload } satisfies BootstrapResponse);
        }

        // On a variation page but assigned elsewhere: guard (do not count as this variation's exposure).
        if (onVariation && onVariation.id !== variation.id) {
            return sdkJson({
                matched: true,
                action: 'guard',
                experiment_id: experiment.id,
                variation_id: variation.id,
                variation_name: variation.name,
                variation_url: variation.url ?? undefined,
                is_control: !!variation.is_control,
                control_url: controlUrl || undefined,
                goals: goalPayload,
            } satisfies BootstrapResponse);
        }

        // On control, assigned to a variation: redirect.
        if (onControl && !variation.is_control && variation.url) {
            return sdkJson({
                matched: true,
                action: 'redirect',
                experiment_id: experiment.id,
                variation_id: variation.id,
                variation_name: variation.name,
                variation_url: variation.url,
                is_control: false,
                control_url: controlUrl || undefined,
                goals: goalPayload,
            } satisfies BootstrapResponse);
        }

        return sdkJson({
            matched: true,
            action: 'stay',
            experiment_id: experiment.id,
            variation_id: variation.id,
            variation_name: variation.name,
            variation_url: variation.url ?? undefined,
            is_control: !!variation.is_control,
            control_url: controlUrl || undefined,
            goals: goalPayload,
        } satisfies BootstrapResponse);
    } catch (error) {
        console.error('bootstrap failed', error);
        return sdkJson({ error: 'Failed to bootstrap' }, 500);
    }
}
