import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
    FREE_MONTHLY_VISITORS, FREE_DAILY_VISITORS, FREE_RUNNING_EXPERIMENTS, FREE_LIFETIME_EXPERIMENTS, FREE_PROJECTS, FREE_MAX_VARIATIONS, PAID_MAX_VARIATIONS,
} from '@/lib/plans';

const read = (p: string) => fs.readFileSync(p, 'utf8');
const pricing = read('app/pricing/page.tsx');
const cards = read('app/pricing/BillingCards.tsx');
const roadmap = read('app/roadmap/page.tsx');
const home = read('app/page.tsx');
const docs = fs.readdirSync('lib/docs/content').map((f) => read(`lib/docs/content/${f}`)).join('\n');
const fmt = (n: number) => n.toLocaleString('en-US');

describe('public copy matches what the app enforces', () => {
    it('free numbers on pricing, cards and docs come from lib/plans.ts', () => {
        expect([FREE_MONTHLY_VISITORS, FREE_DAILY_VISITORS, FREE_RUNNING_EXPERIMENTS, FREE_LIFETIME_EXPERIMENTS, FREE_PROJECTS, FREE_MAX_VARIATIONS, PAID_MAX_VARIATIONS])
            .toEqual([10_000, 300, 1, 10, 1, 1, 50]);
        for (const src of [pricing, cards, docs]) {
            expect(src).toContain(fmt(FREE_MONTHLY_VISITORS));
            expect(src).toContain(String(FREE_DAILY_VISITORS));
        }
        expect(pricing).toContain(`'Control plus ${FREE_MAX_VARIATIONS} (A/B only)'`);
        expect(pricing).toContain(`Control plus up to ${PAID_MAX_VARIATIONS}`);
        expect(pricing).toMatch(/1 running test at a time, 10 tests in total, 1 project/);
    });

    it('drops old variant counts and unplanned promises', () => {
        for (const src of [pricing, cards, roadmap, home, docs]) {
            expect(src).not.toMatch(/\b26\b(?! 26)|2 to 26|control \+ 25|up to 10 on paid|allow up to 10\b/);
            expect(src).not.toMatch(/Bayesian|sequential/i);
            expect(src).not.toContain('—');
        }
        expect(pricing).not.toMatch(/email you at 80%/);
    });

    it('coming-soon tags point at roadmap phases that are not done', () => {
        const phases = [...roadmap.matchAll(/phase: 'Phase (\d)', name: '[^']+', status: '([^']+)'/g)].map((m) => ({ n: Number(m[1]), status: m[2] }));
        expect(phases.find((p) => p.n === 1)?.status).toBe('Done');
        expect(phases.find((p) => p.n === 2)?.status).toBe('Done');
        const tags = [...pricing.matchAll(/\{ name: '([^']+)', p: (\d), tier: \d \}/g)].map((m) => ({ name: m[1], p: Number(m[2]) }));
        expect(tags.length).toBeGreaterThan(0);
        for (const t of tags) expect(phases.find((p) => p.n === t.p)?.status, t.name).not.toBe('Done');
        // Live features are not listed as coming soon.
        for (const live of ['targeting', 'Sample ratio', 'custom goals', 'Flicker-free']) expect(tags.some((t) => t.name.toLowerCase().includes(live.toLowerCase()))).toBe(false);
        expect(tags.find((t) => t.name === 'Revenue goals')).toBeTruthy();
        expect(roadmap).toContain("'Revenue goals'");
    });
});
