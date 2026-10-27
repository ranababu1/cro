import { describe, it, expect } from 'vitest';
import { buildRss, getAllPosts, getPost, renderPost } from '@/lib/blog';
import sitemap from '@/app/sitemap';

const URL = 'https://www.freeabtest.com/blog/ab-test-sample-size';
const SIG = 'https://www.freeabtest.com/blog/statistical-significance-ab-test';

describe('post: A/B test sample size, explained with a calculator', () => {
    const p = getPost('ab-test-sample-size')!;
    it('exists, dated 27 October 2026, with BlogPosting, BreadcrumbList and FAQPage JSON-LD', () => {
        expect(p).toBeTruthy();
        expect(p.date).toBe('2026-10-27');
        expect(JSON.parse(p.articleSchema!)).toMatchObject({ '@type': 'BlogPosting', dateModified: '2026-10-27', mainEntityOfPage: URL });
        expect(JSON.parse(p.breadcrumbSchema!).itemListElement).toHaveLength(3);
        expect(JSON.parse(p.faqSchema!).mainEntity.length).toBe(6);
        expect(p.markdown).not.toContain('\u2014');
    });
    it('renders the calculator as a code block, and the calculator gives the numbers in the post', () => {
        const { html } = renderPost(p.markdown);
        expect(html).toMatch(/<pre><code[^>]*>[\s\S]*function sampleSize/);
        const src = /```javascript\n([\s\S]*?)```/.exec(p.markdown)![1].replace(/console\.log\([^)]*\)\);?/g, '');
        const sampleSize = new Function(`${src}; return sampleSize;`)() as (o: Record<string, number>) => { perVersion: number; total: number };
        expect(sampleSize({ baseline: 0.03, lift: 0.2 })).toEqual({ perVersion: 13914, total: 27828 });
        expect(sampleSize({ baseline: 0.05, lift: 0.1 }).perVersion).toBe(31234);
        expect(sampleSize({ baseline: 0.03, lift: 0.2, variants: 3 })).toEqual({ perVersion: 18559, total: 74236 });
        expect(sampleSize({ baseline: 0.03, lift: 0.05 }).perVersion).toBe(207938);
    });
    it('describes the ramp as a share of visitors, not a change of split', () => {
        expect(p.markdown).toContain('keep the 50/50 split, let only a small share of new visitors into the test');
    });
    it('links only to live posts, is in the sitemap and RSS, and posts 02 and 03 link to post 06', () => {
        const slugs = new Set(getAllPosts().map((x) => x.slug));
        for (const m of p.markdown.matchAll(/\]\(https:\/\/www\.freeabtest\.com\/blog\/([a-z0-9-]+)\)/g)) expect(slugs.has(m[1])).toBe(true);
        expect(sitemap().some((e) => e.url === URL)).toBe(true);
        expect(buildRss(getAllPosts())).toContain('/blog/ab-test-sample-size');
        for (const slug of ['how-long-to-run-an-ab-test', 'ab-testing-low-traffic']) {
            const post = getPost(slug)!;
            expect(post.markdown).toContain(`](${SIG})`);
            expect(post.updated).toBe('2026-10-27');
            expect(JSON.parse(post.articleSchema!).dateModified).toBe('2026-10-27');
            expect(post.markdown).toContain('Updated 27 October 2026.');
        }
    });
});
