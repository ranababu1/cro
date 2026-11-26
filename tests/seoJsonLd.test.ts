import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SITE_URL } from '@/lib/blog';
import { getAllPosts } from '@/lib/blog';
import { organizationJsonLd } from '@/lib/legal';
import { ORGANIZATION_ID, WEBSITE_ID, breadcrumbListNode, faqPageNode, parseSchema, siteGraph } from '@/lib/site/jsonLd';

const root = path.join(__dirname, '..');

function walk(dir: string, acc: string[] = []): string[] {
    for (const name of fs.readdirSync(dir)) {
        if (name === 'node_modules' || name === '(app)') continue;
        const p = path.join(dir, name);
        const st = fs.statSync(p);
        if (st.isDirectory()) walk(p, acc);
        else if (name.endsWith('.tsx') || name.endsWith('.ts')) acc.push(p);
    }
    return acc;
}

describe('JSON-LD graph helper', () => {
    it('always includes Organization and WebSite with stable @id references', () => {
        const graph = siteGraph();
        expect(graph['@context']).toBe('https://schema.org');
        expect(graph['@graph']).toHaveLength(2);
        const [org, site] = graph['@graph'];
        expect(org).toMatchObject({ ...organizationJsonLd(), '@id': ORGANIZATION_ID, '@type': 'Organization' });
        expect(site).toEqual({
            '@type': 'WebSite',
            '@id': WEBSITE_ID,
            url: `${SITE_URL}/`,
            name: 'freeabtest.com',
            publisher: { '@id': ORGANIZATION_ID },
        });
        expect(ORGANIZATION_ID).toBe(`${SITE_URL}/#organization`);
        expect(WEBSITE_ID).toBe(`${SITE_URL}/#website`);
    });

    it('merges page-specific nodes and folds a second Organization into the same @id', () => {
        const graph = siteGraph([
            faqPageNode([{ q: 'Q?', a: 'A.' }], `${SITE_URL}/faq`),
            breadcrumbListNode([{ href: '/faq', label: 'FAQ' }]),
            { '@type': 'Organization', '@id': ORGANIZATION_ID, contactPoint: { '@type': 'ContactPoint', email: 'hello@freeabtest.com' } },
        ]);
        const types = graph['@graph'].map((n) => n['@type']);
        expect(types).toEqual(['Organization', 'WebSite', 'FAQPage', 'BreadcrumbList']);
        const org = graph['@graph'][0] as { contactPoint?: { email?: string } };
        expect(org.contactPoint?.email).toBe('hello@freeabtest.com');
        const faq = graph['@graph'][2] as { mainEntity: unknown[] };
        expect(faq.mainEntity).toHaveLength(1);
        expect(JSON.stringify(graph['@graph'])).not.toContain('@context');
    });

    it('parses blog frontmatter schemas, including @graph wrappers, into nodes', () => {
        for (const p of getAllPosts()) {
            const nodes = [
                ...parseSchema(p.articleSchema),
                ...parseSchema(p.faqSchema),
                ...parseSchema(p.breadcrumbSchema),
                ...parseSchema(p.howtoSchema),
                ...parseSchema(p.itemListSchema),
            ];
            const graph = siteGraph(nodes);
            expect(graph['@graph'][0]['@type']).toBe('Organization');
            expect(graph['@graph'][1]['@type']).toBe('WebSite');
            const types = new Set(graph['@graph'].map((n) => n['@type']));
            expect(types.has('BlogPosting') || types.has('Article')).toBe(true);
            if (p.faqSchema) expect(types.has('FAQPage')).toBe(true);
            for (const n of graph['@graph']) {
                expect(n['@type'], p.slug).toBeTruthy();
                expect(n).not.toHaveProperty('@context');
            }
        }
    });
});

describe('one JSON-LD script per public page', () => {
    const files = walk(path.join(root, 'app')).map((f) => path.relative(root, f));

    it('only JsonLd.tsx emits an ld+json script, and Breadcrumbs does not', () => {
        const emitters = files.filter((f) => fs.readFileSync(path.join(root, f), 'utf8').includes('application/ld+json'));
        expect(emitters).toEqual(['app/components/site/JsonLd.tsx']);
        expect(fs.readFileSync('app/components/site/Breadcrumbs.tsx', 'utf8')).not.toContain('application/ld+json');
    });

    it('public page files render at most one JsonLd', () => {
        const pageFiles = files.filter((f) => f.endsWith('page.tsx') || f.endsWith('layout.tsx') || f.endsWith('LegalDoc.tsx') || f.endsWith('SitePage.tsx') || f.endsWith('SolutionPage.tsx'));
        for (const f of pageFiles) {
            const src = fs.readFileSync(path.join(root, f), 'utf8');
            const count = (src.match(/<JsonLd\b/g) ?? []).length;
            expect(count, f).toBeLessThanOrEqual(1);
            expect(src.match(/application\/ld\+json/g)?.length ?? 0, f).toBe(0);
        }
        expect(fs.readFileSync('app/components/site/SitePage.tsx', 'utf8')).toContain('<JsonLd');
        expect(fs.readFileSync('app/page.tsx', 'utf8')).toContain('<JsonLd');
        expect(fs.readFileSync('app/faq/page.tsx', 'utf8')).toContain('faqPageNode');
        expect(fs.readFileSync('app/pricing/page.tsx', 'utf8')).toContain('faqPageNode');
        expect(fs.readFileSync('app/blog/[slug]/page.tsx', 'utf8')).toContain('parseSchema');
    });
});
