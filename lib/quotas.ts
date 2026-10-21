import { db, monthStartIso } from './db';
import { currentMonth } from './pageviewQuota';
import { getOrgEntitlements } from './entitlements';

/**
 * Plan quota checks. Effective limits come from lib/entitlements.ts (null = unlimited).
 * Visitor usage reads counter rows (usage_monthly.visitors and usage_daily.visitors), cached for a few seconds per org.
 */
export interface QuotaCheck {
    allowed: boolean;
    limit: number | null;
    used: number;
    reason?: 'monthly_visitors' | 'daily_visitors' | 'running_experiments' | 'monthly_experiments';
}

const VISITOR_CACHE_MS = 10_000;
const visitorCache = new Map<string, { at: number; month: string; day: string; monthUsed: number; dayUsed: number }>();

export function clearVisitorCache(): void {
    visitorCache.clear();
}

const today = () => new Date().toISOString().slice(0, 10);

async function visitorUsage(orgId: string) {
    const month = currentMonth();
    const day = today();
    const hit = visitorCache.get(orgId);
    if (hit && hit.month === month && hit.day === day && Date.now() - hit.at < VISITOR_CACHE_MS) return hit;
    const fresh = { at: Date.now(), month, day, monthUsed: await db.getMonthlyVisitors(orgId, month), dayUsed: await db.getDailyVisitors(orgId, day) };
    visitorCache.set(orgId, fresh);
    return fresh;
}

/** Usage numbers for the Overview page. */
export async function getVisitorUsage(orgId: string): Promise<{ month: number; day: number }> {
    const u = await visitorUsage(orgId);
    return { month: u.monthUsed, day: u.dayUsed };
}

/**
 * New visitors are not enrolled once the org has used its monthly or daily tested-visitor limit:
 * they see the original page and are not counted. Visitors already counted this month, and
 * visitors already in a test, are not affected.
 */
export async function checkVisitorQuota(orgId: string, userId?: string): Promise<QuotaCheck> {
    const { monthlyVisitors, dailyVisitors } = (await getOrgEntitlements(orgId)).limits;
    if (monthlyVisitors === null && dailyVisitors === null) return { allowed: true, limit: null, used: 0 };
    const u = await visitorUsage(orgId);
    let blocked: QuotaCheck | null = null;
    if (monthlyVisitors !== null && u.monthUsed >= monthlyVisitors) blocked = { allowed: false, limit: monthlyVisitors, used: u.monthUsed, reason: 'monthly_visitors' };
    else if (dailyVisitors !== null && u.dayUsed >= dailyVisitors) blocked = { allowed: false, limit: dailyVisitors, used: u.dayUsed, reason: 'daily_visitors' };
    if (blocked && userId && (await db.isMonthlyVisitor(orgId, u.month, userId))) return { allowed: true, limit: blocked.limit, used: blocked.used };
    if (blocked) return blocked;
    return { allowed: true, limit: monthlyVisitors, used: u.monthUsed };
}

/** Call after a new assignment. Counts the visitor once per org per month (and on that day). */
export async function recordNewVisitor(orgId: string, userId: string): Promise<void> {
    const month = currentMonth();
    if (await db.addMonthlyVisitor(orgId, month, userId)) {
        const hit = visitorCache.get(orgId);
        if (hit && hit.month === month) { hit.monthUsed += 1; hit.dayUsed += 1; }
    }
}

/**
 * Checks before an experiment goes to running. firstStart = it has never run before.
 * Running limit applies to every start and resume; the admin-set monthly start limit only to first starts.
 */
export async function checkExperimentStartQuota(orgId: string, firstStart = true): Promise<QuotaCheck> {
    const { limits } = await getOrgEntitlements(orgId);
    const org = await db.getOrganization(orgId);
    if (limits.activeExperiments !== null) {
        const running = await db.countRunningExperiments(orgId);
        if (running >= limits.activeExperiments) return { allowed: false, limit: limits.activeExperiments, used: running, reason: 'running_experiments' };
    }
    if (!firstStart) return { allowed: true, limit: null, used: 0 };
    const monthly = org?.monthly_experiment_limit ?? null;
    if (monthly !== null) {
        const used = await db.countExperimentsStartedSince(orgId, monthStartIso());
        if (used >= monthly) return { allowed: false, limit: monthly, used, reason: 'monthly_experiments' };
    }
    return { allowed: true, limit: null, used: 0 };
}

/** Plain messages for each limit. Shown in the UI as returned by the API. */
export function quotaMessage(q: QuotaCheck): string {
    switch (q.reason) {
        case 'running_experiments':
            return `Your plan allows ${q.limit} running test${q.limit === 1 ? '' : 's'} at a time. Pause or complete a running test first, or upgrade to run more.`;
        case 'monthly_experiments':
            return `Monthly experiment limit reached (${q.used} of ${q.limit}). Contact support to upgrade.`;
        case 'monthly_visitors':
            return `You reached ${q.limit?.toLocaleString('en-US')} tested visitors this month. New visitors see your original page until next month. Upgrade for more.`;
        case 'daily_visitors':
            return `You reached ${q.limit?.toLocaleString('en-US')} tested visitors today. New visitors see your original page until tomorrow (UTC). Upgrade for more.`;
        default:
            return 'Plan limit reached.';
    }
}
