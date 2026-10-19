/**
 * Peeking-safe statistics.
 *
 * Sequential test: a mixture sequential probability ratio test (mSPRT) on the difference of two conversion
 * rates, with a normal approximation and a normal mixing prior N(0, tau^2) on the true difference. Its
 * p-value is "always valid": checking results as often as you like keeps the chance of a false winner at
 * or below alpha. It needs more visitors than a fixed-sample z-test to reach the same verdict.
 *
 * Chance to beat control: the posterior probability that the variation's true rate is higher, with a flat
 * Beta(1, 1) prior on each rate and a normal approximation to the difference of the two Beta posteriors.
 */
import { normalCDF, type VariationStats } from './statistics';

export const SEQUENTIAL_ALPHA = 0.05;
/** Same floor as the fixed-sample test: no verdict before every compared arm has this many visitors. */
export const SEQUENTIAL_MIN_VISITORS = 100;
/** Mixing prior scale: the effect size the test is tuned for, as a share of the pooled conversion rate. */
export const TAU_RELATIVE = 0.2;
const TAU_FLOOR = 0.002;

export interface SequentialResult {
    /** Always-valid p-value of this variation against the control. */
    p_value: number;
    /** p_value below alpha divided by the number of comparisons (Bonferroni across variations). */
    is_significant: boolean;
    /** alpha / comparisons, the bar the p-value must clear. */
    threshold: number;
    comparisons: number;
}

/** Mixture likelihood ratio for the observed difference; 1 / ratio is the always-valid p-value. */
export function msprtRatio(control: VariationStats, variant: VariationStats): number {
    const n1 = control.total_users, n2 = variant.total_users;
    if (n1 <= 0 || n2 <= 0) return 1;
    const p1 = control.conversions / n1, p2 = variant.conversions / n2;
    const pooled = (control.conversions + variant.conversions) / (n1 + n2);
    // Variance of the observed difference; the pooled rate keeps it above zero when an arm has 0% or 100%.
    const v = Math.max(p1 * (1 - p1), pooled * (1 - pooled)) / n1 + Math.max(p2 * (1 - p2), pooled * (1 - pooled)) / n2;
    if (!(v > 0)) return 1;
    const tau = Math.max(TAU_FLOOR, TAU_RELATIVE * pooled);
    const t2 = tau * tau;
    const d = p2 - p1;
    const logRatio = 0.5 * Math.log(v / (v + t2)) + (t2 * d * d) / (2 * v * (v + t2));
    return Math.exp(Math.min(logRatio, 700));
}

export function sequentialTest(control: VariationStats, variant: VariationStats, comparisons = 1, alpha = SEQUENTIAL_ALPHA): SequentialResult {
    const m = Math.max(1, comparisons);
    const threshold = alpha / m;
    if (control.total_users < SEQUENTIAL_MIN_VISITORS || variant.total_users < SEQUENTIAL_MIN_VISITORS) {
        return { p_value: 1, is_significant: false, threshold, comparisons: m };
    }
    const p = Math.min(1, 1 / msprtRatio(control, variant));
    return { p_value: p, is_significant: p < threshold, threshold, comparisons: m };
}

/** Probability that the variation's true conversion rate is higher than the control's. */
export function chanceToBeatControl(control: { total_users: number; conversions: number }, variant: { total_users: number; conversions: number }): number {
    const beta = (c: number, n: number) => {
        const a = 1 + Math.max(0, c), b = 1 + Math.max(0, n - c);
        return { mean: a / (a + b), variance: (a * b) / ((a + b) ** 2 * (a + b + 1)) };
    };
    const x = beta(control.conversions, control.total_users);
    const y = beta(variant.conversions, variant.total_users);
    const sd = Math.sqrt(x.variance + y.variance);
    if (!(sd > 0)) return 0.5;
    return normalCDF((y.mean - x.mean) / sd);
}

/** "87.3%", or "-" before both arms have enough visitors for a fair read. */
export function formatChance(chance: number | null | undefined, controlVisitors: number, visitors: number): string {
    if (chance === null || chance === undefined || controlVisitors < SEQUENTIAL_MIN_VISITORS || visitors < SEQUENTIAL_MIN_VISITORS) return '-';
    if (chance > 0.999) return '>99.9%';
    if (chance < 0.001) return '<0.1%';
    return `${(chance * 100).toFixed(1)}%`;
}
