/**
 * Billing configuration from environment variables. Billing stays off (no checkout, no Billing page, pricing
 * buttons go to sign-in as before) until every PayPal variable below is set.
 *
 * Keep these names out of public pages and docs.
 */
export type PaidPlan = 'starter' | 'growth';
export type BillingPeriod = 'monthly' | 'yearly';
export const PAID_PLANS: readonly PaidPlan[] = ['starter', 'growth'];
export const BILLING_PERIODS: readonly BillingPeriod[] = ['monthly', 'yearly'];

/** USD prices, as on the pricing page. */
export const PLAN_PRICES_USD: Record<PaidPlan, Record<BillingPeriod, number>> = {
    starter: { monthly: 10, yearly: 100 },
    growth: { monthly: 50, yearly: 500 },
};

export const PAYPAL_PLAN_ENV: Record<PaidPlan, Record<BillingPeriod, string>> = {
    starter: { monthly: 'PAYPAL_PLAN_STARTER_MONTHLY', yearly: 'PAYPAL_PLAN_STARTER_YEARLY' },
    growth: { monthly: 'PAYPAL_PLAN_GROWTH_MONTHLY', yearly: 'PAYPAL_PLAN_GROWTH_YEARLY' },
};

export const PAYPAL_ENV = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'NEXT_PUBLIC_PAYPAL_CLIENT_ID', 'PAYPAL_WEBHOOK_ID', 'PAYPAL_API_BASE'] as const;

/** Only PayPal's own API hosts are accepted, so a typo cannot send credentials elsewhere. */
export const PAYPAL_API_BASES = { sandbox: 'https://api-m.sandbox.paypal.com', live: 'https://api-m.paypal.com' } as const;

export interface PayPalConfig {
    mode: 'sandbox' | 'live';
    apiBase: string;
    clientId: string;
    clientSecret: string;
    publicClientId: string;
    webhookId: string;
    plans: Record<PaidPlan, Record<BillingPeriod, string>>;
}

type Env = Record<string, string | undefined>;

const val = (env: Env, k: string) => (env[k] ?? '').trim();

/** The PayPal settings, or null when any is missing or the API base is not a PayPal host. */
export function paypalConfig(env: Env = process.env): PayPalConfig | null {
    for (const k of PAYPAL_ENV) if (!val(env, k)) return null;
    const base = val(env, 'PAYPAL_API_BASE').replace(/\/+$/, '');
    const mode = base === PAYPAL_API_BASES.live ? 'live' : base === PAYPAL_API_BASES.sandbox ? 'sandbox' : null;
    if (!mode) return null;
    const plans = {} as Record<PaidPlan, Record<BillingPeriod, string>>;
    for (const p of PAID_PLANS) {
        plans[p] = {} as Record<BillingPeriod, string>;
        for (const per of BILLING_PERIODS) {
            const id = val(env, PAYPAL_PLAN_ENV[p][per]);
            if (!id) return null;
            plans[p][per] = id;
        }
    }
    return {
        mode, apiBase: base, clientId: val(env, 'PAYPAL_CLIENT_ID'), clientSecret: val(env, 'PAYPAL_CLIENT_SECRET'),
        publicClientId: val(env, 'NEXT_PUBLIC_PAYPAL_CLIENT_ID'), webhookId: val(env, 'PAYPAL_WEBHOOK_ID'), plans,
    };
}

/** True when paid checkout can be offered. */
export function billingEnabled(env: Env = process.env): boolean {
    return paypalConfig(env) !== null;
}

/** Which of our plans a PayPal plan id sells, or null for an id we do not know. */
export function planForPayPalPlanId(cfg: PayPalConfig, planId: string | null | undefined): { plan: PaidPlan; period: BillingPeriod } | null {
    if (!planId) return null;
    for (const p of PAID_PLANS) for (const per of BILLING_PERIODS) if (cfg.plans[p][per] === planId) return { plan: p, period: per };
    return null;
}

/** Where a subscriber stops automatic payments while in-app cancellation is not built. */
export function paypalManageUrl(mode: 'sandbox' | 'live'): string {
    return mode === 'live' ? 'https://www.paypal.com/myaccount/autopay/' : 'https://www.sandbox.paypal.com/myaccount/autopay/';
}
