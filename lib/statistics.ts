/**
 * Statistics engine for A/B test analysis
 * Uses frequentist statistical methods (Z-test) for conversion rate comparison
 */

export interface VariationStats {
    total_users: number;
    conversions: number;
    conversion_rate: number;
}

export interface StatisticalResult {
    is_significant: boolean;
    p_value: number;
    confidence_level: number;
    z_score: number;
}

export interface ConfidenceInterval {
    lower: number;
    upper: number;
}

/**
 * Calculate confidence interval for a proportion using Wilson score method
 * More accurate than normal approximation, especially for small samples
 */
export function calculateConfidenceInterval(
    successes: number,
    trials: number,
    confidenceLevel: number = 0.95
): ConfidenceInterval {
    if (trials === 0) {
        return { lower: 0, upper: 0 };
    }

    const z = getZScore(confidenceLevel);
    const p = successes / trials;
    const n = trials;

    // Wilson score interval
    const denominator = 1 + z * z / n;
    const center = (p + z * z / (2 * n)) / denominator;
    const margin = (z / denominator) * Math.sqrt((p * (1 - p) / n) + (z * z / (4 * n * n)));

    return {
        lower: Math.max(0, center - margin),
        upper: Math.min(1, center + margin),
    };
}

/**
 * Inverse of the standard normal CDF (quantile function).
 * Peter Acklam's rational approximation, relative error below 1.2e-9.
 */
export function inverseNormalCDF(p: number): number {
    if (!(p > 0 && p < 1)) {
        throw new RangeError('p must be strictly between 0 and 1');
    }
    const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
    const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
    const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
    const pLow = 0.02425;
    if (p < pLow) {
        const q = Math.sqrt(-2 * Math.log(p));
        return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - pLow) {
        return -inverseNormalCDF(1 - p);
    }
    const q = p - 0.5;
    const r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/**
 * Two-sided critical z value for a confidence level, for example 0.95 gives 1.96.
 */
function getZScore(confidenceLevel: number): number {
    return inverseNormalCDF(1 - (1 - confidenceLevel) / 2);
}

/**
 * Calculate standard error for two proportions
 */
function calculatePooledStandardError(
    p1: number,
    n1: number,
    p2: number,
    n2: number
): number {
    // Pooled proportion
    const pooledP = (p1 * n1 + p2 * n2) / (n1 + n2);

    // Standard error of the difference
    return Math.sqrt(pooledP * (1 - pooledP) * (1 / n1 + 1 / n2));
}

/**
 * Calculate Z-score for two-proportion z-test
 */
function calculateZScore(
    p1: number,
    n1: number,
    p2: number,
    n2: number
): number {
    const se = calculatePooledStandardError(p1, n1, p2, n2);

    if (se === 0) {
        return 0;
    }

    return (p1 - p2) / se;
}

/**
 * Calculate p-value from z-score (two-tailed test)
 */
export function calculatePValue(zScore: number): number {
    // Using normal distribution approximation
    const absZ = Math.abs(zScore);

    // Approximate cumulative distribution function for standard normal
    // Using error function approximation
    const p = 1 - normalCDF(absZ);

    // Two-tailed test
    return 2 * p;
}

/**
 * Approximate cumulative distribution function for standard normal distribution
 */
export function normalCDF(x: number): number {
    // Approximation using error function
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

    return x > 0 ? 1 - prob : prob;
}

/**
 * Perform statistical significance test between control and variation
 */
export function calculateStatisticalSignificance(
    control: VariationStats,
    variation: VariationStats,
    confidenceLevel: number = 0.95
): StatisticalResult {
    // Check for minimum sample size
    const minSampleSize = 100;
    if (control.total_users < minSampleSize || variation.total_users < minSampleSize) {
        return {
            is_significant: false,
            p_value: 1,
            confidence_level: confidenceLevel,
            z_score: 0,
        };
    }

    // Calculate conversion rates
    const p1 = control.conversion_rate;
    const n1 = control.total_users;
    const p2 = variation.conversion_rate;
    const n2 = variation.total_users;

    // Calculate z-score
    const zScore = calculateZScore(p1, n1, p2, n2);

    // Calculate p-value
    const pValue = calculatePValue(zScore);

    // Determine significance
    const alpha = 1 - confidenceLevel;
    const isSignificant = pValue < alpha;

    return {
        is_significant: isSignificant,
        p_value: pValue,
        confidence_level: confidenceLevel,
        z_score: zScore,
    };
}

/**
 * Calculate relative lift (percentage improvement)
 */
export function calculateLift(
    controlRate: number,
    variationRate: number
): number {
    if (controlRate === 0) {
        return 0;
    }

    return ((variationRate - controlRate) / controlRate) * 100;
}

/**
 * Estimate required sample size for detecting a minimum detectable effect
 */
export function estimateRequiredSampleSize(
    baselineRate: number,
    minimumDetectableEffect: number,
    alpha: number = 0.05,
    power: number = 0.80
): number {
    // Effect size (difference in conversion rates)
    const delta = baselineRate * minimumDetectableEffect;

    // Z-scores for alpha and power
    const zAlpha = inverseNormalCDF(1 - alpha / 2); // Two-tailed
    const zBeta = inverseNormalCDF(power);

    // Standard deviation
    const p1 = baselineRate;
    const p2 = baselineRate + delta;
    const pooledP = (p1 + p2) / 2;

    // Sample size formula for two-proportion z-test
    const n = (2 * pooledP * (1 - pooledP) * Math.pow(zAlpha + zBeta, 2)) / Math.pow(delta, 2);

    return Math.ceil(n);
}

/**
 * Check if experiment has reached sufficient sample size
 */
export function hasSufficientSampleSize(
    sampleSize: number,
    minimumRequired: number = 100
): boolean {
    return sampleSize >= minimumRequired;
}

/** Natural log of the gamma function (Lanczos approximation). */
function logGamma(z: number): number {
    const g = 7;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
    z -= 1;
    let x = c[0];
    for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Upper regularized incomplete gamma Q(a, x), used for chi-square p-values. */
function upperGammaQ(a: number, x: number): number {
    if (x <= 0) return 1;
    if (x < a + 1) {
        let sum = 1 / a, term = sum;
        for (let n = 1; n < 500; n++) { term *= x / (a + n); sum += term; if (Math.abs(term) < Math.abs(sum) * 1e-14) break; }
        return Math.max(0, 1 - sum * Math.exp(-x + a * Math.log(x) - logGamma(a)));
    }
    let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
    for (let i = 1; i < 500; i++) {
        const an = -i * (i - a);
        b += 2;
        d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
        c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < 1e-14) break;
    }
    return Math.min(1, Math.exp(-x + a * Math.log(x) - logGamma(a)) * h);
}

/** p-value of a chi-square statistic with df degrees of freedom. */
export function chiSquarePValue(stat: number, df: number): number {
    if (df <= 0) return 1;
    return upperGammaQ(df / 2, stat / 2);
}

export const SRM_P_THRESHOLD = 0.001;
export const SRM_MIN_VISITORS = 100;

/**
 * Sample ratio mismatch: chi-square goodness of fit of observed visitors per variation
 * against the configured weights. Flags a mismatch when p < 0.001 with at least 100 visitors.
 */
export function sampleRatioMismatch(observed: number[], weights: number[]): { p_value: number; chi_square: number; mismatch: boolean; total: number } {
    const total = observed.reduce((a, b) => a + b, 0);
    const wsum = weights.reduce((a, b) => a + b, 0);
    if (total === 0 || wsum <= 0 || observed.length < 2) return { p_value: 1, chi_square: 0, mismatch: false, total };
    let chi = 0;
    for (let i = 0; i < observed.length; i++) {
        const exp = (total * weights[i]) / wsum;
        if (exp > 0) chi += ((observed[i] - exp) ** 2) / exp;
    }
    const p = chiSquarePValue(chi, observed.length - 1);
    return { p_value: p, chi_square: chi, mismatch: total >= SRM_MIN_VISITORS && p < SRM_P_THRESHOLD, total };
}
