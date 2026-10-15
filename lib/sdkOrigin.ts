import type { NextRequest } from 'next/server';
import { db, type SdkKeyContext } from './db';
import { hostFromRequestHeaders, isHostAllowed } from './domains';
import { isLocalHost } from './domainLedger';
import { logAbuse } from './abuse';

export type OriginCheck = { ok: true; host: string } | { ok: false; reason: 'no_domains' | 'domain_not_allowed' | 'origin_missing'; message: string };

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
    if (devLocal) return { ok: true, host };
    const hosts = await db.getDomainHosts(ctx.projectId);
    if (hosts.length === 0) return { ok: false, reason: 'no_domains', message: 'No domains registered for this project' };
    if (!isHostAllowed(host, hosts)) {
        void logAbuse(ctx.orgId, 'origin_mismatch', { host, project: ctx.projectId });
        return { ok: false, reason: 'domain_not_allowed', message: 'Domain not allowed' };
    }
    return { ok: true, host };
}
