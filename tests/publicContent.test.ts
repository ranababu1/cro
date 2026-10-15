import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { blockText, buildSearchIndex, docPages } from '@/lib/docs';
import { buildRss, getAllPosts, ldJson, parsePost, renderMarkdown } from '@/lib/blog';

/**
 * Public pages must not reveal how the service is built or run. Internal setup lives in README and docs/*.md only.
 * "Next.js" is allowed only as a planned customer integration, never as our own framework.
 */
const FORBIDDEN: RegExp[] = [
    /sqlite/i, /libsql/i, /turso/i, /drizzle/i, /vercel/i,
    /PLATFORM_ADMIN/, /DATABASE_URL/, /DATABASE_AUTH/, /NEXTAUTH/i, /next-auth/i, /GOOGLE_CLIENT/, /RATE_LIMIT/, /DB_AUTO_MIGRATE/, /\.env\b/,
    /github\.com/i, /self[- ]?host/i, /\/api\/admin/, /admin console/i, /platform admin/i, /\/admin\b/,
    /in[- ]memory/i, /per[- ]server/i, /each instance/i, /your instance/i, /built (with|on) next/i, /next\.js app/i, /sha-?256/i,
    /requests per minute/i, /db:migrate/, /migrations?\b/i,
];

const root = path.join(__dirname, '..');
const publicFiles = [
    'app/page.tsx', 'app/pricing/page.tsx', 'app/pricing/BillingCards.tsx', 'app/roadmap/page.tsx',
    ...fs.readdirSync(path.join(root, 'app/components/landing')).map((f) => `app/components/landing/${f}`),
    ...fs.readdirSync(path.join(root, 'app/docs/_components')).map((f) => `app/docs/_components/${f}`),
    'app/docs/layout.tsx', 'app/docs/page.tsx', 'app/docs/[slug]/page.tsx', 'app/share/[token]/page.tsx', 'lib/shareView.ts', 'app/components/SrmWarning.tsx',
    'app/blog/page.tsx', 'app/blog/[slug]/page.tsx', 'lib/blog.ts',
];

describe('public content hides internals', () => {
    it('docs pages contain no internal terms', () => {
        for (const p of docPages) {
            const text = [p.title, p.description, ...p.blocks.map(blockText)].join('\n');
            for (const re of FORBIDDEN) expect(text, `${p.slug} matches ${re}`).not.toMatch(re);
        }
        const index = JSON.stringify(buildSearchIndex());
        for (const re of FORBIDDEN) expect(index, `search index matches ${re}`).not.toMatch(re);
    });

    it('marketing and docs page sources contain no internal terms', () => {
        for (const f of publicFiles) {
            const src = fs.readFileSync(path.join(root, f), 'utf8');
            for (const re of FORBIDDEN) expect(src, `${f} matches ${re}`).not.toMatch(re);
        }
    });

    it('has no self-hosting or admin docs page', () => {
        const slugs = docPages.map((p) => p.slug);
        expect(slugs).not.toContain('self-hosting');
        expect(slugs.some((s) => s.includes('admin'))).toBe(false);
    });
});

/**
 * The public roadmap may list phases, names and features at a high level. It must not show timelines,
 * effort estimates, technical approach, competitor names or scaling details. Other public pages must not
 * list phase-by-phase plans at all (only /roadmap does).
 */
const ROADMAP_FORBIDDEN: RegExp[] = [
    /\b\d+\s*(to|-)\s*\d+\s*weeks?\b/i, /\b\d+\s*weeks?\b/i, /\b(sprint|milestone|eta|deadline)\b/i, /\bQ[1-4]\s*20\d\d\b/,
    /crazy ?egg/i, /hotjar/i, /optimizely/i, /\bvwo\b/i, /clarity/i, /\bab tasty\b/i,
    /clickhouse/i, /redis/i, /upstash/i, /tinybird/i, /\bqueue\b/i, /rollup/i, /bottleneck/i, /rows (read|written)/i, /scal(ing|ability) (assessment|plan)/i, /events?\/s(ec)?\b/i,
    /technical approach/i, /\bedge (ingest|function)/i,
];

describe('roadmap stays high level', () => {
    const roadmapSrc = fs.readFileSync(path.join(root, 'app/roadmap/page.tsx'), 'utf8');

    it('lists five phases with a status each', () => {
        for (let i = 1; i <= 5; i++) expect(roadmapSrc).toContain(`phase: 'Phase ${i}'`);
        expect(roadmapSrc).toMatch(/status: 'Done'/);
        expect(roadmapSrc).toMatch(/status: 'In progress'/);
    });

    it('roadmap and other public pages show no timelines, competitors or scaling details', () => {
        for (const f of publicFiles) {
            const src = fs.readFileSync(path.join(root, f), 'utf8');
            for (const re of ROADMAP_FORBIDDEN) expect(src, `${f} matches ${re}`).not.toMatch(re);
        }
        for (const p of docPages) {
            const text = [p.title, p.description, ...p.blocks.map(blockText)].join('\n');
            for (const re of ROADMAP_FORBIDDEN) expect(text, `${p.slug} matches ${re}`).not.toMatch(re);
        }
    });

    // The pricing page may tag coming-soon features with their phase ("Coming soon, Phase N"). No timelines either way.
    it('only the roadmap and pricing pages talk about phases', () => {
        for (const f of publicFiles.filter((f) => f !== 'app/roadmap/page.tsx' && f !== 'app/pricing/page.tsx')) {
            const src = fs.readFileSync(path.join(root, f), 'utf8');
            expect(src, f).not.toMatch(/Phase \d/);
        }
        for (const p of docPages) {
            const text = [p.title, p.description, ...p.blocks.map(blockText)].join('\n');
            expect(text, p.slug).not.toMatch(/Phase \d/);
        }
    });
});

/**
 * Blog posts may name competitors and their features (for example a competitor's self-hosted option),
 * but must never reveal our own stack, data store, hosting or admin surface.
 */
const BLOG_FORBIDDEN = FORBIDDEN.filter((re) => !/self/.test(re.source));

describe('blog content', () => {
    const posts = getAllPosts();

    it('every post has a title, description, date, slug and valid JSON-LD', () => {
        expect(posts.length).toBeGreaterThan(0);
        for (const p of posts) {
            expect(p.title, p.slug).toBeTruthy();
            expect(p.description, p.slug).toBeTruthy();
            expect(p.date, p.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(p.slug).toMatch(/^[a-z0-9-]+$/);
            if (p.articleSchema) expect(JSON.parse(p.articleSchema)['@type']).toBe('BlogPosting');
            if (p.faqSchema) expect(JSON.parse(p.faqSchema)['@type']).toBe('FAQPage');
        }
        expect(new Set(posts.map((p) => p.slug)).size).toBe(posts.length);
    });

    it('posts are sorted newest first', () => {
        const dates = posts.map((p) => p.date);
        expect([...dates].sort().reverse()).toEqual(dates);
    });

    it('posts contain no internal terms or em dashes', () => {
        for (const p of posts) {
            const text = [p.title, p.description, p.markdown, p.articleSchema ?? '', p.faqSchema ?? ''].join('\n');
            for (const re of BLOG_FORBIDDEN) expect(text, `${p.slug} matches ${re}`).not.toMatch(re);
            expect(text, `${p.slug} has an em dash`).not.toMatch(/\u2014/);
        }
    });

    it('sanitizes markdown HTML and escapes JSON-LD', () => {
        const html = renderMarkdown('hi <script>alert(1)</script> <img src=x onerror=alert(1)> [x](javascript:alert(1))');
        expect(html).not.toMatch(/<script|onerror|javascript:/i);
        const ld = ldJson(JSON.stringify({ a: '</script><script>alert(1)</script>' }));
        expect(ld).not.toContain('<');
        expect(JSON.parse(ld).a).toBe('</script><script>alert(1)</script>');
        expect(buildRss([parsePost('x.md', '---\ntitle: "A <b>&"\ndate: 2026-01-01\n---\nbody')])).not.toContain('<b>');
    });
});

/**
 * freeabtest.com is a hosted-only service and is never self-hostable or open source. Non-blog pages
 * (home, pricing, FAQ, docs, roadmap, metadata and OpenGraph in the root layout, header and footer)
 * must not offer or imply a self-hosted or open-source option, and must not contrast "hosted" with
 * self-hosting. Blog posts are exempt because they may describe competitors that self-host.
 */
const HOSTING_FORBIDDEN: RegExp[] = [
    /self[- ]?host/i, /self[- ]?managed/i, /self[- ]?install/i, /open[- ]?source/i, /\bOSS\b/, /on[- ]?prem/i,
    /\bhosted\b/i, /\bhost (it|your own)\b/i, /your own (server|infrastructure|cloud)/i, /run it yourself/i, /source code/i,
];

describe('hosted-only copy on non-blog pages', () => {
    const files = [...publicFiles, 'app/layout.tsx', 'public/demo.html'];

    it('page sources, metadata and chrome never imply self-hosting or open source', () => {
        for (const f of files) {
            const src = fs.readFileSync(path.join(root, f), 'utf8');
            for (const re of HOSTING_FORBIDDEN) expect(src, `${f} matches ${re}`).not.toMatch(re);
        }
    });

    it('docs pages and search index never imply self-hosting or open source', () => {
        for (const p of docPages) {
            const text = [p.title, p.description, ...p.blocks.map(blockText)].join('\n');
            for (const re of HOSTING_FORBIDDEN) expect(text, `${p.slug} matches ${re}`).not.toMatch(re);
        }
        const index = JSON.stringify(buildSearchIndex());
        for (const re of HOSTING_FORBIDDEN) expect(index, `search index matches ${re}`).not.toMatch(re);
    });

    it('catches the phrasing it is meant to block', () => {
        const hit = (t: string) => HOSTING_FORBIDDEN.some((re) => re.test(t));
        expect(hit('Developers who want hosted, code-first testing')).toBe(true);
        expect(hit('A self-hosted platform')).toBe(true);
        expect(hit('Open source and free')).toBe(true);
        expect(hit('Developers who want code-first testing')).toBe(false);
    });
});
