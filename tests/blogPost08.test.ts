import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { buildRss, getAllPosts, getPost, renderPost } from '@/lib/blog';
import sitemap from '@/app/sitemap';
import { FREE_DAILY_VISITORS, FREE_MAX_GOALS, FREE_MAX_VARIATIONS, FREE_MONTHLY_TESTS, FREE_MONTHLY_VISITORS, FREE_RUNNING_EXPERIMENTS, PAID_MAX_VARIATIONS } from '@/lib/plans';

const URL = 'https://www.freeabtest.com/blog/split-url-testing';
const SIZE = 'https://www.freeabtest.com/blog/ab-test-sample-size';

type Beacon = { variant: string; type: string };

/** Runs the post's redirect script in a stubbed browser and returns what it did. */
function runScript(src: string, opts: { path: string; search?: string; hash?: string; vid: string; ua?: string }) {
    const store: Record<string, string> = { diy_ab_vid: opts.vid };
    const beacons: Beacon[] = [];
    let replaced: string | null = null;
    const style: { visibility: string } = { visibility: '' };
    const win: Record<string, unknown> = {};
    const env = {
        window: win,
        document: { documentElement: { style } },
        navigator: { webdriver: false, userAgent: opts.ua ?? 'Mozilla/5.0', sendBeacon: (_u: string, body: string) => { beacons.push(JSON.parse(body)); return true; } },
        localStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } },
        location: { pathname: opts.path, search: opts.search ?? '', hash: opts.hash ?? '', replace: (u: string) => { replaced = u; } },
        crypto: { randomUUID: () => 'x' },
        setTimeout: () => 0,
    };
    new Function(...Object.keys(env), src)(...Object.values(env));
    return { replaced: replaced as string | null, hidden: style.visibility === 'hidden', beacons, ab: win.diyAB as { variant: string } };
}

describe('post: How to run a split URL test without a plugin', () => {
    const p = getPost('split-url-testing')!;
    it('exists, dated 29 October 2026, with BlogPosting, BreadcrumbList, HowTo and FAQPage JSON-LD', () => {
        expect(p).toBeTruthy();
        expect(p.date).toBe('2026-10-29');
        expect(JSON.parse(p.articleSchema!)).toMatchObject({ '@type': 'BlogPosting', dateModified: '2026-10-29', mainEntityOfPage: URL });
        expect(JSON.parse(p.breadcrumbSchema!).itemListElement).toHaveLength(3);
        const howto = JSON.parse(p.howtoSchema!);
        expect(howto['@type']).toBe('HowTo');
        expect(howto.step).toHaveLength(6);
        expect(fs.readFileSync('app/blog/[slug]/page.tsx', 'utf8')).toContain('ldJson(p.howtoSchema)');
        expect(JSON.parse(p.faqSchema!).mainEntity.length).toBe(6);
        expect(p.markdown).not.toContain('\u2014');
    });
    it('renders the redirect script, and the script assigns, redirects and logs as the post says', () => {
        const { html } = renderPost(p.markdown);
        expect(html).toMatch(/<pre><code[^>]*>[\s\S]*location\.replace/);
        const src = /```html\n<script>\n([\s\S]*?)<\/script>\n```/.exec(p.markdown)![1];
        // Find one visitor ID in each group.
        let variantId = '', controlId = '';
        for (let i = 0; i < 100 && (!variantId || !controlId); i++) {
            const r = runScript(src, { path: '/pricing-b', vid: `v${i}` });
            if (r.ab.variant === 'variant') variantId ||= `v${i}`; else controlId ||= `v${i}`;
        }
        const v = runScript(src, { path: '/pricing', search: '?utm_source=newsletter&utm_campaign=oct', hash: '#plans', vid: variantId });
        expect(v.replaced).toBe('/pricing-b?utm_source=newsletter&utm_campaign=oct#plans');
        expect(v.hidden).toBe(true);
        expect(v.beacons.map((b) => b.type)).toEqual(['assigned']);
        const landed = runScript(src, { path: '/pricing-b', vid: variantId });
        expect(landed.replaced).toBeNull();
        expect(landed.beacons.map((b) => b.type)).toEqual(['landed']);
        const c = runScript(src, { path: '/pricing', vid: controlId });
        expect(c.replaced).toBeNull();
        expect(c.hidden).toBe(false);
        expect(c.beacons.map((b) => b.type)).toEqual(['assigned', 'landed']);
        expect(runScript(src, { path: '/pricing-b', vid: controlId }).beacons).toEqual([]);
        const bot = runScript(src, { path: '/pricing', vid: variantId, ua: 'Googlebot/2.1' });
        expect(bot.replaced).toBe('/pricing-b');
        expect(bot.beacons).toEqual([]);
    });
    it('states the Free plan limits that the code enforces', () => {
        expect([FREE_MONTHLY_VISITORS, FREE_DAILY_VISITORS, FREE_RUNNING_EXPERIMENTS, FREE_MONTHLY_TESTS, FREE_MAX_VARIATIONS, FREE_MAX_GOALS, PAID_MAX_VARIATIONS]).toEqual([10_000, 300, 1, 1, 1, 1, 50]);
        expect(p.markdown).toContain('The Free plan covers 10,000 tested visitors a month (up to 300 a day), 1 running test, 1 new test a month, and a control plus 1 variation.');
        expect(p.markdown).toContain('On the Free plan each test has 1 goal, a click on a CSS selector');
        expect(p.markdown).toContain('allow up to 50 variations');
        expect(fs.readFileSync('sdk-src/sdk.js', 'utf8')).toContain('var FLICKER_MS = 800;');
        expect(p.markdown).toContain('at most 0.8 seconds');
    });
    it('links only to live posts, is in the sitemap and RSS, and links to the sample size guide', () => {
        const slugs = new Set(getAllPosts().map((x) => x.slug));
        for (const m of p.markdown.matchAll(/\]\(https:\/\/www\.freeabtest\.com\/blog\/([a-z0-9-]+)\)/g)) expect(slugs.has(m[1])).toBe(true);
        expect(p.markdown).toContain(`](${SIZE})`);
        expect(sitemap().some((e) => e.url === URL)).toBe(true);
        expect(buildRss(getAllPosts())).toContain('/blog/split-url-testing');
    });
    it('posts 02, 03 and 06 link to the sample size guide, dated 29 October 2026 or later', () => {
        for (const slug of ['how-long-to-run-an-ab-test', 'ab-testing-low-traffic', 'statistical-significance-ab-test']) {
            const post = getPost(slug)!;
            expect(post.markdown).toContain(`](${SIZE})`);
            expect(post.updated >= '2026-10-29').toBe(true);
            expect(JSON.parse(post.articleSchema!).dateModified >= '2026-10-29').toBe(true);
        }
        expect(getPost('statistical-significance-ab-test')!.markdown).toContain('Published 25 October 2026. Updated 29 October 2026.');
    });
});
