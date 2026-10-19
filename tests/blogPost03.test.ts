import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { buildRss, getAllPosts, getPost } from '@/lib/blog';
import sitemap from '@/app/sitemap';

describe('post: A/B testing with low traffic', () => {
    const p = getPost('ab-testing-low-traffic')!;
    it('exists with BlogPosting, BreadcrumbList and FAQPage JSON-LD', () => {
        expect(p).toBeTruthy();
        expect(JSON.parse(p.articleSchema!)).toMatchObject({ '@type': 'BlogPosting', mainEntityOfPage: 'https://www.freeabtest.com/blog/ab-testing-low-traffic' });
        const crumbs = JSON.parse(p.breadcrumbSchema!);
        expect(crumbs['@type']).toBe('BreadcrumbList');
        expect(crumbs.itemListElement).toHaveLength(3);
        expect(JSON.parse(p.faqSchema!).mainEntity.length).toBe(5);
    });
    it('the post page renders every JSON-LD block', () => {
        const page = fs.readFileSync('app/blog/[slug]/page.tsx', 'utf8');
        for (const k of ['articleSchema', 'faqSchema', 'breadcrumbSchema']) expect(page).toContain(`ldJson(p.${k})`);
        // Posts 01 and 02 carry breadcrumbs too since they were republished.
        for (const slug of ['best-free-ab-testing-tools', 'how-long-to-run-an-ab-test']) {
            expect(JSON.parse(getPost(slug)!.breadcrumbSchema!).itemListElement).toHaveLength(3);
        }
    });
    it('is in the sitemap and RSS, and posts 01 and 02 link to it', () => {
        expect(sitemap().some((e) => e.url === 'https://www.freeabtest.com/blog/ab-testing-low-traffic')).toBe(true);
        expect(buildRss(getAllPosts())).toContain('/blog/ab-testing-low-traffic');
        const link = '(https://www.freeabtest.com/blog/ab-testing-low-traffic)';
        expect(getPost('best-free-ab-testing-tools')!.markdown).toContain(link);
        expect(getPost('how-long-to-run-an-ab-test')!.markdown).toContain(link);
        expect(getPost('how-long-to-run-an-ab-test')!.markdown).not.toContain('upcoming guide');
    });
});
