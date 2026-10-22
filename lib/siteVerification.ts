import { db } from './db';
import { registrableDomain } from './domainLedger';
import { getOrgEntitlements } from './entitlements';
import type { Experiment } from './types';

/**
 * Proof of site ownership for Free: a free test starts only after our script has been seen live on the
 * test's domain. "Seen" means an SDK request passed the origin check (lib/sdkOrigin.ts: Origin, or Referer,
 * matches a registered domain of the key's project) within SITE_SEEN_WINDOW_DAYS. project_domains.last_seen_at
 * records it. Paid plans, special friends and platform admins skip the check (entitlements.freeTierRules),
 * and local hosts (localhost, *.localhost) are not checked, matching the domain ledger.
 */
export const SITE_SEEN_WINDOW_DAYS = 7;
const WRITE_GAP_MS = 5 * 60_000;
const recent = new Map<string, number>();

/** Called by the SDK origin check on success. Cheap: at most one write per host every 5 minutes per instance. */
export async function recordSdkSeen(projectId: string, host: string, now = new Date()): Promise<void> {
    const key = `${projectId}|${host}`;
    const last = recent.get(key);
    if (last && now.getTime() - last < WRITE_GAP_MS) return;
    recent.set(key, now.getTime());
    if (recent.size > 20_000) recent.clear();
    try {
        await db.markDomainSeen(projectId, host, now.toISOString(), WRITE_GAP_MS);
    } catch (err) {
        console.error('site seen update failed', err);
    }
}

export function clearSeenThrottle(): void {
    recent.clear();
}

function hostOf(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return null;
    }
}

export interface SiteCheck {
    /** False when the check does not apply (paid, special friend, admin, or a local test page). */
    required: boolean;
    verified: boolean;
    /** The domain the test runs on, e.g. example.com. */
    domain: string | null;
    lastSeenAt: string | null;
}

/** Whether the experiment's site has been verified, for the start check and the setup screen. */
export async function siteCheck(experiment: Pick<Experiment, 'project_id' | 'control_url' | 'id'>, now = new Date()): Promise<SiteCheck> {
    const project = await db.getProject(experiment.project_id);
    if (!project) return { required: false, verified: true, domain: null, lastSeenAt: null };
    const ent = await getOrgEntitlements(project.org_id);
    let host = hostOf(experiment.control_url);
    if (!host) host = hostOf((await db.getVariations(experiment.id)).find((v) => v.url)?.url);
    const rows = await db.listDomains(experiment.project_id);
    const domain = host ? registrableDomain(host) : null;
    // A test page on localhost is not checked; neither are paid, special friend and admin orgs.
    const local = !!host && !domain;
    const candidates = domain ? rows.filter((r) => registrableDomain(r.host) === domain) : rows.filter((r) => registrableDomain(r.host));
    const lastSeenAt = candidates.map((r) => r.last_seen_at).filter((x): x is string => !!x).sort().at(-1) ?? null;
    const fresh = !!lastSeenAt && now.getTime() - new Date(lastSeenAt).getTime() <= SITE_SEEN_WINDOW_DAYS * 86_400_000;
    const required = ent.freeTierRules && !local;
    return { required, verified: !required || fresh, domain: domain ?? (candidates[0] ? registrableDomain(candidates[0].host) : null), lastSeenAt };
}

export function siteNotVerifiedMessage(domain: string | null): string {
    return `Install the snippet to verify your site. Free tests start once our script has loaded on ${domain ?? 'your site'} in the last ${SITE_SEEN_WINDOW_DAYS} days. Add the snippet, open a page with it in your browser, then check again.`;
}
