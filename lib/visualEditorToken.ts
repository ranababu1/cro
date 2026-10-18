import { createHmac, timingSafeEqual } from 'node:crypto';

/** Server only: signed, short-lived links that open the visual editor for one variation. */
export const EDITOR_PARAM = 'fabt_editor';
export const EDITOR_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

function secret(): string {
    const s = process.env.NEXTAUTH_SECRET;
    if (s) return s;
    if (process.env.NODE_ENV === 'production') throw new Error('NEXTAUTH_SECRET is required for the visual editor');
    return 'dev-visual-editor-secret';
}

const sign = (payload: string) => createHmac('sha256', secret()).update('visual:' + payload).digest('base64url');

/** Short-lived token that lets the editor on the customer's page read and save one variation's changes. */
export function createEditorToken(input: { experimentId: string; variationId: string; userId: string }, now = Date.now()): string {
    const payload = Buffer.from(JSON.stringify({ e: input.experimentId, v: input.variationId, u: input.userId, x: now + EDITOR_TOKEN_TTL_MS })).toString('base64url');
    return `${payload}.${sign(payload)}`;
}

export function verifyEditorToken(token: string | null | undefined, now = Date.now()): { experimentId: string; variationId: string; userId: string } | null {
    if (!token || token.length > 1000) return null;
    const [payload, mac] = token.split('.');
    if (!payload || !mac) return null;
    const want = Buffer.from(sign(payload));
    const got = Buffer.from(mac);
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
    try {
        const p = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (typeof p.x !== 'number' || p.x < now || typeof p.e !== 'string' || typeof p.v !== 'string' || typeof p.u !== 'string') return null;
        return { experimentId: p.e, variationId: p.v, userId: p.u };
    } catch {
        return null;
    }
}

/** Address that opens the page with the visual editor for one variation. */
export function editorUrl(pageUrl: string, token: string): string {
    const u = new URL(pageUrl);
    u.searchParams.set(EDITOR_PARAM, token);
    return u.toString();
}
