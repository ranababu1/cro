import { z } from 'zod';

export const MAX_FUNNELS = 10;
export const MIN_FUNNEL_STEPS = 2;
export const MAX_FUNNEL_STEPS = 10;

export const funnelSchema = z.object({
    name: z.string().trim().min(1, 'Funnel name is required').max(120),
    steps: z.array(z.string().min(1).max(100)).min(MIN_FUNNEL_STEPS, `A funnel needs at least ${MIN_FUNNEL_STEPS} steps`).max(MAX_FUNNEL_STEPS, `A funnel can have up to ${MAX_FUNNEL_STEPS} steps`)
        .refine((s) => new Set(s).size === s.length, 'Each goal can appear once in a funnel'),
}).strict();

export function parseSteps(raw: string): string[] {
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch {
        return [];
    }
}

/** First conversion time of a goal by a visitor in one variation. */
export interface FirstHit { variation_id: string; user_id: string; goal_id: string; t: string }

export interface FunnelStep { goal_id: string; name: string; users: number; of_visitors: number; of_previous: number }
export interface FunnelVariation { variation_id: string; name: string; is_control: boolean; visitors: number; steps: FunnelStep[]; completion: number }

/**
 * A visitor reaches step k when they reached step k-1 and first completed goal k at or after they first
 * completed goal k-1. Rates are against visitors assigned to the variation and against the previous step.
 */
export function computeFunnel(
    steps: { id: string; name: string }[],
    variations: { id: string; name: string; is_control: boolean }[],
    visitors: Map<string, number>,
    hits: FirstHit[],
): FunnelVariation[] {
    const byUser = new Map<string, Map<string, string>>();
    for (const h of hits) {
        const k = `${h.variation_id}\u0000${h.user_id}`;
        let m = byUser.get(k);
        if (!m) byUser.set(k, (m = new Map()));
        const cur = m.get(h.goal_id);
        if (!cur || h.t < cur) m.set(h.goal_id, h.t);
    }
    const counts = new Map<string, number[]>(variations.map((v) => [v.id, steps.map(() => 0)]));
    for (const [k, m] of byUser) {
        const arr = counts.get(k.slice(0, k.indexOf('\u0000')));
        if (!arr) continue;
        let prev = '';
        for (let i = 0; i < steps.length; i++) {
            const t = m.get(steps[i].id);
            if (!t || t < prev) break;
            arr[i]++;
            prev = t;
        }
    }
    return variations.map((v) => {
        const n = visitors.get(v.id) ?? 0;
        const arr = counts.get(v.id)!;
        return {
            variation_id: v.id,
            name: v.name,
            is_control: v.is_control,
            visitors: n,
            steps: steps.map((s, i) => ({
                goal_id: s.id,
                name: s.name,
                users: arr[i],
                of_visitors: n > 0 ? arr[i] / n : 0,
                of_previous: i === 0 ? (n > 0 ? arr[0] / n : 0) : arr[i - 1] > 0 ? arr[i] / arr[i - 1] : 0,
            })),
            completion: n > 0 ? arr[steps.length - 1] / n : 0,
        };
    });
}

/** Funnel trend: visitors who started the funnel (first step) in each period, and how many of them finished it. */
export type TrendBucket = 'day' | 'week';
export const MAX_TREND_POINTS = 90;
export interface TrendPoint { period: string; started: number; completed: number; rate: number }
export interface FunnelTrend { bucket: TrendBucket; periods: string[]; variations: { variation_id: string; name: string; is_control: boolean; points: TrendPoint[] }[] }

const DAY_MS = 86_400_000;
/** UTC day, or the Monday that starts its UTC week. */
export function periodOf(iso: string, bucket: TrendBucket): string {
    const day = iso.slice(0, 10);
    if (bucket === 'day') return day;
    const t = Date.parse(`${day}T00:00:00Z`);
    const dow = (new Date(t).getUTCDay() + 6) % 7;
    return new Date(t - dow * DAY_MS).toISOString().slice(0, 10);
}

/** Day buckets up to 60 days of data, weeks beyond that. */
export function pickBucket(firstIso: string | null, lastIso: string | null, asked?: string | null): TrendBucket {
    if (asked === 'day' || asked === 'week') return asked;
    if (!firstIso || !lastIso) return 'day';
    return (Date.parse(lastIso) - Date.parse(firstIso)) / DAY_MS > 60 ? 'week' : 'day';
}

/**
 * Same step rule as computeFunnel. Each visitor is counted in the period of their first step and counts as
 * completed when they finished every step in order (whenever that happened). Gaps are filled with zeros,
 * and only the latest MAX_TREND_POINTS periods are kept.
 */
export function computeFunnelTrend(
    steps: { id: string }[],
    variations: { id: string; name: string; is_control: boolean }[],
    hits: FirstHit[],
    bucket: TrendBucket,
    now = new Date(),
): FunnelTrend {
    const byUser = new Map<string, Map<string, string>>();
    for (const h of hits) {
        const k = `${h.variation_id}\u0000${h.user_id}`;
        let m = byUser.get(k);
        if (!m) byUser.set(k, (m = new Map()));
        const cur = m.get(h.goal_id);
        if (!cur || h.t < cur) m.set(h.goal_id, h.t);
    }
    const cells = new Map<string, { started: number; completed: number }>();
    let first = '';
    for (const [k, m] of byUser) {
        const start = m.get(steps[0].id);
        if (!start) continue;
        let prev = start, done = true;
        for (let i = 1; i < steps.length; i++) {
            const t = m.get(steps[i].id);
            if (!t || t < prev) { done = false; break; }
            prev = t;
        }
        const p = periodOf(start, bucket);
        if (!first || p < first) first = p;
        const key = `${k.slice(0, k.indexOf('\u0000'))}\u0000${p}`;
        const c = cells.get(key) ?? { started: 0, completed: 0 };
        c.started++;
        if (done) c.completed++;
        cells.set(key, c);
    }
    const periods: string[] = [];
    if (first) {
        const step = bucket === 'day' ? DAY_MS : 7 * DAY_MS;
        const last = periodOf(now.toISOString(), bucket);
        for (let t = Date.parse(`${first}T00:00:00Z`); t <= Date.parse(`${last}T00:00:00Z`); t += step) periods.push(new Date(t).toISOString().slice(0, 10));
    }
    const kept = periods.slice(-MAX_TREND_POINTS);
    return {
        bucket,
        periods: kept,
        variations: variations.map((v) => ({
            variation_id: v.id, name: v.name, is_control: v.is_control,
            points: kept.map((p) => {
                const c = cells.get(`${v.id}\u0000${p}`) ?? { started: 0, completed: 0 };
                return { period: p, started: c.started, completed: c.completed, rate: c.started > 0 ? c.completed / c.started : 0 };
            }),
        })),
    };
}
