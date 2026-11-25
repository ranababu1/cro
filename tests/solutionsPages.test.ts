import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { FREE_MONTHLY_VISITORS } from '@/lib/plans';
import { PLAN_PRICES_USD } from '@/lib/billing/config';
import { SOLUTIONS } from '@/lib/site/solutions';
import { FEATURE_GROUPS } from '@/lib/site/product';
import { FOOTER_COLUMNS, NAV_MENUS } from '@/app/components/site/nav';
import { checkHref, hrefsIn } from './helpers/links';

const read = (f: string) => fs.readFileSync(f, 'utf8');
const SLUGS = ['marketing', 'saas', 'ecommerce', 'startups'] as const;
const content = read('lib/site/solutions.ts');
const template = read('app/solutions/SolutionPage.tsx');
const hub = read('app/solutions/page.tsx');
const results = read('lib/docs/content/results.ts');
const planOf = (name: string) => FEATURE_GROUPS.flatMap((g) => g.features).find((f) => f.name === name)?.plan;

describe('solutions pages', () => {
    it('has a hub and the four brief audience pages, each with unique metadata', () => {
        expect(SOLUTIONS.map((s) => s.slug)).toEqual([...SLUGS]);
        expect(hub).toContain("path: '/solutions'");
        for (const slug of SLUGS) {
            const src = read(`app/solutions/${slug}/page.tsx`);
            expect(src).toContain(`solutionMetadata('${slug}')`);
            expect(src).toContain(`<SolutionPage slug="${slug}" />`);
        }
        expect(template).toContain('path: `/solutions/${slug}`');
        expect(template).toMatch(/<Breadcrumbs items=/);
        expect(new Set(SOLUTIONS.map((s) => s.metaTitle)).size).toBe(4);
        expect(new Set(SOLUTIONS.map((s) => s.metaDescription)).size).toBe(4);
        for (const s of SOLUTIONS) expect(s.metaDescription.length, s.slug).toBeGreaterThan(80);
    });

    it('each page has a real workflow, test ideas, goals and plan notes', () => {
        for (const s of SOLUTIONS) {
            expect(s.challenges.length, s.slug).toBe(3);
            expect(s.workflow.steps.length, s.slug).toBeGreaterThanOrEqual(5);
            expect(s.workflow.context, s.slug).toContain('Example plan, not a customer story.');
            expect(s.ideas.length, s.slug).toBeGreaterThanOrEqual(4);
            expect(s.goals.length, s.slug).toBeGreaterThanOrEqual(2);
            expect(s.planNote[0].plan, s.slug).toBe('Free');
        }
        expect(template).toContain('s.workflow.steps.map');
        expect(template).toContain('<PlanBadge plan={idea.plan} />');
    });

    it('plan notes agree with the features page and the pricing page', () => {
        const same: Record<string, string> = { 'Split URL test': 'A/B and split URL tests', 'Visual editor': 'Multi-page and multivariate tests', 'Popups and calls to action': 'Popups and calls to action', Surveys: 'Surveys', 'Server-side assignment': 'Server-side assignment', Funnels: 'Funnels', Webhooks: 'Webhooks', 'Revenue goal': 'Revenue goals', 'Results by segment': 'Results by segment', Heatmaps: 'Heatmaps and error tracking', 'Auto-shift traffic to the winner': 'Auto-shift traffic to the winner', 'Test planner': 'Test planner', 'Roll out the winner': 'Roll out the winner', 'Click goal': 'Click goals', 'Form submit goal': 'Form, page visit and custom event goals' };
        for (const s of SOLUTIONS) for (const i of s.ideas) {
            const f = same[i.feature];
            if (f) expect(i.plan, `${s.slug}: ${i.feature}`).toBe(planOf(f));
        }
        const goals = SOLUTIONS.flatMap((s) => s.goals);
        for (const g of goals) {
            if (/click goal/i.test(g.how)) expect(g.plan, g.name).toBe('Every plan');
            if (/revenue|custom event|page visit|form submit|from your server|segment/i.test(g.how)) expect(g.plan, g.name).toBe('Paid plans');
        }
        const notes = JSON.stringify(SOLUTIONS.map((s) => s.planNote));
        expect(notes).toContain(`$${PLAN_PRICES_USD.starter.monthly} a month`);
        expect(notes).toContain(`$${PLAN_PRICES_USD.growth.monthly} a month`);
        expect(notes).toContain(FREE_MONTHLY_VISITORS.toLocaleString('en-US'));
    });

    it('the startup sample size matches the docs table', () => {
        const row = results.match(/\['5%', '([\d,]+)', '([\d,]+)'/);
        expect(row?.[2]).toBe('8,159');
        expect(JSON.stringify(SOLUTIONS.find((s) => s.slug === 'startups'))).toContain(`${row?.[2]} visitors per version`);
    });

    it('every link goes to a page or anchor that exists', () => {
        const hrefs = [content, template, hub, ...SLUGS.map((s) => read(`app/solutions/${s}/page.tsx`))].flatMap(hrefsIn);
        const dynamic = SLUGS.map((s) => `/solutions/${s}`);
        const errors = [...hrefs, ...dynamic].map(checkHref).filter(Boolean);
        expect(errors).toEqual([]);
        expect(hrefs.length).toBeGreaterThanOrEqual(25);
    });

    it('menus, footer, homepage and sitemap point at the solutions pages', () => {
        const items = NAV_MENUS.find((m) => m.label === 'Solutions')!.groups.flatMap((g) => g.items.map((i) => i.href));
        for (const slug of SLUGS) expect(items).toContain(`/solutions/${slug}`);
        expect(items).toContain('/solutions');
        expect(FOOTER_COLUMNS.flatMap((c) => c.links.map((l) => l.href))).toContain('/solutions');
        const home = read('app/page.tsx');
        expect(home).toContain('href="/solutions/marketing"');
        expect(home).not.toContain('href="#marketers"');
        const sitemap = read('app/sitemap.ts');
        for (const p of ['/solutions', ...SLUGS.map((s) => `/solutions/${s}`)]) expect(sitemap).toContain(`'${p}'`);
    });

    it('copy stays honest and plain, with no store platform integrations claimed', () => {
        for (const src of [content, template, hub]) {
            expect(src).not.toMatch(/shopify|woocommerce|magento|bigcommerce|stripe|segment\.com|mixpanel|amplitude/i);
            expect(src).not.toMatch(/z-tests? (decides?|picks)|two-proportion z-test|Bayesian|npm install|guarantee|unlimited visitors|free trial|case study|—/i);
            expect(src).not.toMatch(/seamless|effortless|unlock|supercharge|leverage|elevate|empower|cutting-edge|game-changer|revolutioni[sz]e|delve|robust|world-class|best-in-class/i);
        }
    });
});
