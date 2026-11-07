import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { buildRss, getAllPosts, getPost } from '@/lib/blog';
import sitemap from '@/app/sitemap';
import { FREE_MONTHLY_VISITORS, FREE_DAILY_VISITORS, FREE_RUNNING_EXPERIMENTS, FREE_MONTHLY_TESTS, FREE_PROJECTS, FREE_DOMAINS, FREE_MAX_VARIATIONS, FREE_MAX_GOALS, PAID_MAX_VARIATIONS, PLAN_PROJECTS, PLAN_SEATS } from '@/lib/plans';

const URL = 'https://www.freeabtest.com/blog/optimizely-alternatives-small-teams';
const BUCKETING = 'https://www.freeabtest.com/blog/ab-test-bucketing-hashing';

describe('post: Optimizely alternatives for small teams and startups', () => {
    const p = getPost('optimizely-alternatives-small-teams')!;
    it('exists, dated 7 November 2026, with BlogPosting, ItemList, BreadcrumbList and FAQPage JSON-LD', () => {
        expect(p).toBeTruthy();
        expect(p.date).toBe('2026-11-07');
        const article = JSON.parse(p.articleSchema!);
        expect(article).toMatchObject({ '@type': 'BlogPosting', mainEntityOfPage: URL });
        expect(article.dateModified >= '2026-11-07').toBe(true);
        expect(JSON.parse(p.itemListSchema!).itemListElement).toHaveLength(7);
        expect(JSON.parse(p.breadcrumbSchema!).itemListElement).toHaveLength(3);
        expect(JSON.parse(p.faqSchema!).mainEntity).toHaveLength(6);
    });
    it('follows the content rules', () => {
        expect(p.markdown).not.toContain('\u2014');
        expect(p.markdown).not.toMatch(/\/roadmap|\bPhase \d|research\/|^By Imraan/m);
        const external = [...p.markdown.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => new globalThis.URL(m[1]).hostname);
        for (const h of external) expect(['www.freeabtest.com', 'support.google.com', 'techcrunch.com']).toContain(h);
    });
    it('freeabtest.com claims match the plan limits and pricing page', () => {
        expect([FREE_MONTHLY_VISITORS, FREE_DAILY_VISITORS, FREE_RUNNING_EXPERIMENTS, FREE_MONTHLY_TESTS, FREE_PROJECTS, FREE_DOMAINS, FREE_MAX_VARIATIONS, FREE_MAX_GOALS]).toEqual([10000, 300, 1, 1, 1, 1, 1, 1]);
        expect(PAID_MAX_VARIATIONS).toBe(50);
        expect(PLAN_PROJECTS.slice(1, 3)).toEqual([3, 10]);
        expect(PLAN_SEATS.slice(1, 3)).toEqual([5, 15]);
        const cards = fs.readFileSync('app/pricing/BillingCards.tsx', 'utf8');
        expect(cards).toContain("name: 'Starter', monthly: 10, yearly: 100");
        expect(cards).toContain("name: 'Growth', monthly: 50, yearly: 500");
        expect(cards).toContain('250,000 tested visitors a month');
        expect(cards).toContain('1,000,000 tested visitors a month');
        const pricing = fs.readFileSync('app/pricing/page.tsx', 'utf8');
        expect(pricing).toMatch(/name: 'Session recordings', tier: 1/);
        expect(p.markdown).toContain('session recordings are not available yet');
        expect(p.markdown).toContain('a fifth of the tested-visitor allowance of freeabtest Starter');
    });
    it('12-month costs and the sample size table add up', () => {
        for (const [m, y] of [[120, 100], [600, 500], [1788, 1344], [4788, 3588], [7188, 5040]]) expect(p.markdown).toContain(`$${m.toLocaleString('en-US')} | $${y.toLocaleString('en-US')}`);
        expect(p.markdown).toContain('From $5,940');
        expect(p.markdown).toContain('| 20% (3.0% to 3.6%) | 13,914 | 27,828 | 93 |');
    });
    it('links only to live posts, is in the sitemap and RSS', () => {
        const slugs = new Set(getAllPosts().map((x) => x.slug));
        for (const m of p.markdown.matchAll(/\]\(https:\/\/www\.freeabtest\.com\/blog\/([a-z0-9-]+)\)/g)) expect(slugs.has(m[1])).toBe(true);
        expect(sitemap().some((e) => e.url === URL)).toBe(true);
        expect(buildRss(getAllPosts())).toContain('/blog/optimizely-alternatives-small-teams');
    });
    it('posts 04, 07 and 08 link to the bucketing post, dated 7 November 2026 or later', () => {
        for (const slug of ['ab-test-javascript', 'ab-test-sample-size', 'split-url-testing']) {
            const post = getPost(slug)!;
            expect(post.markdown).toContain(`](${BUCKETING})`);
            expect(post.updated >= '2026-11-07').toBe(true);
            expect(JSON.parse(post.articleSchema!).dateModified >= '2026-11-07').toBe(true);
        }
        expect(getPost('ab-test-javascript')!.markdown).toContain(`**[Deterministic bucketing](${BUCKETING}).**`);
        expect(getPost('ab-test-sample-size')!.markdown).toContain(`[sticky assignment](${BUCKETING})`);
        expect(getPost('split-url-testing')!.markdown).toContain(`**[Deterministic assignment](${BUCKETING})**`);
        expect(getPost('ab-test-bucketing-hashing')!.markdown).toContain('stops some new visitors from entering');
    });
});
