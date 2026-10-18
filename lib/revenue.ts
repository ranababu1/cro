import { normalCDF } from './statistics';

/** Largest order value accepted in one event. Larger values are refused as likely mistakes. */
export const MAX_REVENUE_PER_EVENT = 1_000_000;
/** Revenue events counted per visitor and goal. Later ones still count as conversions, without revenue. */
export const MAX_REVENUE_EVENTS_PER_VISITOR = 50;
/** Visitors needed in both arms before a revenue verdict is shown. */
export const MIN_REVENUE_VISITORS = 30;

export interface RevenueRow { variation_id: string; buyers: number; orders: number; revenue: number; sumsq: number }

export interface RevenueVariation {
    variation_id: string;
    name: string;
    is_control: boolean;
    visitors: number;
    buyers: number;
    orders: number;
    revenue: number;
    /** Revenue per visitor (all visitors, buyers or not). */
    per_visitor: number;
    /** Average order value. */
    average_order: number;
    /** Revenue per visitor vs control, as a fraction. Null for the control or when the control has none. */
    lift: number | null;
}

export interface RevenueVerdict { variation_id: string; lift: number | null; p_value: number; significant: boolean }

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Mean and sample variance of per-visitor revenue, where visitors without a purchase count as 0. */
export function perVisitorMoments(visitors: number, revenue: number, sumsq: number): { mean: number; variance: number } {
    if (visitors <= 0) return { mean: 0, variance: 0 };
    const mean = revenue / visitors;
    const variance = visitors > 1 ? Math.max(0, (sumsq - (revenue * revenue) / visitors) / (visitors - 1)) : 0;
    return { mean, variance };
}

/** Two-sided p-value of Welch's t-test with a normal approximation (fine at the sample sizes shown). */
export function welchPValue(a: { mean: number; variance: number; n: number }, b: { mean: number; variance: number; n: number }): number {
    if (a.n < 2 || b.n < 2) return 1;
    const se = Math.sqrt(a.variance / a.n + b.variance / b.n);
    if (!(se > 0)) return a.mean === b.mean ? 1 : 0;
    const z = Math.abs(a.mean - b.mean) / se;
    return Math.min(1, Math.max(0, 2 * (1 - normalCDF(z))));
}

/**
 * Revenue numbers per variation for one revenue goal, plus a verdict for the best variant
 * (highest revenue per visitor) against the control.
 */
export function computeRevenue(
    variations: Array<{ id: string; name: string; is_control: boolean }>,
    visitors: Map<string, number>,
    rows: RevenueRow[],
    alpha = 0.05,
): { variations: RevenueVariation[]; verdict: RevenueVerdict | null } {
    const byVar = new Map(rows.map((r) => [r.variation_id, r]));
    const control = variations.find((v) => v.is_control);
    const stats = variations.map((v) => {
        const r = byVar.get(v.id) ?? { buyers: 0, orders: 0, revenue: 0, sumsq: 0 };
        const n = Math.max(visitors.get(v.id) ?? 0, r.buyers);
        return { v, r, n, m: perVisitorMoments(n, r.revenue, r.sumsq) };
    });
    const ctrl = stats.find((s) => s.v.id === control?.id);
    const out: RevenueVariation[] = stats.map(({ v, r, n, m }) => ({
        variation_id: v.id,
        name: v.name,
        is_control: v.is_control,
        visitors: n,
        buyers: r.buyers,
        orders: r.orders,
        revenue: round2(r.revenue),
        per_visitor: round2(m.mean),
        average_order: r.orders > 0 ? round2(r.revenue / r.orders) : 0,
        lift: !v.is_control && ctrl && ctrl.m.mean > 0 ? (m.mean - ctrl.m.mean) / ctrl.m.mean : null,
    }));
    const best = stats.filter((s) => !s.v.is_control).sort((a, b) => b.m.mean - a.m.mean)[0];
    let verdict: RevenueVerdict | null = null;
    if (best && ctrl && best.n >= MIN_REVENUE_VISITORS && ctrl.n >= MIN_REVENUE_VISITORS) {
        const p = welchPValue({ ...best.m, n: best.n }, { ...ctrl.m, n: ctrl.n });
        verdict = { variation_id: best.v.id, lift: out.find((o) => o.variation_id === best.v.id)!.lift, p_value: p, significant: p < alpha };
    }
    return { variations: out, verdict };
}
