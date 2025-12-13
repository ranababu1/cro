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
 * Get Z-score for a given confidence level
 */
function getZScore(confidenceLevel: number): number {
    // Common confidence levels
    const zScores: Record<number, number> = {
        0.90: 1.645,
        0.95: 1.96,
        0.99: 2.576,
    };

    return zScores[confidenceLevel] || 1.96;
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
function calculatePValue(zScore: number): number {
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
function normalCDF(x: number): number {
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
    const zAlpha = getZScore(1 - alpha / 2); // Two-tailed
    const zBeta = getZScore(power);

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
