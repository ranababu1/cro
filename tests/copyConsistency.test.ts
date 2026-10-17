import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkAllocation } from '@/lib/allocation';

const read = (p: string) => readFileSync(p, 'utf8');

describe('public copy matches the code', () => {
    it('significance: the verdict is the best variant against the control everywhere', () => {
        const results = read('lib/docs/content/results.ts');
        const pricing = read('app/pricing/page.tsx');
        const intro = read('lib/docs/content/introduction.ts');
        // lib/results.ts tests only the best variant against the control.
        expect(read('lib/results.ts')).toMatch(/const best = others\.reduce/);
        for (const s of [results, pricing, intro]) expect(s).toMatch(/best variant against the control/);
        for (const s of [pricing, intro]) expect(s).not.toMatch(/z-test of each variant against the control|compares each variation with the control: conversion rate, lift, a 95% interval and a p-value/);
    });
    it('weights: running tests can change the split, and the docs say so', () => {
        const cur = [{ id: 'c', is_control: true }, { id: 'a', is_control: false }];
        expect(checkAllocation(cur, [{ id: 'c', weight: 0, paused: false }, { id: 'a', weight: 100, paused: false }]).ok).toBe(true);
        const winners = read('lib/docs/content/winners.ts');
        expect(winners).not.toMatch(/Weights cannot be changed/);
        expect(winners).toMatch(/change the traffic split on a running test/);
        expect(read('app/roadmap/page.tsx')).toMatch(/Change the split, pause a variation or add goals/);
    });
});
