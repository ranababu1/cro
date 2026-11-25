import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { docPages } from '@/lib/docs';
import { renderMarkdown } from '@/lib/blog';
import { SOLUTIONS } from '@/lib/site/solutions';
import { OG_IMAGE, pageMetadata } from '@/lib/site/meta';

const read = (f: string) => fs.readFileSync(f, 'utf8');
const EXCLUDED = ['invite', 'onboarding', 'share', 'signin'];

/** Every static public page route under app/ (no signed-in app, admin, token links or sign-in). */
function publicRoutes(dir = 'app', prefix = ''): string[] {
    const out: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        if (e.name.startsWith('(') || e.name.startsWith('_') || e.name.startsWith('[') || ['admin', 'api', 'components', ...EXCLUDED].includes(e.name)) continue;
        const sub = path.join(dir, e.name);
        if (fs.existsSync(path.join(sub, 'page.tsx'))) out.push(`${prefix}/${e.name}`);
        out.push(...publicRoutes(sub, `${prefix}/${e.name}`));
    }
    return out;
}
const routes = publicRoutes();
const fileFor = (r: string) => `app${r}/page.tsx`;

describe('SEO: metadata on every public page', () => {
    it('finds the public routes', () => {
        expect(routes.length).toBeGreaterThanOrEqual(28);
        for (const r of ['/pricing', '/faq', '/legal/terms', '/solutions/saas', '/wordpress']) expect(routes).toContain(r);
    });

    it('every public page sets title, description, canonical, Open Graph and X metadata through pageMetadata', () => {
        for (const r of routes) {
            const src = read(fileFor(r));
            if (r.startsWith('/solutions/')) { expect(read('app/solutions/SolutionPage.tsx')).toContain('pageMetadata({ path: `/solutions/${slug}`'); continue; }
            expect(src, r).toContain('pageMetadata(');
            expect(src, r).toContain(`path: '${r}'`);
        }
        expect(read('app/docs/[slug]/page.tsx')).toContain('pageMetadata({ path: `/docs/${page.slug}`');
        expect(read('app/page.tsx')).toMatch(/canonical: `\$\{SITE_URL\}\/`/);
        expect(read('app/blog/[slug]/page.tsx')).toContain('alternates: { canonical: url }');
    });

    it('titles fit in search results and descriptions are 70 to 160 characters', () => {
        const SUFFIX = ' · freeabtest.com'.length;
        for (const r of routes) {
            const src = read(fileFor(r));
            const m = src.match(/pageMetadata\(\{\s*path: '[^']+',\s*title: '((?:[^'\\]|\\.)*)',\s*description: '((?:[^'\\]|\\.)*)'/);
            if (!m) continue;
            expect(m[1].length + SUFFIX, `${r} title`).toBeLessThanOrEqual(70);
            expect(m[2].length, `${r} description`).toBeGreaterThanOrEqual(70);
            expect(m[2].length, `${r} description`).toBeLessThanOrEqual(160);
        }
        for (const s of SOLUTIONS) {
            expect(s.metaTitle.length + SUFFIX, s.slug).toBeLessThanOrEqual(70);
            expect(s.metaDescription.length, s.slug).toBeLessThanOrEqual(160);
        }
        for (const p of docPages) {
            expect(p.description.length, p.slug).toBeGreaterThanOrEqual(70);
            expect(p.description.length, p.slug).toBeLessThanOrEqual(160);
        }
    });

    it('share image: a 1200 x 630 PNG on every page, with metadataBase set', () => {
        const png = fs.readFileSync('public/og-default.png');
        expect(png.readUInt32BE(16)).toBe(1200);
        expect(png.readUInt32BE(20)).toBe(630);
        const m = pageMetadata({ path: '/x', title: 'X', description: 'y' });
        expect(m.openGraph?.images).toEqual([OG_IMAGE]);
        expect(m.twitter).toMatchObject({ card: 'summary_large_image' });
        const layout = read('app/layout.tsx');
        expect(layout).toContain('metadataBase: new URL(SITE_URL)');
        expect(layout).toContain('images: [OG_IMAGE]');
        expect(read('app/blog/[slug]/page.tsx')).toContain('images: [OG_IMAGE]');
    });

    it('metadata is rendered in the head for every client', () => {
        expect(read('next.config.js')).toContain('htmlLimitedBots: /.*/');
    });

    it('the sitemap lists every public page, and robots keeps the app out', () => {
        const sitemap = read('app/sitemap.ts');
        for (const r of routes) expect(sitemap, r).toContain(`'${r}'`);
        const robots = read('app/robots.ts');
        for (const d of ['/api/', '/dashboard', '/settings', '/share/', '/invite/', '/admin']) expect(robots).toContain(`'${d}'`);
    });

    it('the homepage has Organization and WebSite structured data', () => {
        const home = read('app/page.tsx');
        expect(home).toContain("'@type': 'WebSite'");
        expect(home).toContain('organizationJsonLd()');
    });
});

describe('accessibility basics', () => {
    it('a skip link leads to the main landmark on every public layout', () => {
        expect(read('app/components/site/SiteHeader.tsx')).toMatch(/<a href="#main"[^>]*>Skip to content<\/a>/);
        for (const f of ['app/components/site/SitePage.tsx', 'app/page.tsx', 'app/pricing/page.tsx', 'app/blog/page.tsx', 'app/blog/[slug]/page.tsx', 'app/legal/LegalDoc.tsx', 'app/wordpress/page.tsx', 'app/docs/layout.tsx', 'app/signin/page.tsx']) {
            expect(read(f), f).toMatch(/<main id="main"/);
        }
    });

    it('scrollable code and tables can be reached with the keyboard', () => {
        for (const f of ['app/components/site/CodeBlock.tsx', 'app/page.tsx', 'app/statistical-methodology/page.tsx']) expect(read(f), f).toMatch(/<pre tabIndex=\{0\}/);
        const html = renderMarkdown('| | A | B |\n|---|---|---|\n| x | 1 | 2 |\n\n```js\nconst a = 1;\n```\n\n| C | D |\n|---|---|\n| 1 | 2 |\n');
        expect(html).toContain('<pre tabindex="0">');
        expect(html).toContain('aria-label="Table 1"');
        expect(html).toContain('aria-label="Table 2"');
        expect(html).not.toMatch(/<th( align="[a-z]+")?><\/th>/);
        for (const f of ['app/legal/cookies/page.tsx', 'app/legal/privacy/page.tsx']) expect(read(f), f).not.toContain('<table>');
    });

    it('docs landmarks are labelled', () => {
        const docs = read('app/docs/layout.tsx');
        expect(docs).toContain('aria-label="Documentation pages"');
        expect(docs).toContain('aria-label="Documentation tools"');
    });
});
