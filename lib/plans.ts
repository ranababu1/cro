/**
 * Plan defaults. Effective limits (with admin bypass and special friend overrides) come from
 * lib/entitlements.ts; read them there, not here.
 * Free: A/B only (control plus 1 variation). Paid: control plus up to 50.
 */
export const FREE_MAX_VARIATIONS = 1;
export const PAID_MAX_VARIATIONS = 50;
/** Free tier: tested visitors (new visitors enrolled in a test). */
export const FREE_MONTHLY_VISITORS = 10_000;
export const FREE_DAILY_VISITORS = 300;
/** Free tier: concurrently running experiments, experiments started over the account's lifetime, projects. */
export const FREE_RUNNING_EXPERIMENTS = 1;
export const FREE_LIFETIME_EXPERIMENTS = 10;
export const FREE_PROJECTS = 1;
/** Free tier: registered domains per account (localhost for development does not count). */
export const FREE_DOMAINS = 1;

/** Projects and team seats per plan, as on the pricing page. Enterprise is set per contract (special friend allowances); null is no cap. */
export const PLAN_PROJECTS = [FREE_PROJECTS, 3, 10, null] as const;
export const PLAN_SEATS = [1, 5, 15, null] as const;

/** Plan rank: 0 Free, 1 Starter, 2 Growth, 3 Enterprise. Unknown paid plan names rank as Starter. */
export function planTier(plan: string | null | undefined): number {
    const p = (plan || 'free').toLowerCase();
    if (p === 'free') return 0;
    if (p === 'growth') return 2;
    if (p === 'enterprise') return 3;
    return 1;
}

export function isPaidPlan(plan: string | null | undefined): boolean {
    const p = (plan || 'free').toLowerCase();
    return p !== 'free';
}

/** Maximum number of non-control variation URLs for an organization plan. */
export function maxVariationUrlsForPlan(plan: string | null | undefined): number {
    return isPaidPlan(plan) ? PAID_MAX_VARIATIONS : FREE_MAX_VARIATIONS;
}

export function upgradeHintForVariations(plan: string | null | undefined): string {
    if (isPaidPlan(plan)) return '';
    return `The free plan is A/B only: a control plus ${FREE_MAX_VARIATIONS} variation. Upgrade to add up to ${PAID_MAX_VARIATIONS}.`;
}

/**
 * Tracked pageviews per month. A pageview is a page load on a page that is part of a running test.
 * Free has no pageview cap: its usage is limited by tested visitors (monthly and daily) instead.
 */
export const FREE_MONTHLY_PAGEVIEWS: number | null = null;
export const PAID_MONTHLY_PAGEVIEWS = 500_000;
/** Stored in organizations.monthly_pageview_limit to mean no cap. */
export const UNLIMITED = -1;

export function planMonthlyPageviews(plan: string | null | undefined): number | null {
    return isPaidPlan(plan) ? PAID_MONTHLY_PAGEVIEWS : FREE_MONTHLY_PAGEVIEWS;
}
