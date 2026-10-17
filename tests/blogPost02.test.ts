import { describe, it, expect } from 'vitest';
import { buildRss, getAllPosts, getPost, renderPost } from '@/lib/blog';
import sitemap from '@/app/sitemap';

describe('post: how long to run an A/B test', () => {
    const p = getPost('how-long-to-run-an-ab-test')!;
    it('exists with its own BlogPosting and FAQPage JSON-LD', () => {
        expect(p).toBeTruthy();
        const article = JSON.parse(p.articleSchema!);
        expect(article['@type']).toBe('BlogPosting');
        expect(article.mainEntityOfPage).toBe('https://www.freeabtest.com/blog/how-long-to-run-an-ab-test');
        const faq = JSON.parse(p.faqSchema!);
        expect(faq['@type']).toBe('FAQPage');
        expect(faq.mainEntity.length).toBeGreaterThan(0);
    });
    it('renders the bold formula with √ and ² intact', () => {
        const { html, afterFaqHtml } = renderPost(p.markdown);
        const strong = (html + afterFaqHtml).match(/<strong>n = [^<]*<\/strong>/)?.[0] ?? '';
        expect(strong).toContain('√(2p̄(1 - p̄))');
        expect(strong).toContain(')² ÷ (p2 - p1)²');
    });
    it('is in the sitemap and RSS, and post 01 links to it', () => {
        expect(sitemap().some((e) => e.url === 'https://www.freeabtest.com/blog/how-long-to-run-an-ab-test')).toBe(true);
        expect(buildRss(getAllPosts())).toContain('/blog/how-long-to-run-an-ab-test');
        expect(getPost('best-free-ab-testing-tools')!.markdown).toContain('a 10% lift would take about 11 weeks');
    });
});
