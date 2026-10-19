import { createHmac, timingSafeEqual } from 'node:crypto';

/** Server only: signed QA preview links that show one variation without entering the test. */
export const PREVIEW_PARAM = 'fabt_preview';
export const PREVIEW_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function secret(): string {
    const s = process.env.NEXTAUTH_SECRET;
    if (s) return s;
    if (process.env.NODE_ENV === 'production') throw new Error('NEXTAUTH_SECRET is required for preview links');
    return 'dev-preview-secret';
}

// The 'preview:' prefix keeps these signatures apart from visual editor tokens signed with the same secret.
const sign = (payload: string) => createHmac('sha256', secret()).update('preview:' + payload).digest('base64url');

export function createPreviewToken(input: { experimentId: string; variationId: string }, now = Date.now()): string {
    const payload = Buffer.from(JSON.stringify({ e: input.experimentId, v: input.variationId, x: now + PREVIEW_TOKEN_TTL_MS })).toString('base64url');
    return `${payload}.${sign(payload)}`;
}

export function verifyPreviewToken(token: string | null | undefined, now = Date.now()): { experimentId: string; variationId: string; expiresAt: number } | null {
    if (!token || token.length > 1000) return null;
    const [payload, mac, extra] = token.split('.');
    if (!payload || !mac || extra !== undefined) return null;
    const want = Buffer.from(sign(payload));
    const got = Buffer.from(mac);
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
    try {
        const p = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (typeof p.x !== 'number' || p.x < now || typeof p.e !== 'string' || typeof p.v !== 'string') return null;
        return { experimentId: p.e, variationId: p.v, expiresAt: p.x };
    } catch {
        return null;
    }
}

/** Address that opens the control page as one variation. URL variations redirect from there, as for real visitors. */
export function previewUrl(pageUrl: string, token: string): string {
    const u = new URL(pageUrl);
    u.searchParams.set(PREVIEW_PARAM, token);
    return u.toString();
}
