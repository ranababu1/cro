import { db } from './db';
import { isPaidPlan, maxVariationUrlsForPlan, planMonthlyPageviews, UNLIMITED } from './plans';
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

/** Features that are only for paid plans. Add new raw-capture or heavy features here. */
export const HEAVY_FEATURES = ['heatmaps', 'recordings', 'raw_capture'] as const;
export type HeavyFeature = (typeof HEAVY_FEATURES)[number];

/** null means unlimited. */
export interface Limits {
    monthlyVisitors: number | null;
    monthlyPageviews: number | null;
    maxVariations: number | null;
    activeExperiments: number | null;
    projects: number | null;
    seats: number | null;
}

export interface Entitlements {
    plan: string;
    paid: boolean;
    unlimited: boolean;
    specialFriend: boolean;
    features: Record<HeavyFeature, boolean>;
    limits: Limits;
    flags: Record<string, boolean>;
}

export interface OrgForEntitlements {
    plan: string | null;
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
    const pv = org?.monthly_pageview_limit;
    return {
        monthlyVisitors: org?.monthly_visitor_limit ?? null,
        monthlyPageviews: pv === UNLIMITED ? null : pv ?? planMonthlyPageviews(plan),
        maxVariations: maxVariationUrlsForPlan(plan),
        activeExperiments: null,
        projects: null,
        seats: null,
    };
}

function applyAllowances(limits: Limits, a: Allowances): Limits {
    const pick = <T,>(v: T | undefined, base: T) => (v === undefined ? base : v);
    return {
        monthlyVisitors: pick(a.monthly_visitors, limits.monthlyVisitors),
        monthlyPageviews: pick(a.monthly_pageviews, limits.monthlyPageviews),
        maxVariations: pick(a.max_variations, limits.maxVariations),
        activeExperiments: pick(a.active_experiments, limits.activeExperiments),
        projects: pick(a.projects, limits.projects),
        seats: pick(a.seats, limits.seats),
    };
}

/** Pure rule used everywhere. */
export function computeEntitlements(org: OrgForEntitlements | null, memberEmails: string[]): Entitlements {
    const plan = org?.plan || 'free';
    const paid = isPaidPlan(plan);
    const unlimited = memberEmails.some(isSuperAdminEmail);
    const specialFriend = !!org?.special_friend;
    if (unlimited) {
        return {
            plan, paid, unlimited, specialFriend,
            features: Object.fromEntries(HEAVY_FEATURES.map((f) => [f, true])) as Record<HeavyFeature, boolean>,
            limits: { monthlyVisitors: null, monthlyPageviews: null, maxVariations: null, activeExperiments: null, projects: null, seats: null },
            flags: {},
        };
    }
    const features = Object.fromEntries(HEAVY_FEATURES.map((f) => [f, paid])) as Record<HeavyFeature, boolean>;
    let limits = planLimits(org);
    let flags: Record<string, boolean> = {};
    if (specialFriend) {
        const a = parseAllowances(org?.custom_allowances);
        if (a.heatmaps !== undefined) features.heatmaps = a.heatmaps;
        if (a.recordings !== undefined) features.recordings = a.recordings;
        // Raw capture backs heatmaps and recordings, so it follows them.
        if (a.heatmaps !== undefined || a.recordings !== undefined) features.raw_capture = features.heatmaps || features.recordings;
        limits = applyAllowances(limits, a);
        flags = a.flags ?? {};
    }
    return { plan, paid, unlimited, specialFriend, features, limits, flags };
}

/** Entitlements for an org, cached briefly (cleared on any org write through lib/db). */
export async function getOrgEntitlements(orgId: string): Promise<Entitlements> {
    return cached(`ent:${orgId}`, async () => {
        const org = await db.getOrganization(orgId);
        const members = org ? await db.getOrgMembers(orgId) : [];
        return computeEntitlements(org, members.map((m) => m.email));
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
};
