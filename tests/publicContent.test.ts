import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { blockText, buildSearchIndex, docPages } from '@/lib/docs';

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
    'app/page.tsx', 'app/pricing/page.tsx', 'app/roadmap/page.tsx',
    ...fs.readdirSync(path.join(root, 'app/components/landing')).map((f) => `app/components/landing/${f}`),
    ...fs.readdirSync(path.join(root, 'app/docs/_components')).map((f) => `app/docs/_components/${f}`),
    'app/docs/layout.tsx', 'app/docs/page.tsx', 'app/docs/[slug]/page.tsx',
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

    it('only the roadmap page talks about phases', () => {
        for (const f of publicFiles.filter((f) => f !== 'app/roadmap/page.tsx')) {
            const src = fs.readFileSync(path.join(root, f), 'utf8');
            expect(src, f).not.toMatch(/Phase \d/);
        }
        for (const p of docPages) {
            const text = [p.title, p.description, ...p.blocks.map(blockText)].join('\n');
            expect(text, p.slug).not.toMatch(/Phase \d/);
        }
    });
});
