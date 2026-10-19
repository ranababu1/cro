import { describe, it, expect } from 'vitest';
import { assignUserToVariation, hashUserToVariation, validateVariationWeights, isExperimentEligible } from '@/lib/assignment';
import type { Variation } from '@/lib/types';

function v(id: string, weight: number, is_control = false): Variation {
    return { id, experiment_id: 'exp_1', name: id, description: null, url: null, weight, is_control, paused: false, changes: null, combo: null, created_at: '' };
}

describe('hashUserToVariation', () => {
    it('is deterministic', () => {
        expect(hashUserToVariation('user-1', 'exp_1')).toBe(hashUserToVariation('user-1', 'exp_1'));
    });

    it('returns values in [0, 1]', () => {
        for (let i = 0; i < 1000; i++) {
            const h = hashUserToVariation(`u${i}`, 'exp_1');
            expect(h).toBeGreaterThanOrEqual(0);
            expect(h).toBeLessThanOrEqual(1);
        }
    });

    it('depends on the experiment id', () => {
        const same = Array.from({ length: 200 }, (_, i) => hashUserToVariation(`u${i}`, 'a') === hashUserToVariation(`u${i}`, 'b'));
        expect(same.filter(Boolean).length).toBe(0);
    });
});

describe('assignUserToVariation', () => {
    const variations = [v('control', 50, true), v('b', 50)];

    it('gives the same visitor the same variation every time', () => {
        for (let i = 0; i < 100; i++) {
            const first = assignUserToVariation(`u${i}`, 'exp_1', 100, variations);
            const second = assignUserToVariation(`u${i}`, 'exp_1', 100, variations);
            expect(second?.id).toBe(first?.id);
        }
    });

    it('splits traffic close to the configured weights', () => {
        const weighted = [v('control', 70, true), v('b', 20), v('c', 10)];
        const counts: Record<string, number> = { control: 0, b: 0, c: 0 };
        const n = 30000;
        for (let i = 0; i < n; i++) counts[assignUserToVariation(`visitor-${i}`, 'exp_split', 100, weighted)!.id]++;
        expect(counts.control / n).toBeCloseTo(0.7, 1);
        expect(Math.abs(counts.b / n - 0.2)).toBeLessThan(0.015);
        expect(Math.abs(counts.c / n - 0.1)).toBeLessThan(0.015);
    });

    it('respects traffic allocation', () => {
        const n = 20000;
        let included = 0;
        for (let i = 0; i < n; i++) if (assignUserToVariation(`visitor-${i}`, 'exp_t', 30, variations)) included++;
        expect(Math.abs(included / n - 0.3)).toBeLessThan(0.015);
    });

    it('excludes everyone at 0% and includes everyone at 100%', () => {
        for (let i = 0; i < 500; i++) {
            expect(assignUserToVariation(`u${i}`, 'exp_1', 0, variations)).toBeNull();
            expect(assignUserToVariation(`u${i}`, 'exp_1', 100, variations)).not.toBeNull();
        }
    });

    it('keeps visitors in their variation when allocation grows', () => {
        for (let i = 0; i < 2000; i++) {
            const small = assignUserToVariation(`u${i}`, 'exp_grow', 20, variations);
            if (small) expect(assignUserToVariation(`u${i}`, 'exp_grow', 80, variations)?.id).toBe(small.id);
        }
    });

    it('throws when all weights are zero', () => {
        expect(() => assignUserToVariation('u', 'e', 100, [v('a', 0), v('b', 0)])).toThrow();
    });
});

describe('validateVariationWeights', () => {
    it('accepts weights summing to 100', () => {
        expect(validateVariationWeights([{ weight: 33.33 }, { weight: 33.33 }, { weight: 33.34 }])).toBe(true);
    });
    it('rejects other sums', () => {
        expect(validateVariationWeights([{ weight: 50 }, { weight: 40 }])).toBe(false);
    });
});

describe('isExperimentEligible', () => {
    it('only running experiments with traffic are eligible', () => {
        expect(isExperimentEligible('running', 50)).toBe(true);
        expect(isExperimentEligible('running', 0)).toBe(false);
        expect(isExperimentEligible('paused', 100)).toBe(false);
        expect(isExperimentEligible('draft', 100)).toBe(false);
    });
});
