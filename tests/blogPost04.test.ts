import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { buildRss, getAllPosts, getPost } from '@/lib/blog';
import sitemap from '@/app/sitemap';

describe('post: How to run an A/B test with plain JavaScript', () => {
    const p = getPost('ab-test-javascript')!;
    it('exists, dated 21 October 2026, with BlogPosting, BreadcrumbList, HowTo and FAQPage JSON-LD', () => {
        expect(p).toBeTruthy();
        expect(p.date).toBe('2026-10-21');
        expect(JSON.parse(p.articleSchema!)).toMatchObject({ '@type': 'BlogPosting', dateModified: '2026-10-21', mainEntityOfPage: 'https://www.freeabtest.com/blog/ab-test-javascript' });
        expect(JSON.parse(p.breadcrumbSchema!).itemListElement).toHaveLength(3);
        expect(JSON.parse(p.howtoSchema!)).toMatchObject({ '@type': 'HowTo' });
        expect(JSON.parse(p.faqSchema!).mainEntity.length).toBe(5);
        expect(fs.readFileSync('app/blog/[slug]/page.tsx', 'utf8')).toContain('ldJson(p.howtoSchema)');
    });
    it('matches the Free plan: 1 new test a month, 1 click goal, custom events paid', () => {
        expect(p.markdown).toMatch(/1 new test a month/);
        expect(p.markdown).toMatch(/exactly 1 goal per test \(a click on a CSS selector\)/);
        expect(p.markdown).toMatch(/Paid plans only \(Starter and up\):\*\* for a conversion/);
        expect(p.markdown).not.toMatch(/10 tests (over|in total|total)|tests over the life/);
        expect(p.markdown).not.toContain('\u2014');
    });
    it('is in the sitemap and RSS, and posts 01, 02 and 03 link to it', () => {
        expect(sitemap().some((e) => e.url === 'https://www.freeabtest.com/blog/ab-test-javascript')).toBe(true);
        expect(buildRss(getAllPosts())).toContain('/blog/ab-test-javascript');
        for (const slug of ['best-free-ab-testing-tools', 'how-long-to-run-an-ab-test', 'ab-testing-low-traffic']) {
            const post = getPost(slug)!;
            expect(post.markdown).toContain('](/blog/ab-test-javascript)');
            expect(post.updated).toBe('2026-10-21');
        }
    });
    it('no blog post puts form, page visit or custom event goals, or trackConversion, on Free', () => {
        const free = getPost('best-free-ab-testing-tools')!.markdown;
        expect(free).not.toMatch(/are paid features, and so are[^.]*are paid features/);
        expect(free).toMatch(/\(`trackConversion`\) are paid features/);
    });
});
