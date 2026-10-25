import { describe, it, expect } from 'vitest';
import { buildRss, getAllPosts, getPost } from '@/lib/blog';
import sitemap from '@/app/sitemap';
import { SEQUENTIAL_ALPHA, SEQUENTIAL_MIN_VISITORS } from '@/lib/sequential';

const URL = 'https://www.freeabtest.com/blog/statistical-significance-ab-test';

describe('post: What statistical significance means in an A/B test', () => {
    const p = getPost('statistical-significance-ab-test')!;
    it('exists, dated 25 October 2026, with BlogPosting, BreadcrumbList and FAQPage JSON-LD', () => {
        expect(p).toBeTruthy();
        expect(p.date).toBe('2026-10-25');
        expect(p.category).toBe('Statistics');
        expect(JSON.parse(p.articleSchema!)).toMatchObject({ '@type': 'BlogPosting', dateModified: '2026-10-25', mainEntityOfPage: URL });
        expect(JSON.parse(p.breadcrumbSchema!).itemListElement).toHaveLength(3);
        expect(JSON.parse(p.faqSchema!).mainEntity.length).toBe(6);
        expect(p.markdown).not.toContain('\u2014');
    });
    it('describes the statistics the app uses', () => {
        expect(SEQUENTIAL_ALPHA).toBe(0.05);
        expect(SEQUENTIAL_MIN_VISITORS).toBe(100);
        expect(p.markdown).toContain('mixture sequential probability ratio test');
        expect(p.markdown).toContain('at least 100 visitors');
        expect(p.markdown).toContain('`statistical_significance`');
    });
    it('links only to live posts and pages, and is in the sitemap and RSS', () => {
        const slugs = new Set(getAllPosts().map((x) => x.slug));
        for (const m of p.markdown.matchAll(/\]\(https:\/\/www\.freeabtest\.com\/blog\/([a-z0-9-]+)\)/g)) expect(slugs.has(m[1])).toBe(true);
        expect(sitemap().some((e) => e.url === URL)).toBe(true);
        expect(buildRss(getAllPosts())).toContain('/blog/statistical-significance-ab-test');
    });
});
