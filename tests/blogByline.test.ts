import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { getAllPosts } from '@/lib/blog';

describe('blog posts carry no in-body byline', () => {
    const posts = getAllPosts();
    it('loads all 11 posts', () => {
        expect(posts.length).toBeGreaterThanOrEqual(11);
    });
    it('no post body has a By Imraan, Published, Updated or checked line (the page header shows author and date)', () => {
        for (const p of posts) {
            expect(p.markdown, p.slug).not.toMatch(/By Imraan, freeabtest\.com/);
            expect(p.markdown, p.slug).not.toMatch(/Sources checked|Prices checked|Product details checked/);
            expect(p.markdown, p.slug).not.toMatch(/^(Published|Updated) \d+ [A-Z][a-z]+ \d{4}\./m);
        }
    });
    it('frontmatter dates and JSON-LD author and dates stay', () => {
        for (const p of posts) {
            expect(p.date, p.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            const a = JSON.parse(p.articleSchema!);
            expect(a.author.name, p.slug).toBe('Imraan');
            expect(a.datePublished, p.slug).toBe(p.date);
            expect(a.dateModified >= a.datePublished, p.slug).toBe(true);
        }
        const page = fs.readFileSync('app/blog/[slug]/page.tsx', 'utf8');
        expect(page).toContain('{p.authorName}');
        expect(page).toContain('formatDate(p.date)');
    });
});

describe('blog post layout width', () => {
    const page = fs.readFileSync('app/blog/[slug]/page.tsx', 'utf8');
    it('body column is 800px wide with the table of contents beside it on desktop, and the header lines up with it', () => {
        expect(page).toContain('xl:grid-cols-[minmax(180px,1fr)_minmax(0,800px)_minmax(180px,1fr)]');
        expect(page).toContain('id="article-body" className="mx-auto w-full min-w-0 max-w-[800px]"');
        // 800px of text plus the sm:px-8 padding on each side.
        expect(page).toContain('mx-auto max-w-[864px] px-5');
        expect(page).not.toContain('max-w-[720px]');
        const css = fs.readFileSync('app/globals.css', 'utf8');
        expect(css).toMatch(/\.blog-prose pre \{[^}]*overflow-x: auto/);
        expect(css).toMatch(/\.blog-prose \.table-wrap \{[^}]*overflow-x: auto/);
    });
});

describe('links to the confidence interval post', () => {
    it('posts 06 and 10 link to it, and post 10 is dated 3 November 2026 or later', async () => {
        const { getPost } = await import('@/lib/blog');
        const p06 = getPost('statistical-significance-ab-test')!;
        expect(p06.markdown).toContain('For a full walkthrough, see [how to read a confidence interval in an A/B test](/blog/confidence-interval-ab-test).');
        expect(p06.markdown).not.toContain('is planned.');
        const p10 = getPost('ab-test-peeking-problem')!;
        expect(p10.markdown).toContain('Our guide to [reading confidence intervals in an A/B test](/blog/confidence-interval-ab-test) covers how to use that range.');
        expect(p10.date).toBe('2026-11-01');
        expect(p10.updated >= '2026-11-03').toBe(true);
        expect(JSON.parse(p10.articleSchema!).dateModified >= '2026-11-03').toBe(true);
    });
});
