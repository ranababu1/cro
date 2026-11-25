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
/** Paid plans, as on the pricing page. Enterprise tested visitors are set per contract (null). */
export const STARTER_MONTHLY_VISITORS = 250_000;
export const GROWTH_MONTHLY_VISITORS = 1_000_000;
/** Free tier: concurrently running experiments, new tests created per calendar month (UTC), projects. */
export const FREE_RUNNING_EXPERIMENTS = 1;
export const STARTER_RUNNING_EXPERIMENTS = 20;
export const FREE_MONTHLY_TESTS = 1;
export const FREE_PROJECTS = 1;
/** Free tier: goals per test. The one goal is a click on a CSS selector (other goal types need a paid plan). */
export const FREE_MAX_GOALS = 1;
/** Paid plans, as on the pricing page (Starter, Growth and Enterprise). */
export const PAID_MAX_GOALS = 50;
/** Free tier: registered domains per account (localhost for development does not count). */
export const FREE_DOMAINS = 1;

/** Projects and team seats per plan, as on the pricing page. Enterprise is set per contract (special friend allowances); null is no cap. */
export const PLAN_PROJECTS = [FREE_PROJECTS, 3, 10, null] as const;
export const PLAN_SEATS = [1, 5, 15, null] as const;
/** Tested visitors a month: Free, Starter, Growth, Enterprise (custom). */
export const PLAN_MONTHLY_VISITORS = [FREE_MONTHLY_VISITORS, STARTER_MONTHLY_VISITORS, GROWTH_MONTHLY_VISITORS, null] as const;
/** Running experiments at a time: Free, Starter, Growth (unlimited), Enterprise (unlimited). */
export const PLAN_RUNNING_EXPERIMENTS = [FREE_RUNNING_EXPERIMENTS, STARTER_RUNNING_EXPERIMENTS, null, null] as const;

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

export function planMonthlyVisitors(plan: string | null | undefined): number | null {
    return PLAN_MONTHLY_VISITORS[planTier(plan)];
}

export function planActiveExperiments(plan: string | null | undefined): number | null {
    return PLAN_RUNNING_EXPERIMENTS[planTier(plan)];
}

export function planMaxGoals(plan: string | null | undefined): number | null {
    return isPaidPlan(plan) ? PAID_MAX_GOALS : FREE_MAX_GOALS;
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
 * Published plans have no pageview cap: usage is limited by tested visitors instead.
 * An admin or special-friend allowance can still set organizations.monthly_pageview_limit.
 */
export const FREE_MONTHLY_PAGEVIEWS: number | null = null;
/** Stored in organizations.monthly_pageview_limit (and monthly_visitor_limit) to mean no cap. */
export const UNLIMITED = -1;

/** No published plan has a default pageview cap. */
export function planMonthlyPageviews(plan?: string | null): number | null {
    void plan;
    return null;
}
