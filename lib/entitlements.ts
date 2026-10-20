import { db } from './db';
import {
    isPaidPlan, planTier, maxVariationUrlsForPlan, planMonthlyPageviews, UNLIMITED,
    FREE_MONTHLY_VISITORS, FREE_DAILY_VISITORS, FREE_RUNNING_EXPERIMENTS, FREE_MONTHLY_TESTS, FREE_MAX_GOALS, FREE_DOMAINS, PLAN_PROJECTS, PLAN_SEATS,
} from './plans';
import { isPlatformAdminEmail } from './platformAdmin';
import { cached } from './configCache';
import { parseAllowances, type Allowances } from './allowances';

/**
 * Central entitlement checks. Every server route, the SDK bootstrap and the UI ask this module
 * what an organization may use. Order of precedence:
 *   1. Platform admins (imrn.dev@gmail.com always): every feature, no caps.
 *   2. Special friend orgs: each custom allowance that is set overrides the plan.
 *   3. The plan: heavy features (raw capture, heatmaps, recordings) need plan != free.
 */
export const SUPER_ADMIN_EMAIL = 'imrn.dev@gmail.com';

/**
 * Features that are only for paid plans. Add new raw-capture, heavy or paid-only features here.
 * Most come with any paid plan; GROWTH_FEATURES need Growth or above.
 */
export const HEAVY_FEATURES = ['heatmaps', 'recordings', 'raw_capture', 'wordpress_plugin', 'funnels', 'revenue_goals', 'auto_shift', 'traffic', 'visual_editor', 'error_tracking', 'popups', 'surveys', 'audit_log', 'segments', 'webhooks', 'advanced_goals'] as const;
export const GROWTH_FEATURES: readonly string[] = ['auto_shift', 'visual_editor'];
export type HeavyFeature = (typeof HEAVY_FEATURES)[number];

/** null means unlimited. */
export interface Limits {
    monthlyVisitors: number | null;
    dailyVisitors: number | null;
    /** New tests created per calendar month (UTC), per account and per domain on Free. Deleting does not give any back. */
    monthlyTests: number | null;
    /** Goals per test. */
    maxGoals: number | null;
    monthlyPageviews: number | null;
    maxVariations: number | null;
    activeExperiments: number | null;
    projects: number | null;
    seats: number | null;
    /** Registered domains across the org (localhost not counted). */
    domains: number | null;
}

/** Plans an admin can assign. */
export const ASSIGNABLE_PLANS = ['free', 'starter', 'growth', 'enterprise'] as const;
export type AssignablePlan = (typeof ASSIGNABLE_PLANS)[number];

/** Where the effective plan comes from: a platform admin owns the org, an admin assigned it, or the billing plan. */
export type PlanSource = 'platform_admin' | 'assigned' | 'billing';

export interface Entitlements {
    /** Effective plan, shown everywhere: Enterprise for orgs a platform admin owns, else the assigned plan, else billing. */
    plan: string;
    /** Admin only: why the plan is what it is, and the billing plan underneath. */
    planSource: PlanSource;
    billingPlan: string;
    paid: boolean;
    unlimited: boolean;
    specialFriend: boolean;
    features: Record<HeavyFeature, boolean>;
    limits: Limits;
    flags: Record<string, boolean>;
    /** Free-tier anti-abuse rules (domain ledger) apply. False for paid, special friends and admins. */
    freeTierRules: boolean;
}

export interface OrgForEntitlements {
    plan: string | null;
    plan_override?: string | null;
    monthly_visitor_limit?: number | null;
    monthly_pageview_limit?: number | null;
    special_friend?: boolean | null;
    custom_allowances?: string | null;
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    return email.toLowerCase() === SUPER_ADMIN_EMAIL || isPlatformAdminEmail(email);
}

function planLimits(org: OrgForEntitlements | null): Limits {
    const plan = org?.plan || 'free';
    const free = !isPaidPlan(plan);
    const pv = org?.monthly_pageview_limit;
    return {
        monthlyVisitors: org?.monthly_visitor_limit ?? (free ? FREE_MONTHLY_VISITORS : null),
        dailyVisitors: free ? FREE_DAILY_VISITORS : null,
        monthlyTests: free ? FREE_MONTHLY_TESTS : null,
        maxGoals: free ? FREE_MAX_GOALS : null,
        monthlyPageviews: pv === UNLIMITED ? null : pv ?? planMonthlyPageviews(plan),
        maxVariations: maxVariationUrlsForPlan(plan),
        activeExperiments: free ? FREE_RUNNING_EXPERIMENTS : null,
        projects: PLAN_PROJECTS[planTier(plan)],
        seats: PLAN_SEATS[planTier(plan)],
        domains: free ? FREE_DOMAINS : null,
    };
}

function applyAllowances(limits: Limits, a: Allowances): Limits {
    const pick = <T,>(v: T | undefined, base: T) => (v === undefined ? base : v);
    return {
        monthlyVisitors: pick(a.monthly_visitors, limits.monthlyVisitors),
        dailyVisitors: pick(a.daily_visitors, limits.dailyVisitors),
        monthlyTests: pick(a.monthly_tests, limits.monthlyTests),
        maxGoals: pick(a.max_goals, limits.maxGoals),
        monthlyPageviews: pick(a.monthly_pageviews, limits.monthlyPageviews),
        maxVariations: pick(a.max_variations, limits.maxVariations),
        activeExperiments: pick(a.active_experiments, limits.activeExperiments),
        projects: pick(a.projects, limits.projects),
        seats: pick(a.seats, limits.seats),
        domains: pick(a.domains, limits.domains),
    };
}

/** Pure rule used everywhere. */
export function computeEntitlements(org: OrgForEntitlements | null, memberEmails: string[]): Entitlements {
    const billingPlan = org?.plan || 'free';
    const unlimited = memberEmails.some(isSuperAdminEmail);
    const assigned = org?.plan_override && (ASSIGNABLE_PLANS as readonly string[]).includes(org.plan_override) ? org.plan_override : null;
    const planSource: PlanSource = unlimited ? 'platform_admin' : assigned ? 'assigned' : 'billing';
    const plan = unlimited ? 'enterprise' : assigned ?? billingPlan;
    const paid = isPaidPlan(plan);
    const specialFriend = !!org?.special_friend;
    if (org) org = { ...org, plan };
    if (unlimited) {
        return {
            plan, planSource, billingPlan, paid, unlimited, specialFriend,
            features: Object.fromEntries(HEAVY_FEATURES.map((f) => [f, true])) as Record<HeavyFeature, boolean>,
            limits: { monthlyVisitors: null, dailyVisitors: null, monthlyTests: null, maxGoals: null, monthlyPageviews: null, maxVariations: null, activeExperiments: null, projects: null, seats: null, domains: null },
            flags: {},
            freeTierRules: false,
        };
    }
    const tier = planTier(plan);
    const features = Object.fromEntries(HEAVY_FEATURES.map((f) => [f, GROWTH_FEATURES.includes(f) ? tier >= 2 : paid])) as Record<HeavyFeature, boolean>;
    let limits = planLimits(org);
    let flags: Record<string, boolean> = {};
    if (specialFriend) {
        const a = parseAllowances(org?.custom_allowances);
        if (a.heatmaps !== undefined) features.heatmaps = a.heatmaps;
        if (a.recordings !== undefined) features.recordings = a.recordings;
        if (a.wordpress_plugin !== undefined) features.wordpress_plugin = a.wordpress_plugin;
        if (a.funnels !== undefined) features.funnels = a.funnels;
        if (a.revenue_goals !== undefined) features.revenue_goals = a.revenue_goals;
        if (a.auto_shift !== undefined) features.auto_shift = a.auto_shift;
        if (a.traffic !== undefined) features.traffic = a.traffic;
        if (a.visual_editor !== undefined) features.visual_editor = a.visual_editor;
        if (a.error_tracking !== undefined) features.error_tracking = a.error_tracking;
        if (a.popups !== undefined) features.popups = a.popups;
        if (a.surveys !== undefined) features.surveys = a.surveys;
        if (a.audit_log !== undefined) features.audit_log = a.audit_log;
        if (a.segments !== undefined) features.segments = a.segments;
        if (a.webhooks !== undefined) features.webhooks = a.webhooks;
        if (a.advanced_goals !== undefined) features.advanced_goals = a.advanced_goals;
        // Raw capture backs heatmaps and recordings, so it follows them.
        if (a.heatmaps !== undefined || a.recordings !== undefined) features.raw_capture = features.heatmaps || features.recordings;
        limits = applyAllowances(limits, a);
        flags = a.flags ?? {};
    }
    return { plan, planSource, billingPlan, paid, unlimited, specialFriend, features, limits, flags, freeTierRules: !paid && !specialFriend };
}

/** Entitlements from an org and its members. Only owners lift the limits: inviting a platform admin as a member must not make an org unlimited. */
export function memberEntitlements(org: OrgForEntitlements | null, members: { role: string; email: string }[]): Entitlements {
    return computeEntitlements(org, members.filter((m) => m.role === 'owner').map((m) => m.email));
}

/** Entitlements for an org, cached briefly (cleared on any org write through lib/db). */
export async function getOrgEntitlements(orgId: string): Promise<Entitlements> {
    return cached(`ent:${orgId}`, async () => {
        const org = await db.getOrganization(orgId);
        const members = org ? await db.getOrgMembers(orgId) : [];
        return memberEntitlements(org, members);
    }, 30_000);
}

export async function canUseFeature(orgId: string, feature: HeavyFeature): Promise<boolean> {
    return (await getOrgEntitlements(orgId)).features[feature];
}

/** The parts a tenant may see: features and effective limits, never how they were set. */
export function publicEntitlements(e: Entitlements) {
    return { features: e.features, limits: e.limits };
}

export const UPGRADE_NOTE: Record<HeavyFeature, string> = {
    heatmaps: 'Heatmaps are part of the paid plans. Upgrade to Starter or above to turn them on.',
    recordings: 'Session recordings are part of the paid plans. Upgrade to Starter or above to turn them on.',
    raw_capture: 'This feature is part of the paid plans. Upgrade to Starter or above to turn it on.',
    funnels: 'Funnels are part of the paid plans. Upgrade to Starter or above to build them.',
    auto_shift: 'Auto-shift traffic to the winner is part of the Growth plan and above. Upgrade to Growth to turn it on.',
    traffic: 'The traffic overview is part of the paid plans. Upgrade to Starter or above to see page views, top pages, sources and devices.',
    surveys: 'Surveys are part of the paid plans. Upgrade to Starter or above to ask visitors a question on your site.',
    audit_log: 'The audit log is part of the paid plans. Upgrade to Starter or above to see who changed what in your organization.',
    popups: 'Popups are part of the paid plans. Upgrade to Starter or above to show popups and calls to action on your site.',
    error_tracking: 'JavaScript error tracking is part of the paid plans. Upgrade to Starter or above to see errors per version.',
    visual_editor: 'The visual editor is part of the Growth plan and above. Upgrade to Growth to change pages without code.',
    revenue_goals: 'Revenue goals are part of the paid plans. Upgrade to Starter or above to track order values.',
    webhooks: 'Webhooks are part of the paid plans. Upgrade to Starter or above to get a signed POST when a test finds a winner, finishes, shows a sample ratio warning or reaches a plan limit.',
    segments: 'Results by segment are part of the paid plans. Upgrade to Starter or above to compare variations by device, traffic source and new or returning visitors.',
    advanced_goals: 'The free plan has one goal per test: a click on a CSS selector. Upgrade to Starter or above for more goals, form, page visit and custom event goals, and conversions sent from your code.',
    wordpress_plugin: 'The WordPress plugin is available to paid users only. Upgrade to Starter or above to download and use it.',
};
