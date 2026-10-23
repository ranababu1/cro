import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { buildRss, getAllPosts, getPost } from '@/lib/blog';
import sitemap from '@/app/sitemap';

const URL = 'https://www.freeabtest.com/blog/google-optimize-alternatives-developers';

describe('post: Google Optimize alternatives for developers in 2026', () => {
    const p = getPost('google-optimize-alternatives-developers')!;
    it('exists, dated 23 October 2026, with BlogPosting, ItemList, BreadcrumbList and FAQPage JSON-LD', () => {
        expect(p).toBeTruthy();
        expect(p.date).toBe('2026-10-23');
        expect(JSON.parse(p.articleSchema!)).toMatchObject({ '@type': 'BlogPosting', dateModified: '2026-10-23', mainEntityOfPage: URL });
        expect(JSON.parse(p.itemListSchema!)).toMatchObject({ '@type': 'ItemList', numberOfItems: 7 });
        expect(JSON.parse(p.breadcrumbSchema!).itemListElement).toHaveLength(3);
        expect(JSON.parse(p.faqSchema!).mainEntity.length).toBe(6);
        expect(fs.readFileSync('app/blog/[slug]/page.tsx', 'utf8')).toContain('ldJson(p.itemListSchema)');
    });
    it('matches the Free plan and the SDK GA4 event, with no em dashes', () => {
        expect(p.markdown).toMatch(/1 new test a month/);
        expect(p.markdown).toMatch(/1 goal per test \(a click on a CSS selector\)/);
        expect(p.markdown).not.toContain('\u2014');
        const sdk = fs.readFileSync('sdk-src/sdk.js', 'utf8');
        expect(sdk).toContain("'experience_impression'");
        expect(sdk).toContain("'FABT-'");
        expect(sdk).toContain("data-analytics");
    });
    it('is in the sitemap and RSS, and posts 01 and 04 link to it', () => {
        expect(sitemap().some((e) => e.url === URL)).toBe(true);
        expect(buildRss(getAllPosts())).toContain('/blog/google-optimize-alternatives-developers');
        for (const slug of ['best-free-ab-testing-tools', 'ab-test-javascript']) {
            expect(getPost(slug)!.markdown).toContain(`](${URL})`);
        }
        expect(getPost('ab-test-javascript')!.markdown).toContain('| GA4 | You send your own event | `experience_impression` sent on every plan |');
    });
});
