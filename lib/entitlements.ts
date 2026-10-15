import { db } from './db';
import { isPaidPlan } from './plans';
import { isPlatformAdminEmail } from './platformAdmin';
import { cached } from './configCache';

/**
 * Central entitlement checks. Every server route, the SDK bootstrap and the UI ask this module
 * whether an organization may use a feature. Heavy features (raw capture, heatmaps, recordings and
 * anything else that stores large volumes per visitor) need a paid plan. Platform admins, and
 * SUPER_ADMIN_EMAIL in particular, get every feature with no caps.
 */
export const SUPER_ADMIN_EMAIL = 'imrn.dev@gmail.com';

/** Features that are only for paid plans. Add new raw-capture or heavy features here. */
export const HEAVY_FEATURES = ['heatmaps', 'recordings', 'raw_capture'] as const;
export type HeavyFeature = (typeof HEAVY_FEATURES)[number];

export interface Entitlements {
    plan: string;
    paid: boolean;
    /** Platform admin member: every feature, no caps. */
    unlimited: boolean;
    features: Record<HeavyFeature, boolean>;
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    return email.toLowerCase() === SUPER_ADMIN_EMAIL || isPlatformAdminEmail(email);
}

/** Pure rule: plan != free, or an admin member. */
export function computeEntitlements(org: { plan: string | null } | null, memberEmails: string[]): Entitlements {
    const plan = org?.plan || 'free';
    const unlimited = memberEmails.some(isSuperAdminEmail);
    const paid = isPaidPlan(plan);
    const heavy = paid || unlimited;
    const features = Object.fromEntries(HEAVY_FEATURES.map((f) => [f, heavy])) as Record<HeavyFeature, boolean>;
    return { plan, paid, unlimited, features };
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

export const UPGRADE_NOTE: Record<HeavyFeature, string> = {
    heatmaps: 'Heatmaps are part of the paid plans. Upgrade to Starter or above to turn them on.',
    recordings: 'Session recordings are part of the paid plans. Upgrade to Starter or above to turn them on.',
    raw_capture: 'This feature is part of the paid plans. Upgrade to Starter or above to turn it on.',
};
