import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkAllocation } from '@/lib/allocation';

const read = (p: string) => readFileSync(p, 'utf8');

describe('public copy matches the code', () => {
    it('significance: the verdict is the peeking-safe sequential test everywhere', () => {
        const results = read('lib/docs/content/results.ts');
        const pricing = read('app/pricing/page.tsx');
        const intro = read('lib/docs/content/introduction.ts');
        // lib/results.ts runs the sequential test for every variant and picks the winner from it.
        const engine = read('lib/results.ts');
        expect(engine).toMatch(/sequentialTest\(control, v, others\.length\)/);
        expect(engine).toMatch(/v\.sequential_significant && v\.conversion_rate > control\.conversion_rate/);
        for (const s of [results, pricing, intro]) expect(s).toMatch(/sequential/i);
        for (const s of [results, pricing, intro]) expect(s).toMatch(/chance to beat (the )?control/i);
        for (const s of [pricing, intro]) expect(s).not.toMatch(/two-proportion z-test/);
    });
    it('weights: running tests can change the split, and the docs say so', () => {
        const cur = [{ id: 'c', is_control: true }, { id: 'a', is_control: false }];
        expect(checkAllocation(cur, [{ id: 'c', weight: 0, paused: false }, { id: 'a', weight: 100, paused: false }]).ok).toBe(true);
        const winners = read('lib/docs/content/winners.ts');
        expect(winners).not.toMatch(/Weights cannot be changed/);
        expect(winners).toMatch(/change the traffic split on a running test/);
    });
});
