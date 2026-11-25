import { db } from '../db';
import { clearConfigCache } from '../configCache';
import { getOrgEntitlements } from '../entitlements';
import { paypalConfig, planForPayPalPlanId, paypalManageUrl, type PayPalConfig } from './config';
import { getSubscription, type PayPalSubscription } from './paypal';
import { paypalState, type ProviderSubscription } from './provider';

const iso = (v: string | null | undefined): string | null => {
    if (!v) return null;
    const t = Date.parse(v);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

/** PayPal subscription in the provider-neutral shape. */
export function fromPayPal(cfg: PayPalConfig, s: PayPalSubscription): ProviderSubscription {
    const mapped = planForPayPalPlanId(cfg, s.plan_id);
    return {
        provider: 'paypal', id: s.id, state: paypalState(s.status), providerStatus: s.status, providerPlanId: s.plan_id,
        plan: mapped?.plan ?? null, period: mapped?.period ?? null, orgId: s.custom_id,
        nextBillingAt: iso(s.next_billing_time), lastPaymentAt: iso(s.last_payment_time),
    };
}

function addPeriod(fromIso: string, period: 'monthly' | 'yearly'): string {
    const d = new Date(fromIso);
    if (period === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + 1);
    else d.setUTCMonth(d.getUTCMonth() + 1);
    return d.toISOString();
}

export type ApplyResult = 'granted' | 'recorded' | 'ends_at_period_end' | 'ended' | 'unchanged' | 'unknown_org' | 'unknown_plan';

/**
 * Applies what the provider reports about a subscription. Only an active subscription for one of our plan ids grants
 * a plan. Cancelled and suspended subscriptions keep the plan until the period already paid for ends (no mid-cycle
 * refunds, access continues). Expired ends it now. An admin-assigned plan, special-friend allowances and platform
 * admin ownership are separate and still win (lib/entitlements.ts).
 */
export async function applySubscription(sub: ProviderSubscription, actorId: string | null = null): Promise<ApplyResult> {
    if (!sub.orgId) return 'unknown_org';
    const org = await db.getOrganization(sub.orgId);
    if (!org) return 'unknown_org';
    const before = await db.getBillingSubscription(sub.provider, sub.id);
    if (before && before.org_id !== org.id) return 'unknown_org';

    let paidThrough: string | null | undefined;
    if (sub.state === 'active' && sub.plan && sub.period) {
        paidThrough = sub.nextBillingAt ?? (sub.lastPaymentAt ? addPeriod(sub.lastPaymentAt, sub.period) : before?.paid_through ?? null);
    }
    const row = await db.upsertBillingSubscription({
        orgId: org.id, provider: sub.provider, providerSubscriptionId: sub.id, providerPlanId: sub.providerPlanId,
        plan: sub.plan, period: sub.period, status: sub.providerStatus, paidThrough,
        nextBillingAt: sub.nextBillingAt, lastPaymentAt: sub.lastPaymentAt ?? before?.last_payment_at ?? null, createdBy: actorId,
    });
    if (!sub.plan) return 'unknown_plan';

    if (sub.state === 'active') {
        if (org.plan === sub.plan && !org.plan_ends_at) return 'unchanged';
        await db.updateOrganization(org.id, { plan: sub.plan, plan_ends_at: null });
        await db.audit({ orgId: org.id, actorId, entity: 'billing', entityId: row.id, action: 'billing:activate', diff: { plan: sub.plan, period: sub.period, was: org.plan } });
        clearConfigCache();
        return 'granted';
    }
    if (sub.state === 'pending') return 'recorded';

    // Not active any more. Leave the org alone if another subscription is active, or if its plan did not come from this one.
    const others = (await db.listBillingSubscriptions(org.id)).filter((r) => r.id !== row.id && r.status === 'ACTIVE');
    if (others.length > 0 || org.plan !== sub.plan) return 'unchanged';
    const now = new Date().toISOString();
    const end = sub.state === 'expired' ? now : row.paid_through && row.paid_through > now ? row.paid_through : now;
    if (end <= now) {
        await db.updateOrganization(org.id, { plan: 'free', plan_ends_at: null });
        await db.audit({ orgId: org.id, actorId, entity: 'billing', entityId: row.id, action: 'billing:end', diff: { plan: 'free', was: org.plan, status: sub.providerStatus } });
        clearConfigCache();
        return 'ended';
    }
    const ends = org.plan_ends_at && org.plan_ends_at < end ? org.plan_ends_at : end;
    if (org.plan_ends_at === ends) return 'unchanged';
    await db.updateOrganization(org.id, { plan_ends_at: ends });
    await db.audit({ orgId: org.id, actorId, entity: 'billing', entityId: row.id, action: 'billing:cancel', diff: { plan: org.plan, ends_at: ends, status: sub.providerStatus } });
    clearConfigCache();
    return 'ends_at_period_end';
}

/** Reads the subscription from PayPal (never from the browser or the webhook body) and applies it. */
export async function syncPayPalSubscription(cfg: PayPalConfig, subscriptionId: string, actorId: string | null = null) {
    const sub = fromPayPal(cfg, await getSubscription(cfg, subscriptionId));
    return { sub, result: await applySubscription(sub, actorId) };
}

/** Event types that trigger a fresh read of the subscription. Others are acknowledged and ignored. */
export const PAYPAL_EVENTS = [
    'BILLING.SUBSCRIPTION.ACTIVATED', 'BILLING.SUBSCRIPTION.RE-ACTIVATED', 'BILLING.SUBSCRIPTION.UPDATED',
    'BILLING.SUBSCRIPTION.CANCELLED', 'BILLING.SUBSCRIPTION.SUSPENDED', 'BILLING.SUBSCRIPTION.EXPIRED',
    'BILLING.SUBSCRIPTION.PAYMENT.FAILED', 'PAYMENT.SALE.COMPLETED',
] as const;

/** The subscription id an event is about: the resource id for subscription events, billing_agreement_id for sales. */
export function subscriptionIdOfEvent(event: { event_type?: unknown; resource?: unknown }): string | null {
    const r = (event.resource ?? {}) as Record<string, unknown>;
    const id = event.event_type === 'PAYMENT.SALE.COMPLETED' ? r.billing_agreement_id : r.id;
    return typeof id === 'string' && id ? id : null;
}

/** Billing summary for the Billing page. */
export async function billingStatus(orgId: string) {
    const cfg = paypalConfig();
    const ent = await getOrgEntitlements(orgId);
    const org = await db.getOrganization(orgId);
    const rows = await db.listBillingSubscriptions(orgId);
    const current = rows.find((r) => r.status === 'ACTIVE') ?? rows.find((r) => r.status !== 'APPROVAL_PENDING' && r.status !== 'APPROVED') ?? null;
    return {
        enabled: !!cfg,
        mode: cfg?.mode ?? null,
        plan: ent.plan,
        plan_source: ent.planSource,
        billing_plan: ent.billingPlan,
        plan_ends_at: org?.plan_ends_at ?? null,
        subscription: current && {
            provider: current.provider, status: current.status, plan: current.plan, period: current.period,
            next_billing_at: current.status === 'ACTIVE' ? current.next_billing_at : null, paid_through: current.paid_through, last_payment_at: current.last_payment_at,
        },
        manage_url: cfg && current ? paypalManageUrl(cfg.mode) : null,
    };
}
