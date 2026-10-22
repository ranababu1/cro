import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Cloudflare Turnstile bot check in front of the Google sign-in step.
 * The widget token is checked once with Cloudflare's siteverify endpoint by POST /api/auth/turnstile,
 * which then sets a short-lived signed pass cookie. The OAuth start (POST /api/auth/signin/google) and
 * account creation (the NextAuth signIn callback) both require that pass.
 * With either key missing the check is skipped and a warning is logged, so the site keeps working.
 */
export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const PASS_COOKIE = 'fat_bot_pass';
export const PASS_TTL_SECONDS = 10 * 60;

let warned = false;

export function turnstileSiteKey(): string | null {
    return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
}

/** True when both keys are set and the check is enforced. */
export function turnstileEnabled(): boolean {
    const on = !!turnstileSiteKey() && !!process.env.TURNSTILE_SECRET_KEY?.trim();
    if (!on && !warned) {
        warned = true;
        console.warn('Turnstile bot check is off: set NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY to enable it.');
    }
    return on;
}

export function resetTurnstileWarning(): void {
    warned = false;
}

export interface VerifyResult {
    ok: boolean;
    codes: string[];
}

/** Checks a widget token with Cloudflare. Network errors and timeouts fail closed. */
export async function verifyTurnstileToken(token: string, ip: string | null, fetchImpl: typeof fetch = fetch): Promise<VerifyResult> {
    const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
    if (!secret) return { ok: false, codes: ['missing-input-secret'] };
    if (!token || token.length > 2048) return { ok: false, codes: ['invalid-input-response'] };
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== 'unknown') body.set('remoteip', ip);
    try {
        const res = await fetchImpl(SITEVERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(5000) });
        const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
        return { ok: data.success === true, codes: data['error-codes'] ?? [] };
    } catch {
        return { ok: false, codes: ['network-error'] };
    }
}

function passKey(): string {
    return `turnstile-pass:${process.env.NEXTAUTH_SECRET || 'dev-secret'}`;
}

function sign(payload: string): string {
    return createHmac('sha256', passKey()).update(payload).digest('base64url');
}

/** A signed pass value: expiry, nonce and an HMAC over both. */
export function issuePass(now = Date.now()): string {
    const payload = `${Math.floor(now / 1000) + PASS_TTL_SECONDS}.${randomBytes(9).toString('base64url')}`;
    return `${payload}.${sign(payload)}`;
}

export function isValidPass(value: string | null | undefined, now = Date.now()): boolean {
    if (!value) return false;
    const parts = value.split('.');
    if (parts.length !== 3) return false;
    const [exp, nonce, sig] = parts;
    const expected = Buffer.from(sign(`${exp}.${nonce}`));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
    return Number(exp) * 1000 > now;
}

/** True when the bot check is off or the request carries a valid pass. */
export function botCheckPassed(cookieValue: string | null | undefined): boolean {
    return !turnstileEnabled() || isValidPass(cookieValue);
}

export const BOT_CHECK_ERROR = 'BotCheck';
