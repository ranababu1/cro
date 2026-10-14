import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { blockText, buildSearchIndex, docPages, getDocPage, tocFor } from '@/lib/docs';

const allText = (slug: string) => getDocPage(slug)!.blocks.map(blockText).join('\n') + getDocPage(slug)!.description;

describe('in-app docs', () => {
    it('has unique slugs and covers every required section', () => {
        const slugs = docPages.map((p) => p.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
        for (const s of ['introduction', 'quick-start', 'sdk', 'experiments', 'variations', 'goals', 'results', 'choosing-a-winner', 'rest-api', 'environments-and-keys', 'organizations-and-projects', 'troubleshooting']) {
            expect(getDocPage(s), s).toBeDefined();
        }
    });

    it('has unique heading ids on each page', () => {
        for (const p of docPages) {
            const ids = tocFor(p).map((t) => t.id);
            expect(new Set(ids).size, p.slug).toBe(ids.length);
        }
    });

    it('uses plain copy with no em dashes and never links to the GitHub README', () => {
        for (const p of docPages) {
            const text = allText(p.slug);
            expect(text, p.slug).not.toMatch(/\u2014/);
            expect(text, p.slug).not.toMatch(/#readme/i);
        }
    });

    it('internal doc links point at real pages and headings', () => {
        for (const p of docPages) {
            for (const m of allText(p.slug).matchAll(/\]\((\/docs\/[^)#]+)(?:#([^)]+))?\)/g)) {
                const target = getDocPage(m[1].replace('/docs/', ''));
                expect(target, `${p.slug} -> ${m[1]}`).toBeDefined();
                if (m[2]) expect(tocFor(target!).map((t) => t.id), `${p.slug} -> ${m[1]}#${m[2]}`).toContain(m[2]);
            }
        }
    });

    it('states limits that match the code', () => {
        const validation = fs.readFileSync(path.join(__dirname, '../lib/validation.ts'), 'utf8');
        expect(validation).toMatch(/\.max\(26\)/);
        expect(allText('variations')).toMatch(/up to 26/);
        expect(fs.readFileSync(path.join(__dirname, '../app/api/track/route.ts'), 'utf8')).toMatch(/MAX_METADATA_BYTES = 4096/);
        expect(fs.readFileSync(path.join(__dirname, '../lib/statistics.ts'), 'utf8')).toMatch(/minSampleSize = 100/);
    });

    it('builds a search index with an entry per section', () => {
        const index = buildSearchIndex();
        expect(index.length).toBeGreaterThan(docPages.length * 3);
        expect(index.some((e) => e.href === '/docs/sdk#flicker')).toBe(true);
    });
});
