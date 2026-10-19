import { deviceFromUserAgent } from './targeting';
import { chanceToBeatControl, sequentialTest, SEQUENTIAL_MIN_VISITORS } from './sequential';

/**
 * Results by segment. Each visitor's device, landing source and new or returning type are stored once,
 * on the assignment row the bootstrap already writes, so segments add no extra writes per page view.
 */
export const SEGMENT_DIMS = ['device', 'source', 'visitor'] as const;
export type SegmentDim = (typeof SEGMENT_DIMS)[number];
/** Sources beyond the top ones (by visitors) are grouped under OTHER_SOURCES. */
export const MAX_SOURCES = 8;
export const OTHER_SOURCES = '(other)';
/** Visitors assigned before segments were stored, or with no usable value. */
export const NOT_RECORDED = '(not recorded)';

export interface SegmentInput {
    url: string;
    userAgent: string | null;
    referrer?: string | null;
    /** Session landing value the SDK sends: 'utm:<utm_source>' or 'ref:<referrer>'. */
    src?: string | null;
    visitor?: 'new' | 'returning' | null;
}

export interface AssignmentSegment { segment_device: string; segment_source: string | null; segment_visitor: string | null }

const bareHost = (h: string) => h.toLowerCase().replace(/^www\./, '');
/** Same rule as heatmap sources: lowercase host or utm_source without www., letters, digits, dots, dashes and underscores. */
function normalizeSource(src: string): string {
    const v = src.toLowerCase().trim().replace(/^www\./, '');
    return /^[a-z0-9._-]{1,60}$/.test(v) ? v : '';
}

const hostOf = (u: string | null | undefined) => {
    if (!u) return '';
    try { return bareHost(new URL(u).hostname); } catch { return ''; }
};
const decode = (v: string) => { try { return decodeURIComponent(v.replace(/\+/g, ' ')); } catch { return ''; } };

/**
 * Landing source: utm_source, else the referring site, else direct. The SDK sends the session's first page as
 * 'utm:<value>' or 'ref:<referrer>'. Without it (older cached SDK), the current page is used, and an internal
 * referrer leaves the source unknown.
 */
export function landingSourceOf(input: Pick<SegmentInput, 'url' | 'referrer' | 'src'>): string | null {
    const pageHost = hostOf(input.url);
    const src = input.src ?? '';
    if (src.startsWith('utm:')) return normalizeSource(decode(src.slice(4))) || 'direct';
    if (src.startsWith('ref:')) {
        const h = hostOf(src.slice(4));
        return h && h !== pageHost ? normalizeSource(h) || 'direct' : 'direct';
    }
    let utm = '';
    try { utm = new URL(input.url).searchParams.get('utm_source') ?? ''; } catch { utm = ''; }
    if (normalizeSource(utm)) return normalizeSource(utm);
    const ref = hostOf(input.referrer);
    if (!ref) return 'direct';
    if (ref === pageHost) return null;
    return normalizeSource(ref) || 'direct';
}

/** Segment keys for a new assignment. */
export function segmentOf(input: SegmentInput): AssignmentSegment {
    return {
        segment_device: deviceFromUserAgent(input.userAgent),
        segment_source: landingSourceOf(input),
        segment_visitor: input.visitor === 'new' || input.visitor === 'returning' ? input.visitor : null,
    };
}

export interface SegmentRow { dim: SegmentDim; key: string | null; variation_id: string; users: number; conversions: number }
export interface SegmentVariationInput { id: string; name: string; is_control: boolean }

export interface SegmentVariation {
    variation_id: string;
    variation_name: string;
    is_control: boolean;
    total_users: number;
    conversions: number;
    conversion_rate: number;
    /** Relative lift against the control in the same segment, null without control visitors. */
    lift: number | null;
    chance_to_beat_control: number | null;
    sequential_p_value: number | null;
    sequential_significant: boolean;
}

export interface Segment { key: string; visitors: number; variations: SegmentVariation[] }
export interface SegmentDimension { dim: SegmentDim; comparisons: number; segments: Segment[] }

/**
 * Per segment, each variation against the control in that segment. A segment counts as a difference only when
 * its sequential p-value clears alpha divided by every comparison in the dimension (variations times segments),
 * because looking at many segments finds chance differences.
 */
export function computeSegments(variations: SegmentVariationInput[], rows: SegmentRow[]): SegmentDimension[] {
    const control = variations.find((v) => v.is_control);
    return SEGMENT_DIMS.map((dim) => {
        const mine = rows.filter((r) => r.dim === dim);
        const byKey = new Map<string, Map<string, { users: number; conversions: number }>>();
        for (const r of mine) {
            const key = r.key || NOT_RECORDED;
            const m = byKey.get(key) ?? new Map();
            const cur = m.get(r.variation_id) ?? { users: 0, conversions: 0 };
            cur.users += Number(r.users) || 0;
            cur.conversions += Number(r.conversions) || 0;
            m.set(r.variation_id, cur);
            byKey.set(key, m);
        }
        const total = (m: Map<string, { users: number }>) => [...m.values()].reduce((a, x) => a + x.users, 0);
        let keys = [...byKey.keys()].sort((a, b) => total(byKey.get(b)!) - total(byKey.get(a)!) || a.localeCompare(b));
        if (dim === 'source') {
            const named = keys.filter((k) => k !== NOT_RECORDED);
            if (named.length > MAX_SOURCES) {
                const other = new Map<string, { users: number; conversions: number }>();
                for (const k of named.slice(MAX_SOURCES)) {
                    for (const [vid, x] of byKey.get(k)!) {
                        const cur = other.get(vid) ?? { users: 0, conversions: 0 };
                        cur.users += x.users;
                        cur.conversions += x.conversions;
                        other.set(vid, cur);
                    }
                    byKey.delete(k);
                }
                byKey.set(OTHER_SOURCES, other);
                keys = [...named.slice(0, MAX_SOURCES), OTHER_SOURCES, ...keys.filter((k) => k === NOT_RECORDED)];
            }
        }
        // The not-recorded bucket is shown but never tested.
        const tested = keys.filter((k) => k !== NOT_RECORDED);
        const comparisons = Math.max(1, tested.length * Math.max(1, variations.length - 1));
        const segments = keys.map((key) => {
            const m = byKey.get(key)!;
            const stat = (id: string) => m.get(id) ?? { users: 0, conversions: 0 };
            const c = control ? stat(control.id) : { users: 0, conversions: 0 };
            const cm = { total_users: c.users, conversions: c.conversions, conversion_rate: c.users ? c.conversions / c.users : 0 };
            const cRate = c.users ? c.conversions / c.users : 0;
            const vs = variations.map((v): SegmentVariation => {
                const x = stat(v.id);
                const rate = x.users ? x.conversions / x.users : 0;
                const vm = { total_users: x.users, conversions: x.conversions, conversion_rate: rate };
                const test = !v.is_control && control && key !== NOT_RECORDED;
                const s = test ? sequentialTest(cm, vm, comparisons) : null;
                const enough = c.users >= SEQUENTIAL_MIN_VISITORS && x.users >= SEQUENTIAL_MIN_VISITORS;
                return {
                    variation_id: v.id,
                    variation_name: v.name,
                    is_control: v.is_control,
                    total_users: x.users,
                    conversions: x.conversions,
                    conversion_rate: rate,
                    lift: v.is_control || !c.users || cRate === 0 ? null : (rate - cRate) / cRate,
                    chance_to_beat_control: test && enough ? chanceToBeatControl(cm, vm) : null,
                    sequential_p_value: s && enough ? s.p_value : null,
                    sequential_significant: !!s?.is_significant,
                };
            });
            return { key, visitors: total(m), variations: vs };
        });
        return { dim, comparisons, segments };
    });
}
