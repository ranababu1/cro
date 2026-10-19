import { db } from './db';
import { planMonthlyPageviews, UNLIMITED } from './plans';
import { getOrgEntitlements } from './entitlements';
import { clearConfigCache } from './configCache';

/**
 * Monthly tracked pageview quota. When an organization reaches its cap, collection pauses:
 * the SDK gets no test for the rest of the month, so visitors simply see the original page.
 * There is no overage. Organizations with a platform admin as a member are unlimited.
 *
 * Status is cached per org in memory for a few seconds so the hot path reads one row at most
 * once per cache window. The cap can be overshot by a handful of pageviews during that window.
 */
export interface PageviewStatus {
    limit: number | null; // null = unlimited
    used: number;
    paused: boolean;
    month: string;
}

const CACHE_MS = 10_000;
const cache = new Map<string, { at: number; status: PageviewStatus }>();

export function currentMonth(now = new Date()): string {
    return now.toISOString().slice(0, 7);
}

export function clearPageviewCache(): void {
    cache.clear();
    clearConfigCache();
}

/** Effective limit: org override, else plan default; -1 or an admin member means unlimited. */
export function effectivePageviewLimit(org: { plan: string; plan_override?: string | null; monthly_pageview_limit: number | null }, hasAdminMember: boolean): number | null {
    if (hasAdminMember) return null;
    if (org.monthly_pageview_limit === UNLIMITED) return null;
    return org.monthly_pageview_limit ?? planMonthlyPageviews(org.plan_override || org.plan);
}

export async function getPageviewStatus(orgId: string, opts: { fresh?: boolean } = {}): Promise<PageviewStatus> {
    const month = currentMonth();
    const hit = cache.get(orgId);
    if (!opts.fresh && hit && hit.status.month === month && Date.now() - hit.at < CACHE_MS) return hit.status;
    const org = await db.getOrganization(orgId);
    // Plan default, org override, special friend allowance and admin bypass all resolve in the entitlement helper.
    const limit = org ? (await getOrgEntitlements(orgId)).limits.monthlyPageviews : null;
    const used = await db.getMonthlyPageviews(orgId, month);
    const status = { limit, used, paused: limit !== null && used >= limit, month };
    cache.set(orgId, { at: Date.now(), status });
    return status;
}

/** Counts one tracked pageview. Call only after checking the org is not paused. */
export async function countPageview(orgId: string): Promise<void> {
    const month = currentMonth();
    await db.addMonthlyPageviews(orgId, month, 1);
    const hit = cache.get(orgId);
    if (hit && hit.status.month === month) {
        hit.status.used += 1;
        hit.status.paused = hit.status.limit !== null && hit.status.used >= hit.status.limit;
    }
}
