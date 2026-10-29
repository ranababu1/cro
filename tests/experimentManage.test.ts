import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody, makePaid, resetFreeTestUsage } from './helpers';
import {
    tagsSchema, parseTags, serializeTags, noteOrNull, canArchive, archiveError, copyName, filterExperiments, allTags, ideaExpectedOutcome, MAX_TAGS,
} from '@/lib/experimentManage';
import { rolloutVariation } from '@/lib/rollout';
import { previewBlocker } from '@/lib/preview';
import type { Experiment, Variation } from '@/lib/types';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import { POST as create } from '@/app/api/experiments/route';
import { GET as getOne, PATCH as patch } from '@/app/api/experiments/[id]/route';
import { POST as duplicate } from '@/app/api/experiments/[id]/duplicate/route';
import { POST as archive, DELETE as unarchive } from '@/app/api/experiments/[id]/archive/route';
import { GET as history } from '@/app/api/experiments/[id]/history/route';
import { PUT as schedule } from '@/app/api/experiments/[id]/schedule/route';
import { POST as addGoal } from '@/app/api/experiments/[id]/goals/route';
import { POST as addFunnel } from '@/app/api/experiments/[id]/funnels/route';
import { POST as track } from '@/app/api/track/route';
import { POST as createIdea } from '@/app/api/ideas/route';
import { PATCH as patchIdea } from '@/app/api/ideas/[id]/route';

const json = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
    new NextRequest(`http://localhost${url}`, {
        method,
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
const p = (id: string) => ({ params: Promise.resolve({ id }) });
type E = Pick<Experiment, 'name' | 'description' | 'hypothesis' | 'tags' | 'status' | 'archived_at'>;
const e = (x: Partial<E>): E => ({ name: 'Test', description: null, hypothesis: null, tags: null, status: 'draft', archived_at: null, ...x });

describe('experiment management helpers', () => {
    it('cleans tags: trims, lower cases, dedupes and caps', () => {
        expect(tagsSchema.parse(['  Home  Page ', 'home page', 'Q4'])).toEqual(['home page', 'q4']);
        expect(tagsSchema.safeParse(['']).success).toBe(false);
        expect(tagsSchema.safeParse(['<script>']).success).toBe(false);
        expect(tagsSchema.safeParse(['x'.repeat(31)]).success).toBe(false);
        expect(tagsSchema.safeParse(Array.from({ length: MAX_TAGS + 1 }, (_, i) => `t${i}`)).success).toBe(false);
        expect(parseTags('["a","B"]')).toEqual(['a', 'b']);
        expect(parseTags('not json')).toEqual([]);
        expect(parseTags(null)).toEqual([]);
        expect(serializeTags([])).toBeNull();
        expect(serializeTags(['a'])).toBe('["a"]');
        expect(noteOrNull('  ')).toBeNull();
        expect(noteOrNull(' Hi ')).toBe('Hi');
    });
    it('archives only completed or paused tests without a live rollout', () => {
        expect(canArchive({ status: 'completed', archived_at: null })).toBe(true);
        expect(canArchive({ status: 'paused', archived_at: null })).toBe(true);
        expect(canArchive({ status: 'running', archived_at: null })).toBe(false);
        expect(canArchive({ status: 'draft', archived_at: null })).toBe(false);
        expect(canArchive({ status: 'paused', archived_at: 'x' })).toBe(false);
        expect(archiveError({ status: 'completed', archived_at: null, rollout_variation_id: 'v' })).toMatch(/rollout/);
        expect(archiveError({ status: 'running', archived_at: null, rollout_variation_id: null })).toMatch(/Pause or stop/);
        expect(archiveError({ status: 'completed', archived_at: null, rollout_variation_id: null })).toBeNull();
    });
    it('names copies and keeps them within the name limit', () => {
        expect(copyName('Hero')).toBe('Copy of Hero');
        expect(copyName('x'.repeat(200))).toHaveLength(200);
    });
    it('filters the list by view, status, tag and search words', () => {
        const list = [
            e({ name: 'Hero headline', tags: '["homepage"]', status: 'running' }),
            e({ name: 'Pricing table', hypothesis: 'Shorter plans page lifts signups', tags: '["pricing","q4"]', status: 'completed' }),
            e({ name: 'Old CTA', status: 'completed', archived_at: '2026-10-01', tags: '["homepage"]' }),
        ];
        expect(filterExperiments(list, {}).map((x) => x.name)).toEqual(['Hero headline', 'Pricing table']);
        expect(filterExperiments(list, { view: 'archived' }).map((x) => x.name)).toEqual(['Old CTA']);
        expect(filterExperiments(list, { tag: 'HOMEPAGE' }).map((x) => x.name)).toEqual(['Hero headline']);
        expect(filterExperiments(list, { q: 'SIGNUPS pricing' }).map((x) => x.name)).toEqual(['Pricing table']);
        expect(filterExperiments(list, { q: 'q4' }).map((x) => x.name)).toEqual(['Pricing table']);
        expect(filterExperiments(list, { q: 'nothing' })).toEqual([]);
        expect(filterExperiments(list, { status: 'running' }).map((x) => x.name)).toEqual(['Hero headline']);
        expect(allTags(list)).toEqual(['homepage', 'pricing', 'q4']);
    });
    it('writes an expected outcome from a planner idea', () => {
        expect(ideaExpectedOutcome({ baseline_rate: 5, expected_lift: 10 })).toBe('A 10% lift in the conversion rate, from 5% to 5.5%.');
        expect(ideaExpectedOutcome({ baseline_rate: null, expected_lift: 20 })).toBe('A 20% lift in the conversion rate.');
        expect(ideaExpectedOutcome({ baseline_rate: 5, expected_lift: null })).toBe('');
    });
    it('never serves or previews an archived test', () => {
        const vars = [{ id: 'c', is_control: true }, { id: 'b', is_control: false }] as Variation[];
        const done = { status: 'completed', rollout_variation_id: 'b' } as Experiment;
        expect(rolloutVariation(done, vars)?.id).toBe('b');
        expect(rolloutVariation({ ...done, archived_at: '2026-10-01' }, vars)).toBeNull();
        expect(previewBlocker({ status: 'paused', archived_at: '2026-10-01' } as Experiment, vars, 'b')).toMatch(/archived/);
    });
});

describe('experiment management routes', () => {
    let cleanup: () => void;
    let userId = '', orgId = '', projectId = '', expId = '', sdkKey = '';

    beforeAll(async () => {
        cleanup = useTempDatabase();
        const u = await db.createUser({ email: 'manage@example.com', name: 'Manage' });
        userId = u.id;
        const ws = await db.ensureWorkspace(u);
        orgId = ws.orgId;
        projectId = ws.projectId;
        await seedProjectDomain(projectId, 'localhost');
        const env = (await db.getEnvironments(projectId)).find((x) => x.key === 'dev')!;
        sdkKey = (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key;
        session.current = { user: { id: u.id } };
        const res = await create(json('POST', '/api/experiments', flowExperimentBody({
            hypothesis: '  If the CTA is green, more visitors click it. ',
            expected_outcome: 'Clicks rise by 10%',
            tags: ['Homepage', 'homepage', 'Q4'],
        })));
        expect(res.status).toBe(201);
        expId = (await res.json()).experiment.id;
        clearConfigCache();
    });
    afterAll(() => cleanup());

    it('saves the hypothesis, expected outcome and tags on create and edit', async () => {
        const got = (await (await getOne(json('GET', `/api/experiments/${expId}`), p(expId))).json()).experiment;
        expect(got.hypothesis).toBe('If the CTA is green, more visitors click it.');
        expect(got.expected_outcome).toBe('Clicks rise by 10%');
        expect(parseTags(got.tags)).toEqual(['homepage', 'q4']);
        expect((await patch(json('PATCH', `/api/experiments/${expId}`, { tags: ['bad<tag>'] }), p(expId))).status).toBe(400);
        const res = await patch(json('PATCH', `/api/experiments/${expId}`, { tags: ['pricing'], hypothesis: 'New idea', expected_outcome: null }), p(expId));
        expect(res.status).toBe(200);
        const after = await db.getExperiment(expId);
        expect(parseTags(after!.tags)).toEqual(['pricing']);
        expect(after!.hypothesis).toBe('New idea');
        expect(after!.expected_outcome).toBeNull();
        await patch(json('PATCH', `/api/experiments/${expId}`, { tags: [] }), p(expId));
        expect((await db.getExperiment(expId))!.tags).toBeNull();
        await patch(json('PATCH', `/api/experiments/${expId}`, { tags: ['homepage'] }), p(expId));
    });

    it('a free account cannot copy a test past its monthly limit', async () => {
        const res = await duplicate(json('POST', `/api/experiments/${expId}/duplicate`), p(expId));
        expect(res.status).toBe(403);
        expect((await res.json()).reason).toMatch(/monthly_tests/);
    });

    it('history is locked on the free plan', async () => {
        const res = await history(json('GET', `/api/experiments/${expId}/history`), p(expId));
        expect(res.status).toBe(403);
        expect(await res.json()).toMatchObject({ reason: 'audit_log' });
    });

    it('copies the setup into a draft with no results on a paid plan', async () => {
        await makePaid(orgId, 'growth');
        await resetFreeTestUsage();
        expect((await addGoal(json('POST', `/api/experiments/${expId}/goals`, { name: 'Second', selector: '#two', is_primary: false }), p(expId))).status).toBe(201);
        const goalIds = (await db.getGoals(expId)).map((g) => g.id);
        expect((await addFunnel(json('POST', `/api/experiments/${expId}/funnels`, { name: 'Path', steps: goalIds }), p(expId))).status).toBe(201);
        await patch(json('PATCH', `/api/experiments/${expId}`, { status: 'running' }), p(expId));
        expect((await db.getExperiment(expId))!.status).toBe('running');

        const res = await duplicate(json('POST', `/api/experiments/${expId}/duplicate`), p(expId));
        expect(res.status).toBe(201);
        const data = await res.json();
        const copy = await db.getExperiment(data.experiment.id);
        const src = await db.getExperiment(expId);
        expect(copy).toMatchObject({ name: 'Copy of Homepage CTA', status: 'draft', hypothesis: 'New idea', tags: src!.tags, traffic_allocation: src!.traffic_allocation, control_url: src!.control_url, started_at: null, schedule_start_at: null, rollout_variation_id: null, archived_at: null });
        const [sv, cv] = await Promise.all([db.getVariations(expId), db.getVariations(copy!.id)]);
        expect(cv.map((v) => [v.name, v.url, v.weight, v.is_control])).toEqual(sv.map((v) => [v.name, v.url, v.weight, v.is_control]));
        expect(cv.every((v) => !sv.some((s) => s.id === v.id))).toBe(true);
        const [sg, cg] = await Promise.all([db.getGoals(expId), db.getGoals(copy!.id)]);
        expect(cg.map((g) => [g.name, g.selector, g.is_primary])).toEqual(sg.map((g) => [g.name, g.selector, g.is_primary]));
        const [funnel] = await db.listFunnels(copy!.id);
        expect(funnel.name).toBe('Path');
        expect(JSON.parse(funnel.steps)).toEqual(cg.map((g) => g.id));
        const missing = await duplicate(json('POST', '/api/experiments/exp_nope/duplicate'), p('exp_nope'));
        expect(missing.status).toBe(404);
    });

    it('archives only stopped tests and keeps them out of the SDK', async () => {
        expect((await archive(json('POST', `/api/experiments/${expId}/archive`), p(expId))).status).toBe(400);
        await patch(json('PATCH', `/api/experiments/${expId}`, { status: 'paused' }), p(expId));
        const vars = await db.getVariations(expId);
        const res = await archive(json('POST', `/api/experiments/${expId}/archive`), p(expId));
        expect(res.status).toBe(200);
        expect((await res.json()).experiment.archived_at).toBeTruthy();
        expect((await patch(json('PATCH', `/api/experiments/${expId}`, { status: 'running' }), p(expId))).status).toBe(400);
        expect((await schedule(json('PUT', `/api/experiments/${expId}/schedule`, { start_at: new Date(Date.now() + 86400000).toISOString() }), p(expId))).status).toBe(400);
        const ev = await track(json('POST', '/api/track', { experiment_id: expId, variation_id: vars[0].id, user_id: 'v1', event_type: 'page_view' }, { 'X-API-Key': sdkKey }));
        expect(ev.status).toBe(404);
        // Even a row marked archived while running is never served.
        await db.updateExperiment(expId, { status: 'running' });
        clearConfigCache();
        expect((await db.getRunningConfig(projectId)).some((c) => c.experiment.id === expId)).toBe(false);
        await db.updateExperiment(expId, { status: 'completed', rollout_variation_id: vars[1].id });
        clearConfigCache();
        expect((await db.getRolloutConfig(projectId)).some((c) => c.experiment.id === expId)).toBe(false);
        await db.updateExperiment(expId, { status: 'paused', rollout_variation_id: null });
        // Results stay readable.
        expect((await getOne(json('GET', `/api/experiments/${expId}`), p(expId))).status).toBe(200);
        // Notes and tags can still change.
        expect((await patch(json('PATCH', `/api/experiments/${expId}`, { tags: ['homepage', 'archived'] }), p(expId))).status).toBe(200);

        const back = await unarchive(json('DELETE', `/api/experiments/${expId}/archive`), p(expId));
        expect((await back.json()).experiment.archived_at).toBeNull();
        expect((await patch(json('PATCH', `/api/experiments/${expId}`, { status: 'running' }), p(expId))).status).toBe(200);
    });

    it('shows the test history with the experiment id on a paid plan', async () => {
        const res = await history(json('GET', `/api/experiments/${expId}/history`), p(expId));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.retention_days).toBeGreaterThan(0);
        const actions = (data.entries as { action: string }[]).map((x) => x.action);
        for (const a of ['create', 'update', 'archive', 'unarchive', 'duplicate']) expect(actions).toContain(a);
        expect(actions.some((a) => a.startsWith('status'))).toBe(true);
        session.current = { user: { id: (await db.createUser({ email: 'stranger@example.com', name: 'S' })).id } };
        await db.ensureWorkspace({ id: session.current.user.id, email: 'stranger@example.com' } as never);
        expect((await history(json('GET', `/api/experiments/${expId}/history`), p(expId))).status).toBe(404);
        session.current = { user: { id: userId } };
    });

    it('carries a planner idea\'s hypothesis and expected outcome to the test', async () => {
        await resetFreeTestUsage();
        const ir = await createIdea(json('POST', '/api/ideas', { title: 'Short form', hypothesis: 'Fewer fields, more signups', baseline_rate: 4, expected_lift: 25 }));
        expect(ir.status).toBe(201);
        const idea = (await ir.json()).idea;
        const er = await create(json('POST', '/api/experiments', flowExperimentBody({ name: 'From idea' })));
        const newId = (await er.json()).experiment.id;
        expect((await patchIdea(json('PATCH', `/api/ideas/${idea.id}`, { experiment_id: newId }), p(idea.id))).status).toBe(200);
        expect(await db.getExperiment(newId)).toMatchObject({ hypothesis: 'Fewer fields, more signups', expected_outcome: 'A 25% lift in the conversion rate, from 4% to 5%.' });
    });
});

describe('experiment management wiring', () => {
    const read = (f: string) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    it('migration adds the columns with a newer timestamp', () => {
        const j = JSON.parse(read('drizzle/meta/_journal.json')) as { entries: { tag: string; when: number }[] };
        const i = j.entries.findIndex((x) => x.tag === '0042_experiment_manage');
        expect(i).toBeGreaterThan(0);
        expect(j.entries[i].when).toBeGreaterThan(j.entries[i - 1].when);
        const sqlText = read('drizzle/0042_experiment_manage.sql');
        for (const c of ['hypothesis', 'expected_outcome', 'tags', 'archived_at']) expect(sqlText).toContain(`\`${c}\``);
    });
    it('the detail page has duplicate, archive and history, and the list has search and an Archived tab', () => {
        const page = read('app/(app)/experiments/[id]/page.tsx');
        expect(page).toMatch(/\/duplicate`/);
        expect(page).toMatch(/\/archive`/);
        expect(page).toMatch(/<HistoryPanel/);
        const list = read('app/(app)/experiments/page.tsx');
        expect(list).toMatch(/Archived/);
        expect(list).toMatch(/name="q"/);
        expect(read('app/(app)/experiments/[id]/HistoryPanel.tsx')).toMatch(/UpgradeNote/);
    });
});
