import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { getDb } from '@/lib/db/client';
import { retentionCutoffs, runRetention, scheduleRetention, resetRetentionThrottle, SURVEY_RETENTION_DAYS, RETENTION_JOB } from '@/lib/retention';
import { POST as createExperiment } from '@/app/api/experiments/route';

const json = (method: string, url: string, body?: unknown) =>
    new NextRequest(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' }, body: body === undefined ? undefined : JSON.stringify(body) });
const NOW = new Date('2027-06-15T12:00:00.000Z');
const dayBefore = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString().slice(0, 10);

describe('retention cleanup', () => {
    let cleanup: () => void;
    const surveys: Record<string, string> = {};
    let expId = '';
    beforeAll(async () => {
        cleanup = useTempDatabase();
        for (const plan of ['free', 'starter', 'growth', 'enterprise', 'custom-paid']) {
            const u = await db.createUser({ email: `${plan}@example.com`, name: plan });
            const ws = await db.ensureWorkspace(u);
            await db.updateOrganization(ws.orgId, { plan });
            await seedProjectDomain(ws.projectId, 'localhost');
            const sv = await db.createSurvey({ project_id: ws.projectId, name: plan, status: 'active', config: JSON.stringify({ question: 'q', type: 'text' }) });
            surveys[plan] = sv.id;
            // One answer just inside and one just outside each retention window, plus one from today.
            const keep = SURVEY_RETENTION_DAYS[plan as keyof typeof SURVEY_RETENTION_DAYS] ?? SURVEY_RETENTION_DAYS.starter;
            await db.bumpTelemetryBatch([], [], [], [], [], [
                { day: dayBefore(keep - 1), survey_id: sv.id, answer: 'inside', comment: null, path: '/' },
                { day: dayBefore(keep + 1), survey_id: sv.id, answer: 'outside', comment: null, path: '/' },
                { day: NOW.toISOString().slice(0, 10), survey_id: sv.id, answer: 'today', comment: null, path: '/' },
            ]);
            if (plan === 'starter') {
                session.current = { user: { id: u.id } };
                expId = (await (await createExperiment(json('POST', '/api/experiments', flowExperimentBody()))).json()).experiment.id;
            }
        }
        const d = await getDb();
        for (const [selector, at] of [['old', '2027-05-01T00:00:00.000Z'], ['new', '2027-06-01T00:00:00.000Z']]) {
            await d.run(sql`insert into heatmap_points (org_id, experiment_id, variation_id, device, x, y, selector, created_at) values ('o', ${expId}, 'v', 'desktop', 1, 1, ${selector}, ${at})`);
        }
    });
    afterAll(() => cleanup());

    const answers = async (plan: string) => (await db.getSurveyResponses(surveys[plan], '2000-01-01', '2100-01-01', { limit: 10 })).map((r) => r.answer).sort();

    it('matches the pricing data retention: 6, 12 and 24 months', () => {
        expect(SURVEY_RETENTION_DAYS).toEqual({ free: 183, starter: 365, growth: 730, enterprise: 730 });
        const c = retentionCutoffs(NOW);
        expect(c.heatmapBefore).toBe('2027-05-16T12:00:00.000Z');
        expect(c.surveyBefore.starter).toBe('2026-06-15');
    });

    it('deletes old survey answers by plan and raw clicks past 30 days, at most once an hour', async () => {
        const r = await runRetention(NOW);
        expect(r).toEqual({ heatmapPoints: 1, heatmapScrolls: 0, surveyAnswers: 5, auditEntries: 4 }); // NOW is months ahead, so the setup audit entries of the four orgs are past their period
        for (const plan of Object.keys(surveys)) expect(await answers(plan), plan).toEqual(['inside', 'today']);
        const d = await getDb();
        expect((await d.all<{ selector: string }>(sql`select selector from heatmap_points`)).map((p) => p.selector)).toEqual(['new']);
        // Another instance in the same hour does nothing; an hour later it runs again.
        expect(await runRetention(new Date(NOW.getTime() + 30 * 60_000))).toBeNull();
        expect(await runRetention(new Date(NOW.getTime() + 61 * 60_000))).toEqual({ heatmapPoints: 0, heatmapScrolls: 0, surveyAnswers: 0, auditEntries: 0 });
        const runs = await d.all<{ job: string }>(sql`select job from maintenance_runs`);
        expect(runs.map((x) => x.job)).toEqual([RETENTION_JOB]);
    });

    it('only one of many concurrent callers claims the run', async () => {
        const at = new Date(NOW.getTime() + 3 * 3_600_000);
        const results = await Promise.all(Array.from({ length: 8 }, () => runRetention(at)));
        expect(results.filter((x) => x !== null)).toHaveLength(1);
    });

    it('throttles the per-request check on each instance', async () => {
        resetRetentionThrottle();
        const spy = vi.spyOn(db, 'claimMaintenance');
        scheduleRetention(1_000_000);
        scheduleRetention(1_000_000 + 60_000);
        await new Promise((r) => setTimeout(r, 50));
        expect(spy).toHaveBeenCalledTimes(1);
        scheduleRetention(1_000_000 + 11 * 60_000);
        await new Promise((r) => setTimeout(r, 50));
        expect(spy).toHaveBeenCalledTimes(2);
        spy.mockRestore();
    });
});
