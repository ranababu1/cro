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
    it('two columns on desktop: the article starts at the container edge and fills it, the table of contents sits on the right', () => {
        expect(page).toContain('mx-auto grid max-w-[1360px] gap-12 px-5 pt-12 sm:px-8 xl:grid-cols-[minmax(0,1fr)_240px]');
        expect(page).toContain('id="article-body" className="w-full min-w-0 xl:max-w-[1040px]"');
        // The header uses the same container and leaves the 240px table of contents plus the 48px gap free on the right,
        // so its text starts and ends where the article does.
        expect(page).toContain('mx-auto max-w-[1360px] px-5 pb-12 pt-10 sm:px-8 sm:pt-14');
        expect(page).toContain('<div className="xl:pr-[288px]">');
        expect(page).not.toContain('<div className="hidden xl:block" />');
        expect(page).not.toMatch(/max-w-\[(720|800|864)px\]/);
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
