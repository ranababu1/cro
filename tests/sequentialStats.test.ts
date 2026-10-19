import { describe, it, expect } from 'vitest';
import { chanceToBeatControl, formatChance, msprtRatio, sequentialTest } from '@/lib/sequential';
import { calculateStatisticalSignificance } from '@/lib/statistics';
import { buildLiveStats } from '@/lib/liveStats';

const arm = (n: number, c: number) => ({ total_users: n, conversions: c, conversion_rate: n ? c / n : 0 });

// Small seeded PRNG so the simulation is the same on every run.
function rng(seed: number) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

describe('sequential test', () => {
    it('needs 100 visitors per arm and splits alpha across comparisons', () => {
        expect(sequentialTest(arm(99, 10), arm(500, 90))).toMatchObject({ p_value: 1, is_significant: false });
        const r = sequentialTest(arm(2400, 120), arm(2400, 175), 3);
        expect(r.threshold).toBeCloseTo(0.05 / 3);
        expect(r.p_value).toBeLessThan(0.05);
        expect(r.is_significant).toBe(false);
        expect(sequentialTest(arm(2400, 120), arm(2400, 175), 1).is_significant).toBe(true);
    });
    it('is more conservative than a one-look z-test for the same data', () => {
        const c = arm(1200, 60), v = arm(1200, 84);
        expect(calculateStatisticalSignificance(c, v).is_significant).toBe(true);
        expect(sequentialTest(c, v).is_significant).toBe(false);
    });
    it('handles 0% and 100% arms without dividing by zero', () => {
        expect(Number.isFinite(msprtRatio(arm(500, 0), arm(500, 0)))).toBe(true);
        expect(sequentialTest(arm(500, 0), arm(500, 0)).is_significant).toBe(false);
        expect(sequentialTest(arm(500, 500), arm(500, 500)).is_significant).toBe(false);
        expect(sequentialTest(arm(500, 0), arm(500, 60)).is_significant).toBe(true);
    });
    it('keeps false winners under 5% when checking after every 200 visitors (A/A simulation)', () => {
        const rand = rng(42);
        const runs = 400, checks = 50, step = 200, rate = 0.05;
        let seqFalse = 0, zFalse = 0;
        for (let r = 0; r < runs; r++) {
            let n = 0, c1 = 0, c2 = 0, seqHit = false, zHit = false;
            for (let k = 0; k < checks; k++) {
                for (let i = 0; i < step; i++) { if (rand() < rate) c1++; if (rand() < rate) c2++; }
                n += step;
                if (!seqHit && sequentialTest(arm(n, c1), arm(n, c2)).is_significant) seqHit = true;
                if (!zHit && calculateStatisticalSignificance(arm(n, c1), arm(n, c2)).is_significant) zHit = true;
            }
            if (seqHit) seqFalse++;
            if (zHit) zFalse++;
        }
        expect(seqFalse / runs).toBeLessThanOrEqual(0.05);
        // The fixed-sample test checked this often finds far more false winners, which is the point.
        expect(zFalse / runs).toBeGreaterThan(0.15);
    });
    it('still finds a real 30% lift', () => {
        const rand = rng(7);
        let found = 0;
        for (let r = 0; r < 50; r++) {
            let n = 0, c1 = 0, c2 = 0, hit = false;
            while (n < 40000 && !hit) {
                for (let i = 0; i < 500; i++) { if (rand() < 0.05) c1++; if (rand() < 0.065) c2++; }
                n += 500;
                hit = sequentialTest(arm(n, c1), arm(n, c2)).is_significant;
            }
            if (hit) found++;
        }
        expect(found).toBeGreaterThanOrEqual(45);
    });
});

describe('chance to beat control', () => {
    it('is 50% for identical data and moves with the evidence', () => {
        expect(chanceToBeatControl(arm(1000, 50), arm(1000, 50))).toBeCloseTo(0.5, 5);
        expect(chanceToBeatControl(arm(2400, 120), arm(2400, 175))).toBeGreaterThan(0.99);
        expect(chanceToBeatControl(arm(2400, 175), arm(2400, 120))).toBeLessThan(0.01);
        const small = chanceToBeatControl(arm(100, 5), arm(100, 8));
        expect(small).toBeGreaterThan(0.5);
        expect(small).toBeLessThan(0.9);
    });
    it('matches a Monte Carlo estimate from the Beta posteriors', () => {
        const rand = rng(3);
        // Beta(a, b) draws via sums of exponentials (a, b are integers here).
        const gamma = (k: number) => { let s = 0; for (let i = 0; i < k; i++) s -= Math.log(rand()); return s; };
        const beta = (a: number, b: number) => { const x = gamma(a); return x / (x + gamma(b)); };
        let wins = 0; const N = 20000;
        for (let i = 0; i < N; i++) if (beta(1 + 30, 1 + 470) > beta(1 + 20, 1 + 480)) wins++;
        expect(Math.abs(chanceToBeatControl(arm(500, 20), arm(500, 30)) - wins / N)).toBeLessThan(0.02);
    });
    it('is shown only once both arms have 100 visitors', () => {
        expect(formatChance(0.9, 99, 500)).toBe('-');
        expect(formatChance(0.87345, 100, 100)).toBe('87.3%');
        expect(formatChance(0.99991, 500, 500)).toBe('>99.9%');
        expect(formatChance(0.00001, 500, 500)).toBe('<0.1%');
    });
});

describe('live stats use the sequential verdict', () => {
    it('marks a variant ahead only when the sequential test agrees', () => {
        const variations = [{ id: 'c', name: 'Control', is_control: true, url: null }, { id: 'b', name: 'B', is_control: false, url: null }];
        const goals = [{ id: 'g', name: 'Buy', type: 'click', selector: '#buy', is_primary: true }];
        const live = (cv: number, bv: number) => buildLiveStats(variations as never, goals as never, {
            visitors: [{ variation_id: 'c', users: 1200 }, { variation_id: 'b', users: 1200 }],
            byType: [], daily: [],
            goals: [{ goal_id: 'g', variation_id: 'c', users: cv, events: cv }, { goal_id: 'g', variation_id: 'b', users: bv, events: bv }],
        } as never);
        const weak = live(60, 84).goals[0];
        expect(weak.arms.find((a) => a.variation_id === 'b')!.significant).toBe(false);
        expect(weak.status).toBe('Too early to call');
        expect(weak.arms.find((a) => a.variation_id === 'b')!.chance_to_beat).toBeGreaterThan(0.95);
        const strong = live(60, 110).goals[0];
        expect(strong.status).toBe('B is ahead');
    });
});
