import { describe, it, expect } from 'vitest';
import {
    calculateConfidenceInterval,
    calculateStatisticalSignificance,
    calculateLift,
    estimateRequiredSampleSize,
    inverseNormalCDF,
    normalCDF,
    calculatePValue,
} from '@/lib/statistics';

// Reference values computed with scipy.stats (Python).

describe('normal distribution helpers', () => {
    it('normalCDF matches reference values', () => {
        expect(normalCDF(0)).toBeCloseTo(0.5, 6);
        expect(normalCDF(1.96)).toBeCloseTo(0.9750021, 6);
        expect(normalCDF(-1.96)).toBeCloseTo(0.0249979, 6);
    });

    it('inverseNormalCDF matches scipy norm.ppf', () => {
        expect(inverseNormalCDF(0.975)).toBeCloseTo(1.959963984540054, 8);
        expect(inverseNormalCDF(0.8)).toBeCloseTo(0.8416212335729143, 8);
        expect(inverseNormalCDF(0.995)).toBeCloseTo(2.5758293035489, 8);
        expect(inverseNormalCDF(0.01)).toBeCloseTo(-2.3263478740408408, 8);
        expect(inverseNormalCDF(0.5)).toBeCloseTo(0, 10);
    });

    it('inverseNormalCDF rejects values outside (0, 1)', () => {
        expect(() => inverseNormalCDF(0)).toThrow(RangeError);
        expect(() => inverseNormalCDF(1)).toThrow(RangeError);
    });

    it('two-sided p-value for z = 1.96 is about 0.05', () => {
        expect(calculatePValue(1.96)).toBeCloseTo(0.04999579, 6);
    });
});

describe('calculateConfidenceInterval (Wilson)', () => {
    it('matches reference for 50/100 at 95%', () => {
        const ci = calculateConfidenceInterval(50, 100, 0.95);
        expect(ci.lower).toBeCloseTo(0.4038315, 5);
        expect(ci.upper).toBeCloseTo(0.5961685, 5);
    });

    it('stays inside [0, 1] at the edges', () => {
        const zero = calculateConfidenceInterval(0, 20);
        expect(zero.lower).toBe(0);
        expect(zero.upper).toBeGreaterThan(0);
        const all = calculateConfidenceInterval(20, 20);
        expect(all.upper).toBe(1);
    });

    it('returns zeros with no trials', () => {
        expect(calculateConfidenceInterval(0, 0)).toEqual({ lower: 0, upper: 0 });
    });
});

describe('calculateStatisticalSignificance (two-proportion z-test)', () => {
    it('matches reference for 100/1000 vs 130/1000', () => {
        const r = calculateStatisticalSignificance(
            { total_users: 1000, conversions: 100, conversion_rate: 0.1 },
            { total_users: 1000, conversions: 130, conversion_rate: 0.13 },
        );
        expect(r.z_score).toBeCloseTo(-2.1027406, 5);
        expect(r.p_value).toBeCloseTo(0.0354885, 5);
        expect(r.is_significant).toBe(true);
    });

    it('is not significant for identical rates', () => {
        const r = calculateStatisticalSignificance(
            { total_users: 5000, conversions: 500, conversion_rate: 0.1 },
            { total_users: 5000, conversions: 500, conversion_rate: 0.1 },
        );
        expect(r.p_value).toBeCloseTo(1, 6);
        expect(r.is_significant).toBe(false);
    });

    it('refuses to call significance below 100 users per arm', () => {
        const r = calculateStatisticalSignificance(
            { total_users: 50, conversions: 1, conversion_rate: 0.02 },
            { total_users: 50, conversions: 40, conversion_rate: 0.8 },
        );
        expect(r.is_significant).toBe(false);
    });

    it('uses the requested confidence level', () => {
        const control = { total_users: 1000, conversions: 100, conversion_rate: 0.1 };
        const variant = { total_users: 1000, conversions: 130, conversion_rate: 0.13 };
        expect(calculateStatisticalSignificance(control, variant, 0.95).is_significant).toBe(true);
        expect(calculateStatisticalSignificance(control, variant, 0.99).is_significant).toBe(false);
    });
});

describe('calculateLift', () => {
    it('returns relative lift in percent', () => {
        expect(calculateLift(0.1, 0.13)).toBeCloseTo(30, 6);
        expect(calculateLift(0.1, 0.08)).toBeCloseTo(-20, 6);
    });
    it('returns 0 when control rate is 0', () => {
        expect(calculateLift(0, 0.1)).toBe(0);
    });
});

describe('estimateRequiredSampleSize', () => {
    it('matches reference for 10% baseline, 20% relative MDE, alpha 0.05, power 0.8', () => {
        // 2 * 0.11 * 0.89 * (z_0.975 + z_0.8)^2 / 0.02^2 = 3842.03 with scipy
        expect(estimateRequiredSampleSize(0.1, 0.2)).toBe(3843);
    });

    it('needs more users for higher power', () => {
        expect(estimateRequiredSampleSize(0.1, 0.2, 0.05, 0.9)).toBeGreaterThan(estimateRequiredSampleSize(0.1, 0.2, 0.05, 0.8));
    });
});
