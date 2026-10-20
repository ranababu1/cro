import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
    FREE_MONTHLY_VISITORS, FREE_DAILY_VISITORS, FREE_RUNNING_EXPERIMENTS, FREE_MONTHLY_TESTS, FREE_MAX_GOALS, FREE_DOMAINS, FREE_PROJECTS, FREE_MAX_VARIATIONS, PAID_MAX_VARIATIONS,
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
        expect([FREE_MONTHLY_VISITORS, FREE_DAILY_VISITORS, FREE_RUNNING_EXPERIMENTS, FREE_MONTHLY_TESTS, FREE_MAX_GOALS, FREE_DOMAINS, FREE_PROJECTS, FREE_MAX_VARIATIONS, PAID_MAX_VARIATIONS])
            .toEqual([10_000, 300, 1, 1, 1, 1, 1, 1, 50]);
        for (const src of [pricing, cards, docs]) {
            expect(src).toContain(fmt(FREE_MONTHLY_VISITORS));
            expect(src).toContain(String(FREE_DAILY_VISITORS));
        }
        expect(pricing).toContain(`'Control plus ${FREE_MAX_VARIATIONS} (A/B only)'`);
        expect(pricing).toContain(`Control plus up to ${PAID_MAX_VARIATIONS}`);
        expect(pricing).toMatch(/1 running test at a time, 1 new test a month, 1 page URL per test, 1 goal per test \(a click on a CSS selector\), 1 project, 1 domain/);
    });

    it('the Free card lists every free limit in plain numbers, with no footnotes', () => {
        const free = cards.slice(cards.indexOf('Free: ['), cards.indexOf('Starter: ['));
        for (const item of [
            `${fmt(FREE_MONTHLY_VISITORS)} tested visitors a month, up to ${FREE_DAILY_VISITORS} a day`,
            `${FREE_RUNNING_EXPERIMENTS} running test at a time`,
            `${FREE_MONTHLY_TESTS} new test a month`,
            '1 page URL per test',
            `${FREE_MAX_GOALS} goal per test: a click on a CSS selector`,
            `${FREE_PROJECTS} project`,
            `${FREE_DOMAINS} domain`,
            `A/B only: control plus ${FREE_MAX_VARIATIONS} variation`,
        ]) expect(free).toContain(`'${item}'`);
        expect(free).not.toContain('*');
        expect(cards).toContain('Free forever, no card');
    });

    it('never says unlimited, all features free or free trial about Free, and no longer mentions the lifetime cap', () => {
        const blog = fs.readdirSync('content/blog').map((f) => read(`content/blog/${f}`)).join('\n');
        // The Free card, the Free column of the comparison table and the free-plan FAQ answers.
        const freeColumn = [...pricing.matchAll(/^    \['[^']*(?:\\'[^']*)*', '([^']*)'/gm)].map((m) => m[1]);
        const freeFaqs = pricing.split('\n').filter((l) => /q: '(Is the free plan|How many tests can I run on the free plan|What happens when I hit a limit)/.test(l));
        expect(freeColumn.length).toBeGreaterThan(10);
        expect(freeFaqs).toHaveLength(3);
        const freeCopy = [cards.slice(cards.indexOf('Free: ['), cards.indexOf('Starter: [')), ...freeColumn, ...freeFaqs];
        for (const line of freeCopy) expect(line).not.toMatch(/unlimited|all features free|free trial/i);
        for (const src of [pricing, cards, docs, home, blog]) {
            expect(src).not.toMatch(/10 tests (in total|over the life|lifetime|total)|tests over the life of|lifetime tests/i);
            expect(src).not.toMatch(/all features free/i);
        }
        expect(pricing).toContain("q: 'What happens when I hit a limit?'");
    });

    it('drops old variant counts and unplanned promises', () => {
        for (const src of [pricing, cards, roadmap, home, docs]) {
            expect(src).not.toMatch(/\b26\b(?! 26)|2 to 26|control \+ 25|up to 10 on paid|allow up to 10\b/);
            // Sequential testing is shipped (lib/sequential.ts); a Bayesian engine is not, so never claim one.
            expect(src).not.toMatch(/Bayesian/i);
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
        expect(tags.find((t) => t.name === 'Session recordings')).toBeTruthy();
        // Revenue goals shipped: no longer coming soon, still named on the public roadmap phase.
        expect(tags.find((t) => t.name === 'Revenue goals')).toBeFalsy();
        expect(roadmap).toContain("'Revenue goals'");
    });
});
