import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { buildRss, getAllPosts, getPost } from '@/lib/blog';
import sitemap from '@/app/sitemap';
import { calculateConfidenceInterval, normalCDF } from '@/lib/statistics';
import { upliftInterval } from '@/lib/liveStats';
import { FREE_MONTHLY_VISITORS } from '@/lib/plans';

const URL = 'https://www.freeabtest.com/blog/confidence-interval-ab-test';
const PEEKING = 'https://www.freeabtest.com/blog/ab-test-peeking-problem';
const Z = 1.959964;

function wilson(c: number, n: number): [number, number] {
    const p = c / n, d = 1 + (Z * Z) / n;
    const centre = (p + (Z * Z) / (2 * n)) / d;
    const half = (Z * Math.sqrt((p * (1 - p)) / n + (Z * Z) / (4 * n * n))) / d;
    return [centre - half, centre + half];
}
/** Newcombe hybrid score difference (points) and Katz log lift (percent), as in the article. */
function compare(c1: number, n1: number, c2: number, n2: number) {
    const p1 = c1 / n1, p2 = c2 / n2;
    const [l1, u1] = wilson(c1, n1), [l2, u2] = wilson(c2, n2);
    const d = p2 - p1;
    const diff = [d - Math.sqrt((p2 - l2) ** 2 + (u1 - p1) ** 2), d + Math.sqrt((u2 - p2) ** 2 + (p1 - l1) ** 2)];
    const se = Math.sqrt((1 - p2) / (p2 * n2) + (1 - p1) / (p1 * n1));
    const r = p2 / p1;
    return { diff: diff.map((x) => x * 100), lift: [r * Math.exp(-Z * se) - 1, r * Math.exp(Z * se) - 1].map((x) => x * 100) };
}
function pooledP(c1: number, n1: number, c2: number, n2: number) {
    const p = (c1 + c2) / (n1 + n2);
    const z = (c2 / n2 - c1 / n1) / Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
    return 2 * (1 - normalCDF(Math.abs(z)));
}

describe('post: why a confidence interval beats a single winner number', () => {
    const p = getPost('confidence-interval-ab-test')!;
    it('exists, dated 3 November 2026, with BlogPosting, BreadcrumbList and FAQPage JSON-LD', () => {
        expect(p).toBeTruthy();
        expect(p.date).toBe('2026-11-03');
        const article = JSON.parse(p.articleSchema!);
        expect(article).toMatchObject({ '@type': 'BlogPosting', mainEntityOfPage: URL });
        expect(article.dateModified >= '2026-11-03').toBe(true);
        expect(JSON.parse(p.breadcrumbSchema!).itemListElement).toHaveLength(3);
        expect(JSON.parse(p.faqSchema!).mainEntity.length).toBe(6);
        expect(p.markdown).toContain('```js');
        expect(p.markdown).not.toContain('\u2014');
        expect(p.markdown).not.toMatch(/\bPhase \d|roadmap|session recording|self-host/i);
    });
    it('the sample size table matches the Newcombe and Katz calculation', () => {
        const rows: [number, string, string, string][] = [
            [1000, '0.45', '-0.99 to 2.21 points', '-25% to 93%'],
            [2500, '0.24', '-0.40 to 1.60 points', '-11% to 62%'],
            [5000, '0.09', '-0.10 to 1.31 points', '-3% to 49%'],
            [10000, '0.018', '0.10 to 1.10 points', '3% to 40%'],
            [20000, '0.0008', '0.25 to 0.95 points', '8% to 33%'],
        ];
        for (const [n, pv, diff, lift] of rows) {
            const r = compare(0.03 * n, n, 0.036 * n, n);
            expect(`${r.diff[0].toFixed(2)} to ${r.diff[1].toFixed(2)} points`).toBe(diff);
            expect(`${Math.round(r.lift[0])}% to ${Math.round(r.lift[1])}%`).toBe(lift);
            expect(Number(pooledP(0.03 * n, n, 0.036 * n, n).toPrecision(pv.replace(/^0\.0*/, '').length))).toBe(Number(pv));
            expect(p.markdown).toContain(`| ${n.toLocaleString('en-US')} | ${pv} | ${diff} | ${lift} |`);
        }
        const flat = compare(3000, 100000, 3030, 100000);
        expect(flat.lift.map((x) => x.toFixed(1))).toEqual(['-3.9', '6.1']);
        expect(pooledP(300, 10000, 360, 10000).toFixed(4)).toBe('0.0175');
    });
    it('Wilson figures match the shipped interval', () => {
        const ci = calculateConfidenceInterval(50, 1000);
        expect([(ci.lower * 100).toFixed(2), (ci.upper * 100).toFixed(2)]).toEqual(['3.81', '6.53']);
        expect(wilson(300, 10000).map((x) => (x * 100).toFixed(2))).toEqual(['2.68', '3.35']);
        expect(wilson(360, 10000).map((x) => (x * 100).toFixed(2))).toEqual(['3.25', '3.98']);
        const docs = fs.readFileSync('lib/docs/content/results.ts', 'utf8');
        expect(docs).toContain('50 conversions from 1,000 visitors gives 5.0% with an interval of about 3.8% to 6.5%');
        expect(docs).toContain('Overlapping intervals do not prove there is no difference');
    });
    it('describes the lift interval the app shows', () => {
        const u = upliftInterval(300, 10000, 360, 10000)!;
        expect([(u.lower * 100).toFixed(1), (u.upper * 100).toFixed(1)]).toEqual(['3.5', '36.6']);
        expect(p.markdown).toContain('about 3.5% to 36.6% instead of 3% to 40%');
        expect(fs.readFileSync('app/(app)/experiments/[id]/LiveStats.tsx', 'utf8')).toContain('Uplift is relative to the control with a 95% interval.');
        expect(p.markdown).not.toContain('It does not list an interval for the lift itself');
        expect(FREE_MONTHLY_VISITORS).toBe(10_000);
        expect(p.markdown).toContain('allows 10,000 tested visitors a month');
    });
    it('links only to live posts, is in the sitemap and RSS', () => {
        const slugs = new Set(getAllPosts().map((x) => x.slug));
        for (const m of p.markdown.matchAll(/\]\(https:\/\/www\.freeabtest\.com\/blog\/([a-z0-9-]+)\)/g)) expect(slugs.has(m[1])).toBe(true);
        expect(p.markdown).toContain(`](${PEEKING})`);
        expect(sitemap().some((e) => e.url === URL)).toBe(true);
        expect(buildRss(getAllPosts())).toContain('/blog/confidence-interval-ab-test');
    });
    it('posts 02, 04, 06 and 07 link to the peeking problem post, dated 3 November 2026 or later', () => {
        for (const slug of ['how-long-to-run-an-ab-test', 'ab-test-javascript', 'statistical-significance-ab-test', 'ab-test-sample-size']) {
            const post = getPost(slug)!;
            expect(post.markdown).toContain(`](${PEEKING})`);
            expect(post.updated >= '2026-11-03').toBe(true);
            expect(JSON.parse(post.articleSchema!).dateModified >= '2026-11-03').toBe(true);
            expect(post.markdown).not.toMatch(/\/roadmap|\bPhase \d/);
        }
        expect(getPost('statistical-significance-ab-test')!.markdown).not.toContain('A separate article on the peeking problem is planned.');
        expect(getPost('how-long-to-run-an-ab-test')!.markdown).toContain('](/blog/ab-test-javascript)');
    });
});
