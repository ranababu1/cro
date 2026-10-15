import { z } from 'zod';

/**
 * Audience targeting for a test. Stored as JSON on experiments.targeting and checked
 * on the server before a new visitor is enrolled. Visitors already in a test keep their version.
 * Empty or missing rules mean everyone qualifies.
 */
export const DEVICES = ['desktop', 'mobile', 'tablet'] as const;
export type Device = (typeof DEVICES)[number];
export const VISITOR_TYPES = ['all', 'new', 'returning'] as const;
export type VisitorType = (typeof VISITOR_TYPES)[number];

const utmValue = z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().max(200).optional());

export const targetingSchema = z
    .object({
        devices: z.array(z.enum(DEVICES)).max(3).optional(),
        utm_source: utmValue,
        utm_medium: utmValue,
        utm_campaign: utmValue,
        referrer_contains: utmValue,
        visitor: z.enum(VISITOR_TYPES).optional(),
    })
    .strict();

export type Targeting = z.infer<typeof targetingSchema>;

export interface VisitorContext {
    url: string;
    userAgent: string | null;
    referrer?: string | null;
    visitorType?: 'new' | 'returning' | null;
}

export function deviceFromUserAgent(ua: string | null | undefined): Device {
    const s = ua || '';
    if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(s)) return 'tablet';
    if (/mobi|iphone|ipod|android|windows phone|blackberry|opera mini/i.test(s)) return 'mobile';
    return 'desktop';
}

/** Parses stored targeting JSON. Bad data is treated as no targeting. */
export function parseTargeting(raw: string | null | undefined): Targeting {
    if (!raw) return {};
    try {
        const r = targetingSchema.safeParse(JSON.parse(raw));
        return r.success ? r.data : {};
    } catch {
        return {};
    }
}

/** Removes empty rules so "no targeting" is stored as null. */
export function serializeTargeting(t: Targeting | null | undefined): string | null {
    if (!t) return null;
    const clean: Targeting = {};
    if (t.devices && t.devices.length > 0 && t.devices.length < DEVICES.length) clean.devices = [...new Set(t.devices)];
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'referrer_contains'] as const) if (t[k]) clean[k] = t[k];
    if (t.visitor && t.visitor !== 'all') clean.visitor = t.visitor;
    return Object.keys(clean).length ? JSON.stringify(clean) : null;
}

export function hasTargeting(t: Targeting): boolean {
    return serializeTargeting(t) !== null;
}

/** Returns null when the visitor qualifies, or the name of the first rule that failed. */
export function failedRule(t: Targeting, ctx: VisitorContext): string | null {
    if (t.devices && t.devices.length > 0 && !t.devices.includes(deviceFromUserAgent(ctx.userAgent))) return 'device';
    let params: URLSearchParams | null = null;
    try { params = new URL(ctx.url).searchParams; } catch { params = null; }
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign'] as const) {
        const want = t[k];
        if (!want) continue;
        const got = params?.get(k) || '';
        if (got.toLowerCase() !== want.toLowerCase()) return k;
    }
    if (t.referrer_contains && !(ctx.referrer || '').toLowerCase().includes(t.referrer_contains.toLowerCase())) return 'referrer';
    if (t.visitor === 'new' && ctx.visitorType === 'returning') return 'visitor';
    if (t.visitor === 'returning' && ctx.visitorType !== 'returning') return 'visitor';
    return null;
}

/** Plain summary for the dashboard, for example "Mobile only, utm_source = google". */
export function describeTargeting(t: Targeting): string {
    const parts: string[] = [];
    if (t.devices?.length) parts.push(`${t.devices.map((d) => d[0].toUpperCase() + d.slice(1)).join(' and ')} only`);
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign'] as const) if (t[k]) parts.push(`${k} = ${t[k]}`);
    if (t.referrer_contains) parts.push(`referrer contains ${t.referrer_contains}`);
    if (t.visitor === 'new') parts.push('new visitors only');
    if (t.visitor === 'returning') parts.push('returning visitors only');
    return parts.length ? parts.join(', ') : 'All visitors';
}
