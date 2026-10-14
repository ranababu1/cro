import { describe, it, expect } from 'vitest';
import { evenWeights, redistributeWeights, clampWeight, ensureSum100 } from '@/lib/weights';

const sum = (w: number[]) => w.reduce((a, b) => a + b, 0);

describe('evenWeights', () => {
    it('always sums to 100', () => {
        for (const n of [1, 2, 3, 4, 5, 10]) {
            const w = evenWeights(n);
            expect(w).toHaveLength(n);
            expect(sum(w)).toBe(100);
        }
    });
});

describe('redistributeWeights', () => {
    it('with two variations, the other gets the remainder', () => {
        expect(redistributeWeights([50, 50], 0, 85)).toEqual([85, 15]);
        expect(redistributeWeights([50, 50], 1, 15)).toEqual([85, 15]);
        expect(redistributeWeights([50, 50], 0, 100)).toEqual([100, 0]);
        expect(redistributeWeights([50, 50], 0, 0)).toEqual([0, 100]);
    });

    it('clamps to 0-100 integers', () => {
        expect(redistributeWeights([50, 50], 0, 120)).toEqual([100, 0]);
        expect(redistributeWeights([50, 50], 0, -5)).toEqual([0, 100]);
        expect(redistributeWeights([50, 50], 0, 33.6)).toEqual([34, 66]);
    });

    it('prefers adjusting the last non-edited variation when possible', () => {
        // Keep middle at 20; last absorbs.
        expect(redistributeWeights([40, 20, 40], 0, 50)).toEqual([50, 20, 30]);
    });

    it('falls back to proportional when last cannot absorb', () => {
        // edited=90, kept middle=30 would need last=-20 -> proportional among others
        const next = redistributeWeights([40, 30, 30], 0, 90);
        expect(sum(next)).toBe(100);
        expect(next[0]).toBe(90);
        expect(next[1] + next[2]).toBe(10);
        expect(next.every((w) => w >= 0 && w <= 100)).toBe(true);
    });

    it('never leaves a sum other than 100 for normal edits', () => {
        const starts = [
            [50, 50],
            [34, 33, 33],
            [25, 25, 25, 25],
            [10, 20, 30, 40],
        ];
        for (const start of starts) {
            for (let i = 0; i < start.length; i++) {
                for (const v of [0, 1, 15, 33, 50, 67, 85, 99, 100, 200, -10]) {
                    const next = redistributeWeights(start, i, v);
                    expect(sum(next), `${start} edit ${i}=${v} -> ${next}`).toBe(100);
                    expect(next.every((w) => Number.isInteger(w) && w >= 0 && w <= 100)).toBe(true);
                }
            }
        }
    });
});

describe('ensureSum100 / clampWeight', () => {
    it('fixes drift', () => {
        expect(sum(ensureSum100([34, 33, 32]))).toBe(100);
        expect(clampWeight(NaN)).toBe(0);
    });
});
