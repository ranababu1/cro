import { db } from './db';
import { hashIp, utcDay } from './telemetry';
import { isPlatformAdminEmail } from './platformAdmin';

/**
 * Caps on new accounts per client IP and per IP range (/24 for IPv4, /48 for IPv6) per UTC day.
 * Counts live in signup_counts so every server shares them. IPs and ranges are stored only as salted
 * hashes (hashIp). Refused attempts go to abuse_events, shown in /admin/abuse. Admins change the caps there.
 */
export const DEFAULT_SIGNUP_CAPS = { perIp: 3, perRange: 10 } as const;
export const SIGNUP_CAPS_KEY = 'signup_limits';
export const MAX_SIGNUP_CAP = 10_000;
/** signup_counts rows are deleted after this many days; abuse_events after ABUSE_EVENT_RETENTION_DAYS. */
export const SIGNUP_COUNT_RETENTION_DAYS = 30;
export const ABUSE_EVENT_RETENTION_DAYS = 180;
export const SIGNUP_LIMIT_ERROR = 'SignupLimit';

export interface SignupCaps { perIp: number; perRange: number }

const validCap = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= MAX_SIGNUP_CAP;

export async function getSignupCaps(): Promise<SignupCaps> {
    const raw = await db.getPlatformSetting(SIGNUP_CAPS_KEY);
    if (!raw) return { ...DEFAULT_SIGNUP_CAPS };
    try {
        const v = JSON.parse(raw) as Partial<SignupCaps>;
        return { perIp: validCap(v.perIp) ? v.perIp! : DEFAULT_SIGNUP_CAPS.perIp, perRange: validCap(v.perRange) ? v.perRange! : DEFAULT_SIGNUP_CAPS.perRange };
    } catch {
        return { ...DEFAULT_SIGNUP_CAPS };
    }
}

export async function setSignupCaps(caps: SignupCaps, actorId: string): Promise<SignupCaps> {
    if (!validCap(caps.perIp) || !validCap(caps.perRange)) throw new Error(`Caps must be whole numbers from 1 to ${MAX_SIGNUP_CAP}`);
    const before = await getSignupCaps();
    await db.setPlatformSetting(SIGNUP_CAPS_KEY, JSON.stringify(caps), actorId);
    await db.addAbuseEvent({ kind: 'signup_limits_changed', actorId, detail: { from: `${before.perIp} per IP, ${before.perRange} per range`, to: `${caps.perIp} per IP, ${caps.perRange} per range` } });
    return caps;
}

function parseIpv4(ip: string): number[] | null {
    const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return null;
    const parts = m.slice(1).map(Number);
    return parts.every((p) => p <= 255) ? parts : null;
}

/** Expands an IPv6 address to 8 hextets, or null when it is not valid. */
function parseIpv6(ip: string): string[] | null {
    const addr = ip.replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
    if (!/^[0-9a-f:.]+$/.test(addr) || !addr.includes(':')) return null;
    const halves = addr.split('::');
    if (halves.length > 2) return null;
    const side = (h: string) => (h ? h.split(':') : []);
    let head = side(halves[0]);
    let tail = halves.length === 2 ? side(halves[1]) : [];
    // A trailing dotted IPv4 counts as two hextets.
    const last = (halves.length === 2 ? tail : head).at(-1);
    if (last && last.includes('.')) {
        const v4 = parseIpv4(last);
        if (!v4) return null;
        const extra = [((v4[0] << 8) | v4[1]).toString(16), ((v4[2] << 8) | v4[3]).toString(16)];
        if (halves.length === 2) tail = [...tail.slice(0, -1), ...extra];
        else head = [...head.slice(0, -1), ...extra];
    }
    const fill = 8 - head.length - tail.length;
    if (halves.length === 1 ? fill !== 0 : fill < 1) return null;
    const all = [...head, ...Array(Math.max(0, fill)).fill('0'), ...tail];
    if (all.length !== 8 || !all.every((h) => /^[0-9a-f]{1,4}$/.test(h))) return null;
    return all.map((h) => h.padStart(4, '0'));
}

/** The normalised IP and its range: a.b.c.0/24 for IPv4 (including IPv4-mapped IPv6), the first 48 bits for IPv6. */
export function ipAndRange(ip: string | null | undefined): { ip: string; range: string } | null {
    if (!ip) return null;
    const trimmed = ip.trim();
    const v4 = parseIpv4(trimmed);
    if (v4) return { ip: v4.join('.'), range: `${v4.slice(0, 3).join('.')}.0/24` };
    const v6 = parseIpv6(trimmed);
    if (!v6) return null;
    if (v6.slice(0, 5).every((h) => h === '0000') && v6[5] === 'ffff') {
        const a = parseInt(v6[6], 16), b = parseInt(v6[7], 16);
        const mapped = [a >> 8, a & 255, b >> 8, b & 255];
        return { ip: mapped.join('.'), range: `${mapped.slice(0, 3).join('.')}.0/24` };
    }
    return { ip: v6.join(':'), range: `${v6.slice(0, 3).join(':')}::/48` };
}

export type SignupCheck =
    | { ok: true; ipHash: string | null }
    | { ok: false; reason: 'ip' | 'range'; ipHash: string | null };

/**
 * Reserves one new-account slot for this IP and its range for today, or refuses when either cap is
 * already reached. The reservation is atomic (upsert and read back), so parallel servers cannot overshoot;
 * a refused attempt gives its slot back. Unknown IPs (local development) and platform admins are not limited.
 */
export async function reserveSignup(ipRaw: string | null | undefined, email: string, now = new Date()): Promise<SignupCheck> {
    const parsed = ipAndRange(ipRaw);
    const ipHash = parsed ? hashIp(parsed.ip) : null;
    if (!parsed || isPlatformAdminEmail(email)) return { ok: true, ipHash };
    const rangeHash = hashIp(`range:${parsed.range}`)!;
    const day = utcDay(now);
    const caps = await getSignupCaps();
    const ipCount = await db.bumpSignupCount('ip', ipHash!, day);
    const rangeCount = await db.bumpSignupCount('range', rangeHash, day);
    if (ipCount <= caps.perIp && rangeCount <= caps.perRange) return { ok: true, ipHash };
    await db.bumpSignupCount('ip', ipHash!, day, -1);
    await db.bumpSignupCount('range', rangeHash, day, -1);
    const reason = ipCount > caps.perIp ? 'ip' : 'range';
    const domain = email.split('@')[1]?.toLowerCase() ?? '';
    await db.addAbuseEvent({
        kind: reason === 'ip' ? 'signup_ip_limit' : 'signup_range_limit',
        ipHash,
        detail: { email_domain: domain, cap: reason === 'ip' ? caps.perIp : caps.perRange, day, ip: ipHash!.slice(0, 10), range: rangeHash.slice(0, 10) },
    }).catch((err) => console.error('abuse log failed', err));
    return { ok: false, reason, ipHash };
}
