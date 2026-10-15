import { db, monthStartIso } from './db';
import { currentMonth } from './pageviewQuota';

/**
 * Basic plan quota checks. Limits live on the organization (null = unlimited) and reset each calendar month (UTC).
 * Visitor usage reads a monthly counter row (usage_monthly.visitors), cached for a few seconds per org.
 */
export interface QuotaCheck {
    allowed: boolean;
    limit: number | null;
    used: number;
}

/** New visitors are not enrolled once the org has used its monthly visitor limit. Existing visitors keep their variant. */
export async function checkVisitorQuota(orgId: string): Promise<QuotaCheck> {
    const org = await db.getOrganization(orgId);
    const limit = org?.monthly_visitor_limit ?? null;
    if (limit === null) return { allowed: true, limit, used: 0 };
    const month = currentMonth();
    const hit = visitorCache.get(orgId);
    let used: number;
    if (hit && hit.month === month && Date.now() - hit.at < VISITOR_CACHE_MS) used = hit.used;
    else {
        used = await db.getMonthlyVisitors(orgId, month);
        visitorCache.set(orgId, { at: Date.now(), month, used });
    }
    return { allowed: used < limit, limit, used };
}

const VISITOR_CACHE_MS = 10_000;
const visitorCache = new Map<string, { at: number; month: string; used: number }>();

export function clearVisitorCache(): void {
    visitorCache.clear();
}

/** Call after a new assignment. Counts the visitor once per org per month. */
export async function recordNewVisitor(orgId: string, userId: string): Promise<void> {
    const month = currentMonth();
    if (await db.addMonthlyVisitor(orgId, month, userId)) {
        const hit = visitorCache.get(orgId);
        if (hit && hit.month === month) hit.used += 1;
    }
}

/** Starting a new experiment is blocked once the org has started its monthly limit. Resuming a paused one is not. */
export async function checkExperimentStartQuota(orgId: string): Promise<QuotaCheck> {
    const org = await db.getOrganization(orgId);
    const limit = org?.monthly_experiment_limit ?? null;
    if (limit === null) return { allowed: true, limit, used: 0 };
    const used = await db.countExperimentsStartedSince(orgId, monthStartIso());
    return { allowed: used < limit, limit, used };
}
