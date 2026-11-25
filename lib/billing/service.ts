import { db } from '../db';
import { clearConfigCache } from '../configCache';
import { getOrgEntitlements } from '../entitlements';
import { generateId } from '../ids';
import { publicAppOrigin } from '../publicOrigin';
import { paypalConfig, planForPayPalPlanId, paypalManageUrl, type BillingPeriod, type PaidPlan, type PayPalConfig } from './config';
import { cancelSubscription, createSubscription, getSubscription, PayPalError, reviseSubscription, type PayPalSubscription } from './paypal';
import { classifyPlanChange, paypalState, planRank, type ProviderSubscription } from './provider';

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

export type ApplyResult =
    | 'granted'
    | 'scheduled_downgrade'
    | 'recorded'
    | 'ends_at_period_end'
    | 'ended'
    | 'unchanged'
    | 'unknown_org'
    | 'unknown_plan';

/**
 * Applies what the provider reports about a subscription. Only an active subscription for one of our plan ids grants
 * a plan. Downgrades keep the higher plan until the current paid period ends. Cancelled and suspended subscriptions
 * keep the plan until the period already paid for ends (no mid-cycle refunds, access continues). Expired ends it now.
 * An admin-assigned plan, special-friend allowances and platform admin ownership are separate and still win (lib/entitlements.ts).
 */
export async function applySubscription(
    sub: ProviderSubscription,
    actorId: string | null = null,
    opts: { eventType?: string; cfg?: PayPalConfig } = {},
): Promise<ApplyResult> {
    if (!sub.orgId) return 'unknown_org';
    const org = await db.getOrganization(sub.orgId);
    if (!org) return 'unknown_org';
    const before = await db.getBillingSubscription(sub.provider, sub.id);
    if (before && before.org_id !== org.id) return 'unknown_org';

    const now = new Date().toISOString();
    const newPaymentArrived = !!sub.lastPaymentAt && (!before?.last_payment_at || sub.lastPaymentAt > before.last_payment_at);

    let paidThrough: string | null | undefined;
    if (sub.state === 'active' && sub.plan && sub.period) {
        const computed = sub.nextBillingAt ?? (sub.lastPaymentAt ? addPeriod(sub.lastPaymentAt, sub.period) : null);
        if (computed && before?.paid_through) {
            if (before.plan === sub.plan && before.period === sub.period) {
                paidThrough = computed > before.paid_through ? computed : before.paid_through;
            } else if (before.plan && before.period && classifyPlanChange({ plan: before.plan, period: before.period }, { plan: sub.plan, period: sub.period }) === 'downgrade' && !newPaymentArrived && before.paid_through > now) {
                paidThrough = before.paid_through;
            } else {
                paidThrough = computed;
            }
        } else {
            paidThrough = computed ?? before?.paid_through ?? null;
        }
    }

    let paymentFailedAt: string | null | undefined;
    if (opts.eventType === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED') {
        paymentFailedAt = now;
    } else if (sub.state === 'suspended') {
        paymentFailedAt = before?.payment_failed_at ?? now;
    } else if (opts.eventType === 'PAYMENT.SALE.COMPLETED' || (sub.state === 'active' && before?.status === 'SUSPENDED') || sub.state === 'cancelled' || sub.state === 'expired') {
        paymentFailedAt = null;
    }

    const row = await db.upsertBillingSubscription({
        orgId: org.id, provider: sub.provider, providerSubscriptionId: sub.id, providerPlanId: sub.providerPlanId,
        plan: sub.plan, period: sub.period, status: sub.providerStatus, paidThrough,
        nextBillingAt: sub.nextBillingAt, lastPaymentAt: sub.lastPaymentAt ?? before?.last_payment_at ?? null,
        paymentFailedAt, createdBy: actorId,
    });

    if (opts.eventType === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED') {
        await db.audit({ orgId: org.id, actorId, entity: 'billing', entityId: row.id, action: 'billing:payment_failed', diff: { subscription: sub.id, status: sub.providerStatus } });
    }

    if (!sub.plan) return 'unknown_plan';

    if (sub.state === 'active') {
        // If this new subscription replaced an older one after an upgrade fallback, cancel the old one now that the new one is active.
        if (before?.replaces_subscription_id && opts.cfg) {
            const oldRow = await db.getBillingSubscription(sub.provider, before.replaces_subscription_id);
            if (oldRow && oldRow.org_id === org.id && (oldRow.status === 'ACTIVE' || oldRow.status === 'SUSPENDED')) {
                try {
                    await cancelSubscription(opts.cfg, oldRow.provider_subscription_id, 'Upgraded to new subscription');
                    await db.upsertBillingSubscription({
                        orgId: org.id, provider: sub.provider, providerSubscriptionId: oldRow.provider_subscription_id,
                        providerPlanId: oldRow.provider_plan_id, plan: oldRow.plan, period: oldRow.period,
                        status: 'CANCELLED', paidThrough: oldRow.paid_through, nextBillingAt: null, lastPaymentAt: oldRow.last_payment_at,
                        paymentFailedAt: null,
                    });
                    await db.audit({ orgId: org.id, actorId, entity: 'billing', entityId: oldRow.id, action: 'billing:cancel_replaced', diff: { replaced_by: sub.id } });
                } catch (e) {
                    console.error('Failed to cancel previous subscription after upgrade:', e instanceof Error ? e.message : 'error');
                }
            }
            await db.upsertBillingSubscription({
                orgId: org.id, provider: sub.provider, providerSubscriptionId: sub.id, providerPlanId: sub.providerPlanId,
                plan: sub.plan, period: sub.period, status: sub.providerStatus, replacesSubscriptionId: null,
            });
        }

        const downgradeDue = org.scheduled_plan === sub.plan && !!org.scheduled_plan_at && org.scheduled_plan_at <= now;
        const isLowerPlan = planRank(sub.plan) < planRank(org.plan);
        const isYearlyToMonthlySamePlan = sub.plan === org.plan && before?.period === 'yearly' && sub.period === 'monthly';
        const paymentForRenewal = opts.eventType === 'PAYMENT.SALE.COMPLETED' && newPaymentArrived;

        if ((isLowerPlan || isYearlyToMonthlySamePlan) && !paymentForRenewal && !downgradeDue) {
            const effectiveAt = before?.paid_through && before.paid_through > now
                ? before.paid_through
                : sub.nextBillingAt && sub.nextBillingAt > now
                    ? sub.nextBillingAt
                    : null;
            if (effectiveAt) {
                const changed = org.scheduled_plan !== sub.plan || org.scheduled_period !== sub.period || org.scheduled_plan_at !== effectiveAt || !!org.plan_ends_at;
                if (!changed) return 'unchanged';
                await db.updateOrganization(org.id, { scheduled_plan: sub.plan, scheduled_period: sub.period, scheduled_plan_at: effectiveAt, plan_ends_at: null });
                await db.audit({ orgId: org.id, actorId, entity: 'billing', entityId: row.id, action: 'billing:downgrade', diff: { from: org.plan, to: sub.plan, period: sub.period, takes_effect_at: effectiveAt } });
                clearConfigCache();
                return 'scheduled_downgrade';
            }
        }

        if (org.plan === sub.plan && !org.plan_ends_at && !org.scheduled_plan && !org.scheduled_period && !org.scheduled_plan_at) {
            return 'unchanged';
        }
        const action = org.scheduled_plan === sub.plan
            ? 'billing:downgrade_applied'
            : planRank(sub.plan) > planRank(org.plan) && org.plan !== 'free'
                ? 'billing:upgrade'
                : 'billing:activate';
        await db.updateOrganization(org.id, { plan: sub.plan, plan_ends_at: null, scheduled_plan: null, scheduled_period: null, scheduled_plan_at: null });
        await db.audit({ orgId: org.id, actorId, entity: 'billing', entityId: row.id, action, diff: { plan: sub.plan, period: sub.period, was: org.plan } });
        clearConfigCache();
        return 'granted';
    }
    if (sub.state === 'pending') return 'recorded';

    // Not active any more. Leave the org alone if another subscription is active, or if its plan did not come from this one.
    const others = (await db.listBillingSubscriptions(org.id)).filter((r) => r.id !== row.id && r.status === 'ACTIVE');
    if (others.length > 0 || (org.plan !== sub.plan && org.scheduled_plan !== sub.plan)) return 'unchanged';
    const end = sub.state === 'expired' ? now : row.paid_through && row.paid_through > now ? row.paid_through : now;
    if (end <= now) {
        await db.updateOrganization(org.id, { plan: 'free', plan_ends_at: null, scheduled_plan: null, scheduled_period: null, scheduled_plan_at: null });
        await db.audit({ orgId: org.id, actorId, entity: 'billing', entityId: row.id, action: 'billing:end', diff: { plan: 'free', was: org.plan, status: sub.providerStatus } });
        clearConfigCache();
        return 'ended';
    }
    const ends = org.plan_ends_at && org.plan_ends_at < end ? org.plan_ends_at : end;
    if (org.plan_ends_at === ends) return 'unchanged';
    await db.updateOrganization(org.id, { plan_ends_at: ends, scheduled_plan: null, scheduled_period: null, scheduled_plan_at: null });
    await db.audit({ orgId: org.id, actorId, entity: 'billing', entityId: row.id, action: sub.state === 'suspended' ? 'billing:suspend' : 'billing:cancel', diff: { plan: org.plan, ends_at: ends, status: sub.providerStatus } });
    clearConfigCache();
    return 'ends_at_period_end';
}

/** Reads the subscription from PayPal (never from the browser or the webhook body) and applies it. */
export async function syncPayPalSubscription(
    cfg: PayPalConfig,
    subscriptionId: string,
    actorId: string | null = null,
    opts: { eventType?: string } = {},
) {
    const sub = fromPayPal(cfg, await getSubscription(cfg, subscriptionId));
    return { sub, result: await applySubscription(sub, actorId, { eventType: opts.eventType, cfg }) };
}

export type PlanChangeResult =
    | { action: 'approve'; approve_url: string; subscription_id: string }
    | { action: 'checkout_new'; id: string; approve_url: string | null }
    | { action: 'applied' | 'scheduled_cancel' | 'unchanged'; billing: Awaited<ReturnType<typeof billingStatus>> };

export class BillingActionError extends Error {
    constructor(message: string, readonly status: number) { super(message); }
}

/**
 * Changes an active PayPal subscription:
 * - Upgrades apply right away via PayPal revise where supported, else by starting a new subscription and cancelling the old one once active.
 * - Downgrades take effect at the end of the current paid period (via PayPal revise if supported, else cancelling the current subscription at period end and noting the target plan).
 */
export async function changeOrgPlan(
    cfg: PayPalConfig,
    orgId: string,
    userId: string,
    targetPlan: PaidPlan,
    targetPeriod: BillingPeriod,
): Promise<PlanChangeResult> {
    const rows = await db.listBillingSubscriptions(orgId);
    const active = rows.find((r) => r.status === 'ACTIVE');
    if (!active) {
        if (rows.some((r) => r.status === 'SUSPENDED')) {
            throw new BillingActionError('Update your payment method in PayPal or cancel the suspended subscription before changing plans.', 409);
        }
        throw new BillingActionError('No active subscription to change.', 409);
    }
    const curMapped = planForPayPalPlanId(cfg, active.provider_plan_id);
    const curPlan = active.plan ?? curMapped?.plan;
    const curPeriod = active.period ?? curMapped?.period;
    if (!curPlan || !curPeriod) throw new BillingActionError('Current subscription plan is unknown.', 409);

    const org = await db.getOrganization(orgId);
    const dir = classifyPlanChange({ plan: curPlan, period: curPeriod }, { plan: targetPlan, period: targetPeriod });
    if (dir === 'same') {
        if (org?.scheduled_plan) return { action: 'unchanged', billing: await billingStatus(orgId) };
        throw new BillingActionError('Your organization is already on this plan and billing period.', 400);
    }

    const targetPlanId = cfg.plans[targetPlan][targetPeriod];
    const origin = publicAppOrigin();

    try {
        const rev = await reviseSubscription(cfg, active.provider_subscription_id, {
            planId: targetPlanId,
            returnUrl: `${origin}/settings/billing?status=revised&subscription_id=${encodeURIComponent(active.provider_subscription_id)}`,
            cancelUrl: `${origin}/settings/billing?status=cancelled`,
        });
        if (rev.approve_url) {
            return { action: 'approve', approve_url: rev.approve_url, subscription_id: active.provider_subscription_id };
        }
        await syncPayPalSubscription(cfg, active.provider_subscription_id, userId);
        return { action: 'applied', billing: await billingStatus(orgId) };
    } catch (e) {
        if (!(e instanceof PayPalError) || e.status < 400 || e.status >= 500) throw e;
    }

    if (dir === 'upgrade') {
        const created = await createSubscription(cfg, {
            planId: targetPlanId,
            orgId,
            requestId: generateId('bsreq'),
            returnUrl: `${origin}/settings/billing?status=approved`,
            cancelUrl: `${origin}/settings/billing?status=cancelled`,
        });
        const sub = fromPayPal(cfg, created);
        await db.upsertBillingSubscription({
            orgId, provider: 'paypal', providerSubscriptionId: sub.id, providerPlanId: sub.providerPlanId,
            plan: targetPlan, period: targetPeriod, status: sub.providerStatus,
            replacesSubscriptionId: active.provider_subscription_id, createdBy: userId,
        });
        return { action: 'checkout_new', id: sub.id, approve_url: created.approve_url };
    }

    // Downgrade fallback: stop renewal at PayPal now; access stays until paid_through.
    await cancelSubscription(cfg, active.provider_subscription_id, `Downgrade to ${targetPlan} (${targetPeriod}) at period end`);
    await syncPayPalSubscription(cfg, active.provider_subscription_id, userId);
    const updatedOrg = await db.getOrganization(orgId);
    const now = new Date().toISOString();
    const effectiveAt = updatedOrg?.plan_ends_at ?? active.paid_through ?? active.next_billing_at ?? now;
    if (effectiveAt > now) {
        await db.updateOrganization(orgId, { scheduled_plan: targetPlan, scheduled_period: targetPeriod, scheduled_plan_at: effectiveAt });
        await db.audit({
            orgId, actorId: userId, entity: 'billing', entityId: active.id, action: 'billing:downgrade',
            diff: { from: updatedOrg?.plan ?? curPlan, to: targetPlan, period: targetPeriod, takes_effect_at: effectiveAt },
        });
        clearConfigCache();
    }
    return { action: 'scheduled_cancel', billing: await billingStatus(orgId) };
}

/** Cancels the active or suspended PayPal subscription at the end of the current paid period. */
export async function cancelOrgSubscription(cfg: PayPalConfig, orgId: string, userId: string) {
    const rows = await db.listBillingSubscriptions(orgId);
    const target = rows.find((r) => r.status === 'ACTIVE') ?? rows.find((r) => r.status === 'SUSPENDED');
    if (target) {
        await cancelSubscription(cfg, target.provider_subscription_id, 'Cancelled by customer in billing settings');
        await syncPayPalSubscription(cfg, target.provider_subscription_id, userId);
    } else {
        const org = await db.getOrganization(orgId);
        if (!org?.scheduled_plan) throw new BillingActionError('No active subscription to cancel.', 409);
    }
    const org = await db.getOrganization(orgId);
    if (org?.scheduled_plan || org?.scheduled_period || org?.scheduled_plan_at) {
        await db.updateOrganization(orgId, { scheduled_plan: null, scheduled_period: null, scheduled_plan_at: null });
        clearConfigCache();
    }
    return billingStatus(orgId);
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
    const current =
        rows.find((r) => r.status === 'ACTIVE') ??
        rows.find((r) => r.status === 'SUSPENDED') ??
        rows.find((r) => r.status !== 'APPROVAL_PENDING' && r.status !== 'APPROVED') ??
        null;
    return {
        enabled: !!cfg,
        mode: cfg?.mode ?? null,
        plan: ent.plan,
        plan_source: ent.planSource,
        billing_plan: ent.billingPlan,
        plan_ends_at: org?.plan_ends_at ?? null,
        scheduled_plan: org?.scheduled_plan ?? null,
        scheduled_period: org?.scheduled_period ?? null,
        scheduled_plan_at: org?.scheduled_plan_at ?? null,
        subscription: current && {
            provider: current.provider, status: current.status, plan: current.plan, period: current.period,
            next_billing_at: current.status === 'ACTIVE' ? current.next_billing_at : null, paid_through: current.paid_through,
            last_payment_at: current.last_payment_at, payment_failed_at: current.payment_failed_at ?? null,
        },
        manage_url: cfg && current ? paypalManageUrl(cfg.mode) : null,
    };
}

export interface OwnerBillingAlert {
    kind: 'suspended' | 'payment_failed';
    failedAt: string | null;
    endsAt: string | null;
    manageUrl: string;
}

/** In-app alert for organization owners when a subscription payment fails or is suspended. */
export async function getOwnerBillingAlert(orgId: string, userId: string): Promise<OwnerBillingAlert | null> {
    const cfg = paypalConfig();
    if (!cfg) return null;
    const m = await db.getMembership(orgId, userId);
    if (m?.role !== 'owner') return null;
    const rows = await db.listBillingSubscriptions(orgId);
    const suspended = rows.find((r) => r.status === 'SUSPENDED');
    if (suspended) {
        const org = await db.getOrganization(orgId);
        return {
            kind: 'suspended',
            failedAt: suspended.payment_failed_at ?? null,
            endsAt: org?.plan_ends_at ?? suspended.paid_through ?? null,
            manageUrl: paypalManageUrl(cfg.mode),
        };
    }
    const failed = rows.find((r) => r.status === 'ACTIVE' && !!r.payment_failed_at);
    if (failed) {
        return {
            kind: 'payment_failed',
            failedAt: failed.payment_failed_at ?? null,
            endsAt: null,
            manageUrl: paypalManageUrl(cfg.mode),
        };
    }
    return null;
}
