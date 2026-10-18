import { db } from './db';
import { apiKeyType, isWellFormedApiKey } from './apiKeys';
import { isHostAllowed, normalizeHost } from './domains';
import { isLocalHost } from './domainLedger';
import { getOrgEntitlements } from './entitlements';
import { logAbuse } from './abuse';

export type PluginStatus = 'ok' | 'invalid_key' | 'suspended' | 'not_paid' | 'no_domains' | 'domain_not_allowed';

/** Shown in the plugin's admin screen. Plain words, nothing about how the check works. */
export const PLUGIN_STATUS_MESSAGES: Record<PluginStatus, string> = {
    ok: 'Connected. The snippet is active on this site.',
    invalid_key: 'This key is not valid. Copy the public SDK key from your freeabtest.com dashboard.',
    suspended: 'This freeabtest.com account is suspended.',
    not_paid: 'The WordPress plugin is available to paid users only. Upgrade your freeabtest.com plan to use it.',
    no_domains: 'Add this site\'s domain in your freeabtest.com dashboard under Domains.',
    domain_not_allowed: 'This site\'s domain is not registered for this key. Add it in your freeabtest.com dashboard under Domains.',
};

/**
 * Checks a key the plugin wants to connect with: it must be a live public SDK key, the org must be
 * allowed to use the plugin (paid, special friend grant or platform admin), and the site must be one of
 * the project's registered domains (development keys also work on localhost).
 */
export async function verifyPluginKey(key: string, siteUrl: string): Promise<PluginStatus> {
    if (!isWellFormedApiKey(key) || apiKeyType(key) !== 'sdk') return 'invalid_key';
    const ctx = await db.authenticateApiKey(key);
    if (!ctx) return 'invalid_key';
    if (ctx.orgStatus !== 'active') return 'suspended';
    const host = normalizeHost(siteUrl);
    if (!(await getOrgEntitlements(ctx.orgId)).features.wordpress_plugin) {
        void logAbuse(ctx.orgId, 'plugin_verify_refused', { reason: 'not_paid', host: host ?? '' });
        return 'not_paid';
    }
    if (ctx.environmentKey === 'dev' && isLocalHost(host)) return 'ok';
    const hosts = await db.getDomainHosts(ctx.projectId);
    if (hosts.length === 0) return 'no_domains';
    if (!isHostAllowed(host, hosts)) {
        void logAbuse(ctx.orgId, 'plugin_verify_refused', { reason: 'domain', host: host ?? '' });
        return 'domain_not_allowed';
    }
    return 'ok';
}
