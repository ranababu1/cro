import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { buildRss, getAllPosts, getPost } from '@/lib/blog';
import sitemap from '@/app/sitemap';
import { FREE_DAILY_VISITORS, FREE_MAX_GOALS, FREE_MAX_VARIATIONS, FREE_MONTHLY_TESTS, FREE_MONTHLY_VISITORS, FREE_RUNNING_EXPERIMENTS, PAID_MAX_VARIATIONS } from '@/lib/plans';
import { MAX_GOALS } from '@/lib/goals';
import { GROWTH_FEATURES } from '@/lib/entitlements';

const URL = 'https://www.freeabtest.com/blog/ab-test-ideas-saas-landing-pages';
const SPLIT = 'https://www.freeabtest.com/blog/split-url-testing';

/** Two-proportion sample size per version, 95% confidence, 80% power, two-sided, rounded up. */
function perVersion(p: number, lift: number): number {
    const za = 1.959963984540054, zb = 0.8416212335729143;
    const q = p * (1 + lift), pb = (p + q) / 2;
    return Math.ceil((za * Math.sqrt(2 * pb * (1 - pb)) + zb * Math.sqrt(p * (1 - p) + q * (1 - q))) ** 2 / (q - p) ** 2);
}

describe('post: 25 A/B test ideas for SaaS landing pages, ranked by traffic', () => {
    const p = getPost('ab-test-ideas-saas-landing-pages')!;
    it('exists, dated 31 October 2026, with BlogPosting, BreadcrumbList, ItemList and FAQPage JSON-LD', () => {
        expect(p).toBeTruthy();
        expect(p.date).toBe('2026-10-31');
        const article = JSON.parse(p.articleSchema!);
        expect(article).toMatchObject({ '@type': 'BlogPosting', mainEntityOfPage: URL });
        expect(article.dateModified >= '2026-10-31').toBe(true);
        expect(JSON.parse(p.breadcrumbSchema!).itemListElement).toHaveLength(3);
        const list = JSON.parse(p.itemListSchema!);
        expect(list).toMatchObject({ '@type': 'ItemList', numberOfItems: 25 });
        expect(list.itemListElement).toHaveLength(25);
        expect(JSON.parse(p.faqSchema!).mainEntity.length).toBe(6);
        expect(fs.readFileSync('app/blog/[slug]/page.tsx', 'utf8')).toContain('ldJson(p.itemListSchema)');
        expect(p.markdown).not.toContain('\u2014');
        expect(p.markdown).not.toMatch(/\bPhase \d|roadmap|session recording|self-host/i);
    });
    it('sample size numbers match the two-proportion formula', () => {
        expect([0.1, 0.2, 0.3].map((l) => perVersion(0.08, l))).toEqual([18872, 4921, 2276]);
        expect([0.1, 0.2, 0.3].map((l) => perVersion(0.04, l))).toEqual([39475, 10317, 4783]);
        expect([0.1, 0.2, 0.3].map((l) => perVersion(0.03, l))).toEqual([53211, 13914, 6455]);
        expect([0.1, 0.2, 0.3].map((l) => perVersion(0.015, l))).toEqual([108153, 28304, 13141]);
        expect(perVersion(0.08, 0.05)).toBe(73853);
        expect(p.markdown).toContain('| Click on the main button | 8% | 18,872 | 4,921 | 2,276 |');
        expect(p.markdown).toContain('| 22 | Button color | Button click (8%) | 5% | 73,853 | 147,706 | 60 | 15 |');
    });
    it('states plan limits that the code enforces', () => {
        expect([FREE_MONTHLY_VISITORS, FREE_DAILY_VISITORS, FREE_RUNNING_EXPERIMENTS, FREE_MONTHLY_TESTS, FREE_MAX_VARIATIONS, FREE_MAX_GOALS, PAID_MAX_VARIATIONS, MAX_GOALS]).toEqual([10_000, 300, 1, 1, 1, 1, 50, 50]);
        expect(GROWTH_FEATURES).toContain('visual_editor');
        expect(p.markdown).toContain('| Tested visitors a month | 10,000 (300 a day) | 250,000 | 1,000,000 |');
        expect(p.markdown).toContain('| Running tests at a time | 1 | 20 | Unlimited |');
        expect(p.markdown).toContain('| Variations per test | 1 (A/B only) | Up to 50 | Up to 50 |');
        expect(p.markdown).toContain('1 click goal on a CSS selector');
        expect(p.markdown).toContain('On Free, 300 tested visitors a day gives 8,400 visitors in 4 weeks.');
    });
    it('links only to live posts, is in the sitemap and RSS', () => {
        const slugs = new Set(getAllPosts().map((x) => x.slug));
        for (const m of p.markdown.matchAll(/\]\(https:\/\/www\.freeabtest\.com\/blog\/([a-z0-9-]+)\)/g)) expect(slugs.has(m[1])).toBe(true);
        expect(p.markdown).toContain(`](${SPLIT})`);
        expect(sitemap().some((e) => e.url === URL)).toBe(true);
        expect(buildRss(getAllPosts())).toContain('/blog/ab-test-ideas-saas-landing-pages');
    });
    it('posts 01, 04 and 05 link to the split URL testing post, dated 31 October 2026 or later', () => {
        for (const slug of ['best-free-ab-testing-tools', 'ab-test-javascript', 'google-optimize-alternatives-developers']) {
            const post = getPost(slug)!;
            expect(post.markdown).toContain(`](${SPLIT})`);
            expect(post.updated >= '2026-10-31').toBe(true);
            expect(JSON.parse(post.articleSchema!).dateModified >= '2026-10-31').toBe(true);
            expect(post.markdown).not.toMatch(/\/roadmap|\bPhase \d/);
        }
        expect(getPost('best-free-ab-testing-tools')!.markdown).toContain('](/blog/ab-test-javascript)');
        const optimize = getPost('google-optimize-alternatives-developers')!.markdown;
        expect(optimize).toContain('A guide to sending A/B test data to GA4 is planned.');
        expect(optimize).not.toContain('one on split URL testing are planned');
    });
});
