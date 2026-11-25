import type { PayPalConfig } from './config';

/** What we read from a PayPal subscription. */
export interface PayPalSubscription {
    id: string;
    status: string;
    plan_id: string | null;
    custom_id: string | null;
    next_billing_time: string | null;
    last_payment_time: string | null;
}

export class PayPalError extends Error {
    constructor(message: string, readonly status: number) { super(message); }
}

const tokenCache = new Map<string, { token: string; expires: number }>();

/** Test helper. */
export function clearPayPalTokenCache(): void { tokenCache.clear(); }

async function accessToken(cfg: PayPalConfig): Promise<string> {
    const key = `${cfg.apiBase}|${cfg.clientId}`;
    const hit = tokenCache.get(key);
    if (hit && hit.expires > Date.now()) return hit.token;
    const res = await fetch(`${cfg.apiBase}/v1/oauth2/token`, {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
    if (!res.ok || !data.access_token) throw new PayPalError('PayPal sign-in failed', res.status);
    tokenCache.set(key, { token: data.access_token, expires: Date.now() + Math.max(60, (data.expires_in ?? 300) - 120) * 1000 });
    return data.access_token;
}

async function call(cfg: PayPalConfig, method: 'GET' | 'POST', path: string, body?: string, extra: Record<string, string> = {}): Promise<unknown> {
    const token = await accessToken(cfg);
    const res = await fetch(`${cfg.apiBase}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json', ...extra },
        body,
        signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new PayPalError(`PayPal ${method} ${path.split('?')[0]} answered ${res.status}`, res.status);
    return data;
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

export function readSubscription(raw: unknown): PayPalSubscription {
    const r = (raw ?? {}) as Record<string, unknown>;
    const info = (r.billing_info ?? {}) as Record<string, unknown>;
    const last = (info.last_payment ?? {}) as Record<string, unknown>;
    const id = str(r.id);
    if (!id) throw new PayPalError('PayPal subscription has no id', 502);
    return {
        id,
        status: (str(r.status) ?? 'UNKNOWN').toUpperCase(),
        plan_id: str(r.plan_id),
        custom_id: str(r.custom_id),
        next_billing_time: str(info.next_billing_time),
        last_payment_time: str(last.time),
    };
}

/** Subscription ids PayPal issues look like I-ABC123. */
export const PAYPAL_SUBSCRIPTION_ID = /^I-[A-Z0-9]{6,40}$/;

export async function getSubscription(cfg: PayPalConfig, id: string): Promise<PayPalSubscription> {
    if (!PAYPAL_SUBSCRIPTION_ID.test(id)) throw new PayPalError('Not a PayPal subscription id', 400);
    return readSubscription(await call(cfg, 'GET', `/v1/billing/subscriptions/${encodeURIComponent(id)}`));
}

/** Creates a subscription waiting for the buyer's approval. custom_id carries our organization id. */
export async function createSubscription(cfg: PayPalConfig, o: { planId: string; orgId: string; returnUrl: string; cancelUrl: string; requestId: string }): Promise<PayPalSubscription> {
    const body = JSON.stringify({
        plan_id: o.planId,
        custom_id: o.orgId,
        application_context: { brand_name: 'FREEABTEST', shipping_preference: 'NO_SHIPPING', user_action: 'SUBSCRIBE_NOW', return_url: o.returnUrl, cancel_url: o.cancelUrl },
    });
    return readSubscription(await call(cfg, 'POST', '/v1/billing/subscriptions', body, { 'PayPal-Request-Id': o.requestId }));
}

export const WEBHOOK_HEADERS = ['paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id', 'paypal-transmission-sig', 'paypal-transmission-time'] as const;

/**
 * Asks PayPal whether a webhook delivery is genuine. The event is sent back exactly as received (the raw body),
 * because re-encoding parsed JSON can change it and fail the check.
 */
export async function verifyWebhookSignature(cfg: PayPalConfig, rawBody: string, headers: Headers): Promise<boolean> {
    const h: Record<string, string> = {};
    for (const k of WEBHOOK_HEADERS) {
        const v = headers.get(k);
        if (!v) return false;
        h[k] = v;
    }
    try {
        const parsed = JSON.parse(rawBody);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
    } catch {
        return false;
    }
    const body = `{"auth_algo":${JSON.stringify(h['paypal-auth-algo'])},"cert_url":${JSON.stringify(h['paypal-cert-url'])},"transmission_id":${JSON.stringify(h['paypal-transmission-id'])},"transmission_sig":${JSON.stringify(h['paypal-transmission-sig'])},"transmission_time":${JSON.stringify(h['paypal-transmission-time'])},"webhook_id":${JSON.stringify(cfg.webhookId)},"webhook_event":${rawBody}}`;
    try {
        const data = (await call(cfg, 'POST', '/v1/notifications/verify-webhook-signature', body)) as { verification_status?: string };
        return data.verification_status === 'SUCCESS';
    } catch {
        return false;
    }
}
