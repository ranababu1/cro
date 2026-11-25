/**
 * Statistical methodology page content. Every number here is computed by the same code the results page uses,
 * and every threshold is imported from it, so the page cannot drift from the product.
 * tests/methodologyPage.test.ts checks the formulas and claims against lib/statistics, lib/sequential,
 * lib/liveStats, lib/revenue and lib/autoShift.
 */
import { calculateConfidenceInterval, calculateStatisticalSignificance, estimateRequiredSampleSize, sampleRatioMismatch, SRM_MIN_VISITORS, SRM_P_THRESHOLD } from '@/lib/statistics';
import { chanceToBeatControl, formatChance, sequentialTest, SEQUENTIAL_ALPHA, SEQUENTIAL_MIN_VISITORS, TAU_FLOOR, TAU_RELATIVE } from '@/lib/sequential';
import { upliftInterval } from '@/lib/liveStats';
import { MIN_REVENUE_VISITORS, welchPValue } from '@/lib/revenue';
import { AUTO_SHIFT_FLOOR, AUTO_SHIFT_INTERVAL_MS, AUTO_SHIFT_MIN_VISITORS } from '@/lib/autoShift';
import { WORKED_EXAMPLE } from './home';

export const CONSTANTS = {
    alpha: SEQUENTIAL_ALPHA,
    minVisitors: SEQUENTIAL_MIN_VISITORS,
    tauRelative: TAU_RELATIVE,
    tauFloor: TAU_FLOOR,
    srmP: SRM_P_THRESHOLD,
    srmMin: SRM_MIN_VISITORS,
    revenueMin: MIN_REVENUE_VISITORS,
    shiftMin: AUTO_SHIFT_MIN_VISITORS,
    shiftFloor: AUTO_SHIFT_FLOOR,
    shiftHours: AUTO_SHIFT_INTERVAL_MS / 3_600_000,
};

export const SUMMARY: { number: string; method: string; when: string; anchor: string }[] = [
    { number: 'Conversion rate', method: 'Visitors who converted divided by visitors in the version', when: 'Always', anchor: 'rates' },
    { number: '95% interval for each rate', method: 'Wilson score interval', when: 'Always', anchor: 'rates' },
    { number: 'Winner verdict', method: `Mixture sequential probability ratio test (mSPRT), ${SEQUENTIAL_ALPHA} split across the variants`, when: `Every version has ${SEQUENTIAL_MIN_VISITORS} visitors`, anchor: 'sequential' },
    { number: 'Chance to beat control', method: 'Beta(1, 1) prior on each rate, normal approximation of the difference', when: `Both versions have ${SEQUENTIAL_MIN_VISITORS} visitors`, anchor: 'chance' },
    { number: 'Lift and its interval', method: 'Relative change; Newcombe hybrid score interval on the difference', when: 'The control has a conversion', anchor: 'lift' },
    { number: 'Sample ratio check', method: `Chi-square goodness of fit against the weights, flagged below p = ${SRM_P_THRESHOLD}`, when: `${SRM_MIN_VISITORS} visitors in the test`, anchor: 'srm' },
    { number: 'Revenue per visitor', method: "Welch's t-test with a normal approximation", when: `Both versions have ${MIN_REVENUE_VISITORS} visitors`, anchor: 'revenue' },
    { number: 'Visitors needed', method: 'Fixed-sample formula, 95% confidence and 80% power', when: 'Test planner', anchor: 'sample-size' },
];

const arm = (visitors: number, conversions: number) => ({ total_users: visitors, conversions, conversion_rate: conversions / visitors });

/** Visitors per version before an observed lift of this size first clears 0.05, for the sequential test and a single-look z-test. */
export function visitorsToSignificance(baseline: number, lift: number, step = 50, max = 400_000): { sequential: number; fixed: number } {
    let sequential = 0, fixed = 0;
    for (let n = SEQUENTIAL_MIN_VISITORS; n <= max && !(sequential && fixed); n += step) {
        const a = arm(n, Math.round(n * baseline)), b = arm(n, Math.round(n * baseline * (1 + lift)));
        if (!fixed && calculateStatisticalSignificance(a, b).p_value < SEQUENTIAL_ALPHA) fixed = n;
        if (!sequential && sequentialTest(a, b).p_value < SEQUENTIAL_ALPHA) sequential = n;
    }
    return { sequential, fixed };
}

export const COST_CASES: { baseline: number; lift: number }[] = [
    { baseline: 0.02, lift: 0.2 },
    { baseline: 0.05, lift: 0.2 },
    { baseline: 0.05, lift: 0.3 },
    { baseline: 0.1, lift: 0.1 },
];

/** Example revenue per visitor (mean and standard deviation in dollars), labelled as example data on the page. */
export const REVENUE_EXAMPLE = { control: { mean: 3.1, sd: 18 }, variant: { mean: 3.6, sd: 20 }, small: 5000, large: 20000 };

/** Example splits for the sample ratio check, on a 50/50 test. */
export const SRM_EXAMPLES = { bad: [5500, 4500], fine: [5080, 4920] };

export function methodologyExamples() {
    const ex = WORKED_EXAMPLE;
    const c = arm(ex.control.visitors, ex.control.conversions);
    const v = arm(ex.variant.visitors, ex.variant.conversions);
    const ec = arm(ex.early.visitors, ex.early.controlConversions);
    const ev = arm(ex.early.visitors, ex.early.variantConversions);
    const pooled = (c.conversions + v.conversions) / (c.total_users + v.total_users);
    const rev = (n: number) => welchPValue(
        { mean: REVENUE_EXAMPLE.variant.mean, variance: REVENUE_EXAMPLE.variant.sd ** 2, n },
        { mean: REVENUE_EXAMPLE.control.mean, variance: REVENUE_EXAMPLE.control.sd ** 2, n },
    );
    return {
        ex,
        control: { ...c, ci: calculateConfidenceInterval(c.conversions, c.total_users) },
        variant: { ...v, ci: calculateConfidenceInterval(v.conversions, v.total_users) },
        pooled,
        tau: Math.max(TAU_FLOOR, TAU_RELATIVE * pooled),
        seq: sequentialTest(c, v, 1),
        seqThree: sequentialTest(c, v, 3),
        early: { seq: sequentialTest(ec, ev, 1), fixed: calculateStatisticalSignificance(ec, ev), chance: chanceToBeatControl(ec, ev) },
        chance: chanceToBeatControl(c, v),
        chanceLabel: formatChance(chanceToBeatControl(c, v), c.total_users, v.total_users),
        earlyChanceLabel: formatChance(chanceToBeatControl(ec, ev), ec.total_users, ev.total_users),
        lift: (v.conversion_rate - c.conversion_rate) / c.conversion_rate,
        liftCi: upliftInterval(c.conversions, c.total_users, v.conversions, v.total_users)!,
        srmBad: sampleRatioMismatch(SRM_EXAMPLES.bad, [50, 50]),
        srmFine: sampleRatioMismatch(SRM_EXAMPLES.fine, [50, 50]),
        revenueSmall: rev(REVENUE_EXAMPLE.small),
        revenueLarge: rev(REVENUE_EXAMPLE.large),
        sampleSize: estimateRequiredSampleSize(0.05, 0.2),
        cost: COST_CASES.map((k) => ({ ...k, ...visitorsToSignificance(k.baseline, k.lift) })),
    };
}
