import { describe, it, expect } from 'vitest';
import { buildRss, getAllPosts, getPost } from '@/lib/blog';
import sitemap from '@/app/sitemap';
import { FREE_MONTHLY_VISITORS, PAID_MAX_VARIATIONS } from '@/lib/plans';
import { SRM_P_THRESHOLD, SRM_MIN_VISITORS } from '@/lib/statistics';

const URL = 'https://www.freeabtest.com/blog/ab-test-bucketing-hashing';
const CI = 'https://www.freeabtest.com/blog/confidence-interval-ab-test';

function extractCode(md: string): string {
    const m = md.match(/```js\n([\s\S]*?)```/);
    return m![1];
}

describe('post: how A/B testing tools assign visitors to variants', () => {
    const p = getPost('ab-test-bucketing-hashing')!;
    it('exists, dated 5 November 2026, with BlogPosting, BreadcrumbList and FAQPage JSON-LD', () => {
        expect(p).toBeTruthy();
        expect(p.date).toBe('2026-11-05');
        const article = JSON.parse(p.articleSchema!);
        expect(article).toMatchObject({ '@type': 'BlogPosting', mainEntityOfPage: URL });
        expect(article.dateModified >= '2026-11-05').toBe(true);
        expect(JSON.parse(p.breadcrumbSchema!).itemListElement).toHaveLength(3);
        expect(JSON.parse(p.faqSchema!).mainEntity.length).toBeGreaterThan(0);
        expect(p.markdown).toContain('```js');
        expect(p.markdown).not.toContain('\u2014');
        expect(p.markdown).not.toMatch(/\bPhase \d|roadmap|session recording|self-host/i);
        expect(p.markdown).not.toMatch(/^By Imraan/m);
    });
    it('the assignment code is deterministic, respects allocation and splits evenly', () => {
        const assign = new Function(`${extractCode(p.markdown)}; return assign;`)() as
            (v: string, e: string, w: Record<string, number>, a: number) => string | null;
        expect(assign('user_1', 'exp', { control: 50, b: 50 }, 100)).toBe(assign('user_1', 'exp', { control: 50, b: 50 }, 100));
        const counts: Record<string, number> = { control: 0, b: 0, out: 0 };
        for (let i = 0; i < 20000; i++) counts[assign(`user_${i}`, 'exp', { control: 50, b: 50 }, 20) ?? 'out']++;
        expect(Math.abs(counts.control + counts.b - 4000)).toBeLessThan(300);
        expect(Math.abs(counts.control - counts.b)).toBeLessThan(300);
    });
    it('product claims match the app', () => {
        expect(SRM_P_THRESHOLD).toBe(0.001);
        expect(SRM_MIN_VISITORS).toBe(100);
        expect(PAID_MAX_VARIATIONS).toBe(50);
        expect(FREE_MONTHLY_VISITORS).toBe(10000);
        expect(p.markdown).toContain('lowering it stops some new visitors from entering');
    });
    it('links only to live posts, is in the sitemap and RSS', () => {
        const slugs = new Set(getAllPosts().map((x) => x.slug));
        for (const m of p.markdown.matchAll(/\]\(https:\/\/www\.freeabtest\.com\/blog\/([a-z0-9-]+)\)/g)) expect(slugs.has(m[1])).toBe(true);
        expect(sitemap().some((e) => e.url === URL)).toBe(true);
        expect(buildRss(getAllPosts())).toContain('/blog/ab-test-bucketing-hashing');
    });
    it('post 02 links to the confidence interval post, dated 5 November 2026 or later', () => {
        const post = getPost('how-long-to-run-an-ab-test')!;
        expect(post.markdown).toContain(`](${CI})`);
        expect(post.updated >= '2026-11-05').toBe(true);
        expect(JSON.parse(post.articleSchema!).dateModified >= '2026-11-05').toBe(true);
        expect(post.markdown).toContain('](/blog/ab-test-javascript)');
    });
});
