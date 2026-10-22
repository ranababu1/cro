import type { NextRequest } from 'next/server';
import { db, type SdkKeyContext } from './db';
import { hostFromRequestHeaders, isHostAllowed } from './domains';
import { isLocalHost } from './domainLedger';
import { logAbuse } from './abuse';
import { getOrgEntitlements } from './entitlements';
import { recordSdkSeen } from './siteVerification';

export type OriginCheck = { ok: true; host: string } | { ok: false; reason: 'no_domains' | 'domain_not_allowed' | 'origin_missing' | 'plan_required'; message: string };

/** Requests from the WordPress plugin carry via=wp (the SDK copies it from the script tag to every call). */
export function isPluginRequest(request: NextRequest): boolean {
    return request.nextUrl.searchParams.get('via') === 'wp';
}

/**
 * The SDK only works on the org's registered domains. The calling page is taken from Origin, or
 * Referer when Origin is absent; requests with neither are refused. Development keys also work
 * on localhost. Mismatches are logged as abuse attempts (throttled).
 */
export async function checkSdkOrigin(request: NextRequest, ctx: SdkKeyContext): Promise<OriginCheck> {
    const host = hostFromRequestHeaders(request.headers.get('origin'), request.headers.get('referer'));
    const devLocal = ctx.environmentKey === 'dev' && isLocalHost(host);
    if (!host) {
        void logAbuse(ctx.orgId, 'origin_missing', { project: ctx.projectId });
        return { ok: false, reason: 'origin_missing', message: 'Requests must come from a page on a registered domain' };
    }
    if (devLocal) return pluginGate(request, ctx, host);
    const hosts = await db.getDomainHosts(ctx.projectId);
    if (hosts.length === 0) return { ok: false, reason: 'no_domains', message: 'No domains registered for this project' };
    if (!isHostAllowed(host, hosts)) {
        void logAbuse(ctx.orgId, 'origin_mismatch', { host, project: ctx.projectId });
        return { ok: false, reason: 'domain_not_allowed', message: 'Domain not allowed' };
    }
    const gate = await pluginGate(request, ctx, host);
    // Proof the script is live on this registered domain (free tests need it before they start).
    if (gate.ok) void recordSdkSeen(ctx.projectId, host);
    return gate;
}

async function pluginGate(request: NextRequest, ctx: SdkKeyContext, host: string): Promise<OriginCheck> {
    // The plugin is paid only: plugin traffic from an org that is not entitled gets nothing.
    if (isPluginRequest(request) && !(await getOrgEntitlements(ctx.orgId)).features.wordpress_plugin) {
        void logAbuse(ctx.orgId, 'plugin_unpaid', { host, project: ctx.projectId });
        return { ok: false, reason: 'plan_required', message: 'The WordPress plugin needs a paid plan' };
    }
    return { ok: true, host };
}
