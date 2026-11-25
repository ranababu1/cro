import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { calculateConfidenceInterval } from '@/lib/statistics';
import { sequentialTest } from '@/lib/sequential';
import { CAPABILITIES, HOME_FAQ, PLAN_SUMMARY, STEPS, WORKED_EXAMPLE } from '@/lib/site/home';
import { FREE_MONTHLY_VISITORS, GROWTH_MONTHLY_VISITORS, STARTER_MONTHLY_VISITORS } from '@/lib/plans';
import { PLAN_PRICES_USD } from '@/lib/billing/config';

const home = fs.readFileSync('app/page.tsx', 'utf8');
const content = fs.readFileSync('lib/site/home.ts', 'utf8');
const previews = fs.readFileSync('app/components/site/Previews.tsx', 'utf8');
const arm = (n: number, c: number) => ({ total_users: n, conversions: c, conversion_rate: c / n });

describe('homepage', () => {
    it('leads with the brief headline, supporting copy and CTAs', () => {
        expect(home).toContain('Better decisions.<br />Backed by experiments.');
        expect(home).toContain('Run A/B tests, understand your audience and improve your product without expensive experimentation platforms.');
        expect(home).toMatch(/href="\/signin"[^>]*>Start experimenting </);
        expect(home).toContain('>Explore features<');
        expect(home).toContain('title="Your next experiment starts here."');
        expect(home).toContain('label="Start experimenting for free"');
        expect(home).toContain('Improve what your customers experience.');
        expect(home).toContain('Build experimentation into your product.');
    });

    it('keeps AI-powered positioning when AI is switched on', () => {
        expect(home).toContain("{aiLive ? 'AI-POWERED A/B TESTING'");
        expect(home).toContain("const HOME_TITLE_AI = 'freeabtest.com: AI-powered A/B testing platform';");
        expect(home).toMatch(/HOME_DESCRIPTION_AI = '[^']*AI-powered A\/B testing/);
    });

    it('has every brief section in order', () => {
        const ids = ['hero-title', 'audiences-title', 'id="capabilities"', 'id="how-it-works"', 'id="preview"', 'id="marketers"', 'id="developers"', 'id="statistics"', 'id="pricing"', 'id="faq"', 'Your next experiment starts here.'];
        const pos = ids.map((i) => home.indexOf(i));
        for (const [i, p] of pos.entries()) expect(p, ids[i]).toBeGreaterThan(-1);
        expect([...pos].sort((a, b) => a - b)).toEqual(pos);
    });

    it('covers the eight capability groups, seven steps and the eight FAQ questions', () => {
        expect(CAPABILITIES.map((c) => c.title)).toEqual(['Experiment management', 'Traffic allocation', 'Deterministic assignment', 'Conversion tracking', 'Statistical analysis', 'Experiment reporting', 'Developer integration', 'Privacy and security']);
        expect(STEPS).toHaveLength(7);
        expect(HOME_FAQ.map((f) => f.q)).toEqual(['What is A/B testing?', 'How does FreeABTest work?', 'Is FreeABTest free?', 'Do I need coding knowledge?', 'How does visitor assignment work?', 'How is statistical significance calculated?', 'How do I integrate the JavaScript SDK?', 'Can I use the REST API?']);
    });

    it('labels every product mockup as example data', () => {
        expect(home.match(/<SampleDataFrame/g)?.length).toBe((home.match(/Preview \/>/g) ?? []).length);
        expect(fs.readFileSync('app/components/site/Blocks.tsx', 'utf8')).toContain("label = 'Example data'");
    });

    it('worked example matches the statistics code: significant at 4,800 each, not yet at 3,000', () => {
        const { control: c, variant: v, early } = WORKED_EXAMPLE;
        expect(c.conversions / c.visitors).toBeCloseTo(early.controlConversions / early.visitors, 10);
        expect(v.conversions / v.visitors).toBeCloseTo(early.variantConversions / early.visitors, 10);
        expect(sequentialTest(arm(c.visitors, c.conversions), arm(v.visitors, v.conversions)).is_significant).toBe(true);
        expect(sequentialTest(arm(early.visitors, early.controlConversions), arm(early.visitors, early.variantConversions)).is_significant).toBe(false);
        const ci = calculateConfidenceInterval(c.conversions, c.visitors);
        expect(ci.lower).toBeGreaterThan(0.04); expect(ci.upper).toBeLessThan(0.06);
    });

    it('pricing summary uses the enforced numbers and published prices', () => {
        const txt = JSON.stringify(PLAN_SUMMARY);
        for (const n of [FREE_MONTHLY_VISITORS, STARTER_MONTHLY_VISITORS, GROWTH_MONTHLY_VISITORS]) expect(txt).toContain(n.toLocaleString('en-US'));
        for (const p of [PLAN_PRICES_USD.starter.monthly, PLAN_PRICES_USD.growth.monthly]) expect(txt).toContain(`$${p}`);
        expect(PLAN_SUMMARY.map((p) => p.name)).toEqual(['Free', 'Starter', 'Growth', 'Enterprise']);
    });

    it('makes no claims the app does not support', () => {
        for (const src of [home, content, previews]) {
            expect(src).not.toMatch(/z-tests? (decides?|picks)|two-proportion z-test|Bayesian|session recording|npm install|guarantee|unlimited visitors|free trial|—/i);
            expect(src).not.toMatch(/seamless|effortless|unlock|supercharge|leverage|elevate|empower|cutting-edge|game-changer|revolutioni[sz]e|delve/i);
        }
        expect(home).not.toMatch(/Blobs|font-hand|bg-clip-text/);
    });
});
