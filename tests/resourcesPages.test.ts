import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { GUIDE_SECTIONS, RESOURCE_LINKS, listablePost } from '@/lib/site/resources';
import { BILLING_QUESTIONS, FAQ_GROUPS, allFaqItems } from '@/lib/site/faq';
import { HOME_FAQ } from '@/lib/site/home';
import { RELEASES, featurePlan, itemPlan } from '@/lib/changelog';
import { FEATURE_GROUPS, NOT_YET } from '@/lib/site/product';
import { FOOTER_COLUMNS, NAV_MENUS } from '@/app/components/site/nav';
import { getAllPosts, getPost } from '@/lib/blog';
import { blockText, getDocPage } from '@/lib/docs';
import { PLAN_PRICES_USD } from '@/lib/billing/config';
import { GROWTH_MONTHLY_VISITORS, PLAN_RUNNING_EXPERIMENTS, STARTER_MONTHLY_VISITORS, STARTER_RUNNING_EXPERIMENTS, FREE_MONTHLY_TESTS, FREE_MAX_GOALS } from '@/lib/plans';
import { checkHref, hrefsIn } from './helpers/links';

const read = (f: string) => fs.readFileSync(f, 'utf8');
const PAGES = ['app/resources/page.tsx', 'app/guides/page.tsx', 'app/faq/page.tsx', 'app/changelog/page.tsx', 'app/blog/page.tsx'];
const DATA = ['lib/site/resources.ts', 'lib/site/faq.ts', 'lib/changelog.ts', 'content/changelog/releases.json'];
const pricing = read('app/pricing/page.tsx');
const pricingQuestions = [...pricing.slice(pricing.indexOf('const faqs'), pricing.indexOf('];', pricing.indexOf('const faqs'))).matchAll(/\{ q: '((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'"));
const fmt = (n: number) => n.toLocaleString('en-US');

describe('guides: a curated index of pages that exist', () => {
    it('every guide points to a real post, docs page or page, with no competitor-titled posts', () => {
        const refs = GUIDE_SECTIONS.flatMap((s) => s.guides);
        expect(refs.length).toBeGreaterThanOrEqual(12);
        for (const g of refs) {
            if (g.kind === 'blog') {
                const p = getPost(g.slug);
                expect(p, g.slug).toBeDefined();
                expect(p!.title).not.toMatch(/optimizely|google optimize|vwo|alternatives/i);
            } else if (g.kind === 'docs') expect(getDocPage(g.slug), g.slug).toBeDefined();
            else expect(checkHref(g.slug), g.slug).toBeNull();
            expect(g.note.length).toBeGreaterThan(20);
        }
        expect(new Set(refs.map((g) => g.slug)).size).toBe(refs.length);
    });
});

describe('FAQ: product questions, no billing duplicates', () => {
    it('reuses the homepage answers word for word', () => {
        const items = allFaqItems();
        // "Is FreeABTest free?" is a plan question, answered on the pricing page instead.
        for (const h of HOME_FAQ.filter((x) => x.q !== 'Is FreeABTest free?')) {
            const f = items.find((i) => i.q === h.q);
            expect(f, h.q).toBeDefined();
            expect(f!.a).toBe(h.a);
        }
    });

    it('no question is on both /faq and the pricing page, and pricing keeps billing questions only', () => {
        expect(pricingQuestions.length).toBeGreaterThanOrEqual(8);
        const faqQs = allFaqItems().map((i) => i.q);
        for (const q of faqQs) expect(pricingQuestions, q).not.toContain(q);
        expect(new Set(faqQs).size).toBe(faqQs.length);
        for (const q of ['How are visitors assigned to a variant?', 'Which statistics do you use?', 'What do I need to install?']) expect(pricingQuestions).not.toContain(q);
        // The billing list on /faq links to the questions that really are on the pricing page.
        expect([...BILLING_QUESTIONS].sort()).toEqual([...pricingQuestions].sort());
        expect(pricing).toContain('href="/faq"');
    });

    it('every answer link resolves, and groups are not empty', () => {
        for (const g of FAQ_GROUPS) {
            expect(g.items.length, g.id).toBeGreaterThanOrEqual(3);
            for (const i of g.items) if (i.href) expect(checkHref(i.href), `${i.q} -> ${i.href}`).toBeNull();
        }
    });

    it('answers match the docs they rely on', () => {
        const text = (slug: string) => getDocPage(slug)!.blocks.map(blockText).join('\n');
        const faq = read('lib/site/faq.ts');
        expect(text('javascript-sdk')).toMatch(/data-consent="required"/);
        expect(text('javascript-sdk')).toMatch(/consent\(true\)/);
        expect(text('javascript-sdk')).toMatch(/optOut\(\)[\s\S]*optIn\(\)/);
        expect(text('environments-and-keys')).toMatch(/Development.*Staging.*Production/);
        expect(text('choosing-a-winner')).toMatch(/Nothing is counted during a rollout/);
        expect(text('integrations')).toMatch(/React/);
        expect(faq).toMatch(/A React package is not available yet/);
        expect(faq).toMatch(/under 30 KB gzipped/);
        expect(faq).not.toMatch(/Bayesian test|guarantee|unlimited|free trial/i);
    });

    it('the page renders FAQPage JSON-LD from the same data', () => {
        const src = read('app/faq/page.tsx');
        expect(src).toContain('faqPageNode(allFaqItems()');
        expect(src).toContain('breadcrumbListNode(crumbs)');
    });
});

describe('changelog: curated, shipped and free of internals', () => {
    it('dates run newest first and ids are unique', () => {
        const dates = RELEASES.map((r) => r.date);
        for (const d of dates) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect([...dates].sort().reverse()).toEqual(dates);
        expect(new Set(RELEASES.map((r) => r.id)).size).toBe(RELEASES.length);
    });

    it('every named feature exists today, and its badge comes from the Features page', () => {
        const names = FEATURE_GROUPS.flatMap((g) => g.features.map((f) => f.name));
        for (const r of RELEASES) for (const i of r.items) {
            if (i.feature) {
                expect(featurePlan(i.feature), `${r.id}: ${i.feature}`).toBeDefined();
                expect(i.plan, `${r.id}: set plan from the feature only`).toBeUndefined();
            }
            if (i.plan) {
                // A plan without a feature must be stated by the docs page it names.
                expect(i.doc, i.text).toBeDefined();
                expect(getDocPage(i.doc!)!.blocks.map(blockText).join('\n'), i.text).toMatch(i.plan === 'Growth and above' ? /Growth and (above|Enterprise)/ : /paid plans/i);
            }
            for (const n of NOT_YET) expect(i.text).not.toMatch(new RegExp(n, 'i'));
        }
        expect(names.length).toBeGreaterThan(20);
        expect(itemPlan({ text: 'x', feature: 'Webhooks' })).toBe('Paid plans');
    });

    it('every link resolves', () => {
        for (const r of RELEASES) for (const i of r.items) if (i.href) expect(checkHref(i.href), `${r.id}: ${i.href}`).toBeNull();
    });

    it('prices and limits match the plans', () => {
        const all = JSON.stringify(RELEASES);
        expect(all).toContain(`Starter is $${PLAN_PRICES_USD.starter.monthly} a month or $${PLAN_PRICES_USD.starter.yearly} a year`);
        expect(all).toContain(`Growth is $${PLAN_PRICES_USD.growth.monthly} a month or $${PLAN_PRICES_USD.growth.yearly} a year`);
        expect(all).toContain(`Starter includes ${fmt(STARTER_MONTHLY_VISITORS)} tested visitors a month and ${STARTER_RUNNING_EXPERIMENTS} running tests`);
        expect(all).toContain(`Growth includes ${fmt(GROWTH_MONTHLY_VISITORS)} tested visitors a month with no cap on running tests`);
        expect(PLAN_RUNNING_EXPERIMENTS[2]).toBeNull();
        expect(all).toContain(`${FREE_MONTHLY_TESTS} new test each month and ${FREE_MAX_GOALS} click goal per test`);
    });

    it('never mirrors the engineering log: no hashes, pending rows, internals or checkout claims', () => {
        const all = read('content/changelog/releases.json');
        expect(all).not.toMatch(/\bpending\b|\b[0-9a-f]{7,40}\b|PR #|\bPR [A-Z]\b|internal|admin|database|deploy|migration|env(ironment)? var|api key rotation/i);
        expect(all).not.toMatch(/checkout|PayPal|Stripe|pay now/i);
        expect(read('lib/changelog.ts')).not.toMatch(/docs\/changelog\.md'/);
    });
});

describe('resources hub, nav, footer and sitemap', () => {
    it('the hub lists the latest posts that name no other product', () => {
        const shown = getAllPosts().filter(listablePost).slice(0, 3);
        expect(shown).toHaveLength(3);
        for (const p of shown) expect(`${p.title} ${p.description}`).not.toMatch(/optimizely|google optimize|vwo|crazy ?egg|convert\b/i);
        expect(read('app/resources/page.tsx')).toContain('getAllPosts().filter(listablePost)');
    });

    it('hub links and page links resolve', () => {
        for (const r of RESOURCE_LINKS) expect(checkHref(r.href), r.href).toBeNull();
        for (const f of PAGES) for (const h of hrefsIn(read(f))) expect(checkHref(h), `${f}: ${h}`).toBeNull();
        for (const f of ['/resources', '/guides', '/faq', '/changelog']) expect(RESOURCE_LINKS.map((r) => r.href).concat('/resources')).toContain(f);
    });

    it('the Resources menu and footer point to the new pages, not the pricing FAQ', () => {
        const menu = NAV_MENUS.find((m) => m.label === 'Resources')!;
        const hrefs = menu.groups.flatMap((g) => g.items.map((i) => i.href));
        for (const h of ['/guides', '/blog', '/docs', '/faq', '/changelog']) expect(hrefs).toContain(h);
        expect(menu.feature?.href).toBe('/resources');
        const footer = FOOTER_COLUMNS.find((c) => c.heading === 'Resources')!.links.map((l) => l.href);
        for (const h of ['/resources', '/guides', '/faq', '/changelog']) expect(footer).toContain(h);
        expect(JSON.stringify([NAV_MENUS, FOOTER_COLUMNS])).not.toContain('/pricing#faq');
        expect(read('app/page.tsx')).toMatch(/More answers in the <Link href="\/faq"/);
    });

    it('the sitemap lists the new pages', () => {
        const s = read('app/sitemap.ts');
        for (const p of ['/resources', '/guides', '/faq', '/changelog']) expect(s).toContain(`'${p}'`);
    });

    it('copy rules: one h1 per page, no em dashes or filler words', () => {
        for (const f of [...PAGES, ...DATA]) {
            const src = read(f);
            expect(src, f).not.toMatch(/—|Bayesian test|guarantee|unlimited|free trial|roadmap|\bPhase\b/i);
            expect(src, f).not.toMatch(/seamless|effortless|unlock|supercharge|leverage|elevate|empower|cutting-edge|game-changer|revolutioni[sz]e|delve|robust|world-class|best-in-class|blazing/i);
        }
        for (const f of PAGES.slice(0, 4)) expect(read(f), f).toContain('<PageHero');
        expect(read('app/blog/page.tsx').match(/<h1/g)).toHaveLength(1);
    });

    it('the blog index uses the site tokens, with no decorative mock chart', () => {
        for (const f of ['app/blog/page.tsx', 'app/blog/_components/BlogGrid.tsx', 'app/blog/_components/PostCard.tsx']) {
            const src = read(f);
            expect(src, f).not.toMatch(/#0b1630|#f8faff|blue-600|blue-700|teal-|zinc-|bg-gradient-to-/);
        }
        expect(read('app/blog/page.tsx')).not.toContain('3.6%');
    });
});
