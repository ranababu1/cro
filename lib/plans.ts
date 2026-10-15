/**
 * Plan limits that the product enforces. Free allows one variation URL beside the control;
 * any non-free plan (team, enterprise, paid) allows up to ten.
 */
export const FREE_MAX_VARIATIONS = 1;
export const PAID_MAX_VARIATIONS = 10;

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
    return `The free plan allows ${FREE_MAX_VARIATIONS} variation. Upgrade to add up to ${PAID_MAX_VARIATIONS}.`;
}

/** Tracked pageviews per month included in each plan. A pageview is a page load on a page that is part of a running test. */
export const FREE_MONTHLY_PAGEVIEWS = 25_000;
export const PAID_MONTHLY_PAGEVIEWS = 500_000;
/** Stored in organizations.monthly_pageview_limit to mean no cap. */
export const UNLIMITED = -1;

export function planMonthlyPageviews(plan: string | null | undefined): number {
    return isPaidPlan(plan) ? PAID_MONTHLY_PAGEVIEWS : FREE_MONTHLY_PAGEVIEWS;
}
