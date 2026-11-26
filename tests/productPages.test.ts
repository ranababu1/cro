import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { sequentialTest } from '@/lib/sequential';
import { WORKED_EXAMPLE } from '@/lib/site/home';
import { CAPABILITIES } from '@/lib/site/home';
import { ANALYTICS_EXTRAS, FEATURE_GROUPS, LIFECYCLE, NOT_YET, PRODUCT_PAGES } from '@/lib/site/product';
import { NAV_MENUS, FOOTER_COLUMNS } from '@/app/components/site/nav';
import { checkHref, hrefsIn } from './helpers/links';

const read = (f: string) => fs.readFileSync(f, 'utf8');
const PAGES = { '/product': 'app/product/page.tsx', '/features': 'app/features/page.tsx', '/how-it-works': 'app/how-it-works/page.tsx', '/experiment-analytics': 'app/experiment-analytics/page.tsx' };
const content = read('lib/site/product.ts');
const pricing = read('app/pricing/page.tsx');
const allFeatures = FEATURE_GROUPS.flatMap((g) => g.features);
const feature = (name: string) => allFeatures.find((f) => f.name === name);

describe('product pages', () => {
    it('each page exists with its own title, description, canonical, breadcrumbs and the product sub-nav', () => {
        const titles = new Set<string>();
        for (const [path, file] of Object.entries(PAGES)) {
            const src = read(file);
            expect(src, file).toContain(`path: '${path}'`);
            expect(src, file).toContain('<SitePage');
            expect(src, file).toMatch(/<Breadcrumbs items=/);
            expect(src, file).toContain(`<ProductSubnav current="${path}" />`);
            expect(src, file).toMatch(/<PageHero /);
            const title = src.match(/title: '([^']+)'/)?.[1];
            expect(title, file).toBeTruthy(); titles.add(title!);
            expect(src.match(/description: '([^']+)'/)?.[1].length, file).toBeGreaterThan(80);
        }
        expect(titles.size).toBe(4);
        expect(PRODUCT_PAGES.map((p) => p.href)).toEqual(Object.keys(PAGES));
    });

    it('every link on the product pages and in their content goes to a page or anchor that exists', () => {
        const hrefs = [content, ...Object.values(PAGES).map(read)].flatMap(hrefsIn);
        expect(hrefs.length).toBeGreaterThan(40);
        const errors = hrefs.map(checkHref).filter(Boolean);
        expect(errors).toEqual([]);
    });

    it('menus, footer, homepage and sitemap point at the new pages', () => {
        const product = NAV_MENUS.find((m) => m.label === 'Product')!.groups.flatMap((g) => g.items.map((i) => i.href));
        for (const p of Object.keys(PAGES)) expect(product).toContain(p);
        const footer = FOOTER_COLUMNS.find((c) => c.heading === 'Product')!.links.map((l) => l.href);
        for (const p of Object.keys(PAGES)) expect(footer).toContain(p);
        const home = read('app/page.tsx');
        expect(home).toMatch(/href="\/features"[^>]*>Explore features</);
        expect(home).toContain('href="/how-it-works"');
        expect(home).not.toContain('/pricing#compare');
        for (const c of CAPABILITIES) expect(c.href.startsWith('/features#'), c.title).toBe(true);
        const sitemap = read('app/sitemap.ts');
        for (const p of Object.keys(PAGES)) expect(sitemap).toContain(`'${p}'`);
    });

    it('features explain how, benefit, limits and plan for each capability', () => {
        expect(FEATURE_GROUPS).toHaveLength(9);
        expect(read(PAGES['/product'])).toContain('Nine areas');
        expect(new Set(FEATURE_GROUPS.map((g) => g.id)).size).toBe(FEATURE_GROUPS.length);
        for (const f of allFeatures) for (const k of ['what', 'how', 'benefit', 'limits'] as const) expect(f[k].length, `${f.name} ${k}`).toBeGreaterThan(15);
    });

    it('plan notes match the pricing page', () => {
        for (const n of ['Multi-page and multivariate tests', 'Auto-shift traffic to the winner']) expect(feature(n)?.plan, n).toBe('Growth and above');
        for (const n of ['Funnels', 'Results by segment', 'Revenue goals', 'Webhooks', 'Surveys', 'Popups and calls to action', 'Heatmaps and error tracking', 'Form, page visit and custom event goals', 'Team roles and audit log']) expect(feature(n)?.plan, n).toBe('Paid plans');
        for (const n of ['A/B and split URL tests', 'Click goals', 'Sequential significance', 'Sample ratio check', 'CSV download and share links', 'REST API', 'Server-side assignment', 'Test planner', 'Roll out the winner']) expect(feature(n)?.plan, n).toBe('Every plan');
        for (const a of ANALYTICS_EXTRAS) expect(a.plan, a.title).toBe(['CSV download', 'Share links'].includes(a.title) ? 'Every plan' : 'Paid plans');
        // Every free-tier item on the pricing page is free here too, and paid ones are never shown as free.
        const tier = (needle: RegExp) => Number(pricing.match(new RegExp(`name: '[^']*${needle.source}[^']*', tier: (\\d)`, 'i'))?.[1]);
        expect(tier(/Auto-shift/)).toBe(2); expect(tier(/Multi-page and multivariate/)).toBe(2); expect(tier(/Funnels on paid/)).toBe(1); expect(tier(/Shareable results/)).toBe(0);
    });

    it('lists unbuilt features only as not available, matching coming soon on pricing', () => {
        const soon = [...pricing.slice(pricing.indexOf('const comingSoon')).matchAll(/\{ name: '([^']+)', tier: \d \}/g)].map((m) => m[1]);
        expect(NOT_YET).toEqual(soon);
        for (const f of allFeatures) for (const n of NOT_YET) expect(JSON.stringify(f).toLowerCase()).not.toContain(n.toLowerCase());
        expect(read(PAGES['/features'])).toContain('Not available yet');
    });

    it('lifecycle follows the brief, and its example matches the statistics code', () => {
        expect(LIFECYCLE.map((s) => s.title)).toEqual(['Create an experiment', 'Define variants and traffic', 'Integrate the SDK or configure tracking', 'Assign visitors consistently', 'Track conversions', 'Analyse the results', 'Make the decision']);
        const { control: c, variant: v } = WORKED_EXAMPLE;
        const seq = sequentialTest({ total_users: c.visitors, conversions: c.conversions, conversion_rate: c.conversions / c.visitors }, { total_users: v.visitors, conversions: v.conversions, conversion_rate: v.conversions / v.visitors }, 1);
        const analyse = LIFECYCLE.find((s) => s.id === 'analyse')!.example;
        expect(analyse).toContain(`sequential p-value of ${seq.p_value.toFixed(3)}`);
        expect(analyse).toContain(`${(v.conversions / v.visitors * 100).toFixed(1)}% against ${(c.conversions / c.visitors * 100).toFixed(1)}%`);
        expect(analyse).toContain(c.visitors.toLocaleString('en-US'));
    });

    it('mockups are labelled and copy stays honest and plain', () => {
        for (const f of ['app/product/page.tsx', 'app/experiment-analytics/page.tsx']) {
            const src = read(f);
            const previews = (src.match(/<(HeroPreview|DashboardPreview) \/>/g) ?? []).length;
            expect(previews, f).toBeGreaterThan(0);
            expect((src.match(/<SampleDataFrame/g) ?? []).length, f).toBe(previews);
        }
        for (const src of [content, ...Object.values(PAGES).map(read)]) {
            expect(src).not.toMatch(/z-tests? (decides?|picks)|two-proportion z-test|Bayesian|npm install|guarantee|unlimited visitors|free trial|—/i);
            expect(src).not.toMatch(/seamless|effortless|unlock|supercharge|leverage|elevate|empower|cutting-edge|game-changer|revolutioni[sz]e|delve|robust|world-class|best-in-class/i);
        }
    });
});
