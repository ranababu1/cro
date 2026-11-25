import type { BillingPeriod, PaidPlan } from './config';

/**
 * Provider layer. Each payment provider (PayPal now, Razorpay INR later) turns its own subscription into this shape,
 * and lib/billing/service.ts applies it. Nothing outside lib/billing talks to a provider directly.
 */
export type ProviderId = 'paypal' | 'razorpay';

/** pending: waiting for the buyer. active: paid and renewing. suspended: payments failing or paused. cancelled: will not renew. expired: over. */
export type SubscriptionState = 'pending' | 'active' | 'suspended' | 'cancelled' | 'expired';

export interface ProviderSubscription {
    provider: ProviderId;
    id: string;
    state: SubscriptionState;
    /** The provider's own status word, stored for support. */
    providerStatus: string;
    providerPlanId: string | null;
    /** Our plan for the provider plan id, or null when the id is not one of ours. */
    plan: PaidPlan | null;
    period: BillingPeriod | null;
    /** Organization id we attached when the subscription was created. */
    orgId: string | null;
    nextBillingAt: string | null;
    lastPaymentAt: string | null;
}

/** PayPal statuses: APPROVAL_PENDING, APPROVED, ACTIVE, SUSPENDED, CANCELLED, EXPIRED. Anything unknown grants nothing. */
export function paypalState(status: string): SubscriptionState {
    switch (status.toUpperCase()) {
        case 'ACTIVE': return 'active';
        case 'SUSPENDED': return 'suspended';
        case 'CANCELLED': return 'cancelled';
        case 'EXPIRED': return 'expired';
        default: return 'pending';
    }
}

export function planRank(plan: string | null | undefined): number {
    if (plan === 'starter') return 1;
    if (plan === 'growth') return 2;
    return 0;
}

/**
 * Upgrades take effect right away (higher tier, or monthly to yearly on the same tier).
 * Downgrades take effect at the end of the current paid period (lower tier, or yearly to monthly).
 */
export function classifyPlanChange(
    from: { plan: PaidPlan; period: BillingPeriod },
    to: { plan: PaidPlan; period: BillingPeriod },
): 'same' | 'upgrade' | 'downgrade' {
    if (from.plan === to.plan && from.period === to.period) return 'same';
    const rFrom = planRank(from.plan);
    const rTo = planRank(to.plan);
    if (rTo > rFrom) return 'upgrade';
    if (rTo < rFrom) return 'downgrade';
    return from.period === 'monthly' && to.period === 'yearly' ? 'upgrade' : 'downgrade';
}
