import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { useTempDatabase } from './helpers';
import { db } from '@/lib/db';
import { getDb } from '@/lib/db/client';
import { retentionCutoffs } from '@/lib/retention';

const plan = async (q: ReturnType<typeof sql>) => (await (await getDb()).all<{ detail: string }>(sql`EXPLAIN QUERY PLAN ${q}`)).map((r) => r.detail).join(' | ');

describe('hot path query plans', () => {
    let cleanup: () => void;
    beforeAll(async () => {
        cleanup = useTempDatabase();
        await db.getProject('none'); // runs migrations
    });
    afterAll(() => cleanup());

    it('reads popup and survey counts through the project, not every row in the date range', async () => {
        const p = await plan(sql`select pd.popup_id, pd.metric, sum(pd.count) from popup_daily pd join popups p on p.id = pd.popup_id where p.project_id = 'p' and pd.day >= '2026-01-01' and pd.day <= '2026-01-30' group by 1, 2`);
        expect(p).toContain('idx_popup_daily_popup');
        const s = await plan(sql`select sd.survey_id, sd.metric, sum(sd.count) from survey_daily sd join surveys s on s.id = sd.survey_id where s.project_id = 'p' and sd.day >= '2026-01-01' and sd.day <= '2026-01-30' group by 1, 2`);
        expect(s).toContain('idx_survey_daily_survey');
    });

    it('cleanup reads old rows through the date index instead of scanning the table', async () => {
        const a = await plan(sql`select a.id from audit_log a join organizations o on o.id = a.org_id where a.created_at < '2026-01-01' and a.created_at < case coalesce(lower(o.plan), 'free') when 'free' then '2026-01-01' else '2025-01-01' end limit 5000`);
        expect(a).toContain('idx_audit_created');
        expect(a).not.toMatch(/SCAN a\b/);
        const r = await plan(sql`select r.id from survey_responses r join surveys sv on sv.id = r.survey_id join projects p on p.id = sv.project_id join organizations o on o.id = p.org_id where r.day < '2026-01-01' and r.day < case lower(o.plan) when 'free' then '2026-01-01' else '2025-01-01' end limit 5000`);
        expect(r).toContain('idx_survey_responses_day');
    });

    it('the shared prefilter is the newest per-plan cutoff, so no plan loses rows early', () => {
        const c = retentionCutoffs(new Date('2026-10-19T00:00:00Z'));
        expect(Object.values(c.auditBefore).every((v) => v <= c.auditBefore.free)).toBe(true);
        expect(Object.values(c.surveyBefore).every((v) => v <= c.surveyBefore.free)).toBe(true);
    });
});

describe('site script caching', () => {
    it('lets browsers reuse the site scripts for a few minutes', async () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const rules = await require(process.cwd() + '/next.config.js').headers();
        const r = rules.find((x: { source: string }) => x.source.includes('sdk|heatmap'));
        expect(r.headers[0].value).toBe('public, max-age=300, stale-while-revalidate=86400');
    });
});
