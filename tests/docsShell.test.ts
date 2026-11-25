import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { blockText, docPages, getDocPage } from '@/lib/docs';
import { FOOTER_COLUMNS, NAV_MENUS } from '@/app/components/site/nav';
import { INTEGRATIONS } from '@/lib/site/developers';
import sitemap from '@/app/sitemap';
import { checkHref } from './helpers/links';

const read = (f: string) => fs.readFileSync(f, 'utf8');
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(tsx?|md)$/.test(e.name) ? [p] : [];
});

describe('docs: JavaScript SDK address', () => {
    it('the SDK page lives at /docs/javascript-sdk and the old address redirects with a 301', async () => {
        expect(getDocPage('javascript-sdk')?.title).toBe('JavaScript SDK');
        expect(getDocPage('sdk')).toBeUndefined();
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const config = require('../next.config.js');
        const rules = await config.redirects();
        expect(rules).toContainEqual(expect.objectContaining({ source: '/docs/sdk', destination: '/docs/javascript-sdk', statusCode: 301 }));
    });

    it('nothing links to the old address any more', () => {
        const files = ['app', 'lib', 'content', 'sdk-src', 'integrations'].flatMap((d) => (fs.existsSync(d) ? walk(d) : []));
        const stale = files.filter((f) => /\/docs\/sdk\b/.test(read(f)));
        expect(stale).toEqual([]);
    });
});

describe('docs: integrations page', () => {
    const page = getDocPage('integrations')!;
    const text = page.blocks.map(blockText).join('\n');
    const links = [...text.matchAll(/\]\((\/[^)]+)\)/g)].map((m) => m[1]);

    it('is in the docs, the menu and the footer', () => {
        expect(page.group).toBe('Getting started');
        const items = NAV_MENUS.flatMap((m) => m.groups.flatMap((g) => g.items));
        expect(items.find((i) => i.title === 'Integrations')?.href).toBe('/docs/integrations');
        expect(FOOTER_COLUMNS.flatMap((c) => c.links).find((l) => l.title === 'Integrations')?.href).toBe('/docs/integrations');
        expect(read('app/developers/page.tsx')).toContain('href="/docs/integrations"');
    });

    it('every link goes to a page or heading that exists', () => {
        expect(links.length).toBeGreaterThan(10);
        expect(links.map(checkHref).filter(Boolean)).toEqual([]);
    });

    it('plans match the pages they point to', () => {
        const table = page.blocks.find((b) => b.type === 'table');
        if (table?.type !== 'table') throw new Error('no table');
        const plan = (name: string) => table.rows.find((r) => r[0] === name)![2];
        expect(plan('Webhooks')).toBe('Paid plans');
        expect(blockText(getDocPage('webhooks')!.blocks[0])).toContain('part of the paid plans');
        expect(plan('WordPress')).toBe('Plugin on paid plans');
        expect(getDocPage('install-guides')!.blocks.map(blockText).join(' ')).toContain('The plugin is available to paid users only.');
        expect(plan('AI providers')).toBe('Growth and Enterprise');
        const ai = blockText(getDocPage('ai')!.blocks[0]);
        expect(ai).toContain('Growth and Enterprise plans');
        for (const v of ['OpenAI', 'Google Gemini', 'DeepSeek', 'Claude']) expect(ai).toContain(v);
        for (const n of ['Google Tag Manager', 'Google Analytics 4', 'Single-page apps', 'Your backend', 'REST API']) expect(plan(n)).toBe('Every plan');
        for (const i of INTEGRATIONS) expect(table.rows.some((r) => r[0] === i.title), i.title).toBe(true);
    });

    it('claims nothing that is not built', () => {
        expect(text).toMatch(/no npm or React package yet/);
        expect(text).not.toMatch(/shopify|zapier|slack app|segment integration|—/i);
    });
});

describe('docs shell', () => {
    it('uses the site header, footer and tokens', () => {
        const layout = read('app/docs/layout.tsx');
        expect(layout).toContain('<SiteHeader />');
        expect(layout).toContain('<SiteFooter />');
        for (const f of ['Blocks', 'DocArticle', 'DocsNav', 'DocsSearch', 'Inline', 'Toc']) {
            expect(read(`app/docs/_components/${f}.tsx`), f).not.toMatch(/\b(zinc|brand|violet|sky)-\d/);
        }
        expect(layout).not.toMatch(/\b(zinc|brand)-\d/);
    });

    it('the sitemap lists every docs page', () => {
        const urls = sitemap().map((e) => e.url);
        for (const p of docPages.filter((d) => d.slug !== 'introduction')) expect(urls, p.slug).toContain(`https://www.freeabtest.com/docs/${p.slug}`);
        expect(urls).toContain('https://www.freeabtest.com/docs');
    });
});
