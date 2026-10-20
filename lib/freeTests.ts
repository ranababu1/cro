import { and, eq, sql } from 'drizzle-orm';
import { getDb } from './db/client';
import * as s from './db/schema';
import { getOrgEntitlements } from './entitlements';
import { registrableDomain } from './domainLedger';

/**
 * Free plan: new tests per calendar month (UTC). Counted when a test is created, per account and, for orgs under the
 * free-tier rules, per registrable domain of the test page, so several free accounts on one domain share one
 * allowance. Counters never go down: deleting a test does not give the allowance back.
 * Admins (no limits) and special friends (their own monthly_tests setting, no domain rule) bypass this.
 */
export { usageMonth, monthResetAt, formatResetDate } from './monthReset';
import { usageMonth, monthResetAt, formatResetDate } from './monthReset';

export async function testsCreatedThisMonth(scope: 'org' | 'domain', key: string, now = new Date()): Promise<number> {
    const d = await getDb();
    const row = await d.query.freeTestUsage.findFirst({ where: and(eq(s.freeTestUsage.scope, scope), eq(s.freeTestUsage.key, key), eq(s.freeTestUsage.month, usageMonth(now))) });
    return row?.tests ?? 0;
}

async function bump(scope: 'org' | 'domain', key: string, month: string): Promise<void> {
    const d = await getDb();
    await d.insert(s.freeTestUsage).values({ scope, key, month, tests: 1 })
        .onConflictDoUpdate({ target: [s.freeTestUsage.scope, s.freeTestUsage.key, s.freeTestUsage.month], set: { tests: sql`${s.freeTestUsage.tests} + 1`, updated_at: new Date().toISOString() } });
}

export type NewTestCheck =
    | { ok: true; limit: number | null; used: number; domain: string | null }
    | { ok: false; reason: 'monthly_tests' | 'domain_monthly_tests'; limit: number; used: number; domain: string | null; resets_at: string; error: string };

export function monthlyTestsMessage(limit: number, resetsAt: string, domain?: string | null): string {
    const when = formatResetDate(resetsAt);
    const what = `${limit} new test${limit === 1 ? '' : 's'} a month`;
    return domain
        ? `${domain} has already had its ${what} on the free plan. You can create the next one on ${when}, or upgrade to Starter or above to create more now.`
        : `The free plan includes ${what}, and you have created it this month. Deleting a test does not give it back. You can create the next one on ${when}, or upgrade to Starter or above to create more now.`;
}

/** Before creating a test. */
export async function checkNewTest(orgId: string, controlUrl: string, now = new Date()): Promise<NewTestCheck> {
    const ent = await getOrgEntitlements(orgId);
    const limit = ent.limits.monthlyTests;
    const domain = ent.freeTierRules ? registrableDomain(controlUrl) : null;
    if (limit === null) return { ok: true, limit: null, used: 0, domain };
    const resets_at = monthResetAt(now);
    const used = await testsCreatedThisMonth('org', orgId, now);
    if (used >= limit) return { ok: false, reason: 'monthly_tests', limit, used, domain, resets_at, error: monthlyTestsMessage(limit, resets_at) };
    if (domain) {
        const byDomain = await testsCreatedThisMonth('domain', domain, now);
        if (byDomain >= limit) return { ok: false, reason: 'domain_monthly_tests', limit, used: byDomain, domain, resets_at, error: monthlyTestsMessage(limit, resets_at, domain) };
    }
    return { ok: true, limit, used, domain };
}

/** After a test is created: counts it for the account and, under the free-tier rules, for its domain. */
export async function recordNewTest(orgId: string, domain: string | null, now = new Date()): Promise<void> {
    const month = usageMonth(now);
    await bump('org', orgId, month);
    if (domain) await bump('domain', domain, month);
}
