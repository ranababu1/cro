import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { buildRss, getAllPosts, getPost } from '@/lib/blog';
import sitemap from '@/app/sitemap';
import { normalCDF } from '@/lib/statistics';
import { SEQUENTIAL_ALPHA, SEQUENTIAL_MIN_VISITORS, sequentialTest } from '@/lib/sequential';
import { FREE_DAILY_VISITORS, FREE_MONTHLY_VISITORS, FREE_RUNNING_EXPERIMENTS } from '@/lib/plans';

const URL = 'https://www.freeabtest.com/blog/ab-test-peeking-problem';
const IDEAS = 'https://www.freeabtest.com/blog/ab-test-ideas-saas-landing-pages';

/** Two-proportion sample size per version, 95% confidence, 80% power, two-sided, rounded up. */
function perVersion(p: number, lift: number): number {
    const za = 1.959963984540054, zb = 0.8416212335729143;
    const q = p * (1 + lift), pb = (p + q) / 2;
    return Math.ceil((za * Math.sqrt(2 * pb * (1 - pb)) + zb * Math.sqrt(p * (1 - p) + q * (1 - q))) ** 2 / (q - p) ** 2);
}
const twoSided = (z: number) => 2 * (1 - normalCDF(z));

describe('post: the peeking problem, why daily checks create false winners', () => {
    const p = getPost('ab-test-peeking-problem')!;
    it('exists, dated 1 November 2026, with BlogPosting, BreadcrumbList and FAQPage JSON-LD', () => {
        expect(p).toBeTruthy();
        expect(p.date).toBe('2026-11-01');
        const article = JSON.parse(p.articleSchema!);
        expect(article).toMatchObject({ '@type': 'BlogPosting', mainEntityOfPage: URL });
        expect(article.dateModified >= '2026-11-01').toBe(true);
        expect(JSON.parse(p.breadcrumbSchema!).itemListElement).toHaveLength(3);
        expect(JSON.parse(p.faqSchema!).mainEntity.length).toBe(6);
        const page = fs.readFileSync('app/blog/[slug]/page.tsx', 'utf8');
        for (const k of ['articleSchema', 'faqSchema', 'breadcrumbSchema']) expect(page).toContain(`ldJson(p.${k})`);
        expect(p.markdown).not.toContain('\u2014');
        expect(p.markdown).not.toMatch(/\bPhase \d|roadmap|session recording|self-host/i);
    });
    it('sample size and group sequential bars are right', () => {
        expect(perVersion(0.05, 0.1)).toBe(31234);
        expect(Math.round(31234 / 1008)).toBe(31);
        expect(p.markdown).toContain('that is 31,234 visitors per version, or about 31 days at 1,008 a day');
        expect(42 * 24 * 28).toBe(28224);
        // Bars as printed, with their two-sided p-values rounded to the shown precision.
        expect(twoSided(2.361).toFixed(3)).toBe('0.018');
        expect(twoSided(4.048).toFixed(5)).toBe('0.00005');
        expect(twoSided(2.862).toFixed(3)).toBe('0.004');
        expect(twoSided(2.337).toFixed(3)).toBe('0.019');
        expect(twoSided(2.024).toFixed(3)).toBe('0.043');
        expect(p.markdown).toContain('| Week 1 | z above 2.361 (p < 0.018) | z above 4.048 (p < 0.00005) |');
    });
    it('describes the shipped statistics and plan limits', () => {
        expect(SEQUENTIAL_ALPHA).toBe(0.05);
        expect(SEQUENTIAL_MIN_VISITORS).toBe(100);
        const v = { total_users: 1000, conversions: 50, conversion_rate: 0.05 };
        expect(sequentialTest(v, v, 2).threshold).toBe(0.025);
        expect(p.markdown).toContain('Significance is only tested once every variation has at least 100 visitors.');
        expect(p.markdown).toContain('p is below 0.05 divided by the number of variants compared with the control');
        expect(p.markdown).toContain('95% Wilson score interval');
        expect(p.markdown).toContain('under `statistical_significance`');
        const docs = fs.readFileSync('lib/docs/content/results.ts', 'utf8');
        expect(docs).toContain('you can check the dashboard every hour and stop the moment a result is significant');
        expect(docs).toContain('about 2 to 3 times as many visitors');
        expect(docs).toContain('**Collecting data**');
        expect([FREE_MONTHLY_VISITORS, FREE_DAILY_VISITORS, FREE_RUNNING_EXPERIMENTS]).toEqual([10_000, 300, 1]);
        expect(p.markdown).toContain('allows 10,000 tested visitors a month, up to 300 a day, with 1 running test');
        expect(p.markdown).not.toContain('not the setting any particular product uses');
    });
    it('links only to live posts, is in the sitemap and RSS', () => {
        const slugs = new Set(getAllPosts().map((x) => x.slug));
        for (const m of p.markdown.matchAll(/\]\(https:\/\/www\.freeabtest\.com\/blog\/([a-z0-9-]+)\)/g)) expect(slugs.has(m[1])).toBe(true);
        expect(p.markdown).toContain(`](${IDEAS})`);
        expect(sitemap().some((e) => e.url === URL)).toBe(true);
        expect(buildRss(getAllPosts())).toContain('/blog/ab-test-peeking-problem');
    });
    it('posts 03 and 07 link to the SaaS landing page ideas post, dated 1 November 2026 or later', () => {
        for (const slug of ['ab-testing-low-traffic', 'ab-test-sample-size']) {
            const post = getPost(slug)!;
            expect(post.markdown).toContain(`](${IDEAS})`);
            expect(post.updated >= '2026-11-01').toBe(true);
            expect(JSON.parse(post.articleSchema!).dateModified >= '2026-11-01').toBe(true);
            expect(post.markdown).not.toMatch(/^By Imraan, freeabtest\.com\./m);
            expect(post.markdown).not.toMatch(/\/roadmap|\bPhase \d/);
        }
        expect(getPost('ab-testing-low-traffic')!.markdown).toContain('](/blog/ab-test-javascript)');
    });
});
