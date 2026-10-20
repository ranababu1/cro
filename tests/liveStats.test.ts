import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody, makePaid } from './helpers';
import { buildLiveStats, goalStatus, upliftInterval, type LiveCounts } from '@/lib/liveStats';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { POST as create } from '@/app/api/experiments/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';
import { POST as track } from '@/app/api/track/route';
import { GET as results } from '@/app/api/experiments/[id]/results/route';

const V = [
    { id: 'c', name: 'Control', is_control: true, url: 'http://x/c' },
    { id: 'v1', name: 'Variation 1', is_control: false, url: 'http://x/v1' },
];
const G = [
    { id: 'g1', name: 'Header CTA', selector: '#headerCTA', is_primary: true },
    { id: 'g2', name: 'Body CTA', selector: '.bodyCTA', is_primary: false },
];
const counts = (cv: number, vv: number, g1c: number, g1v: number, g2c = 0, g2v = 0): LiveCounts => ({
    byType: [
        { variation_id: 'c', event_type: 'page_view', users: cv, events: cv },
        { variation_id: 'v1', event_type: 'page_view', users: vv, events: vv },
        { variation_id: 'v1', event_type: 'redirect', users: vv, events: vv + 3 },
    ],
    visitors: [{ variation_id: 'c', users: cv }, { variation_id: 'v1', users: vv }],
    goals: [
        { goal_id: 'g1', variation_id: 'c', users: g1c }, { goal_id: 'g1', variation_id: 'v1', users: g1v },
        { goal_id: 'g2', variation_id: 'c', users: g2c }, { goal_id: 'g2', variation_id: 'v1', users: g2v },
    ],
    daily: [{ day: '2026-10-01', variation_id: 'c', users: 5 }, { day: '2026-10-03', variation_id: 'v1', users: 7 }],
});

describe('buildLiveStats', () => {
    it('handles an empty experiment', () => {
        const s = buildLiveStats(V, G, { byType: [], visitors: [], goals: [], daily: [] });
        expect(s.total_visitors).toBe(0);
        expect(s.daily).toEqual([]);
        expect(s.headline.status).toBe('Too early to call');
        expect(s.goals.every((g) => g.arms.every((a) => a.rate === 0))).toBe(true);
    });

    it('counts visitors, redirects and ranks goals by clicks', () => {
        const s = buildLiveStats(V, G, counts(50, 50, 2, 3, 10, 12));
        expect(s.total_visitors).toBe(100);
        expect(s.total_redirects).toBe(50);
        expect(s.variations[1].redirects).toBe(53);
        expect(s.goals[0].name).toBe('Body CTA');
        expect(s.goals[0].rank).toBe(1);
        expect(s.total_clicks).toBe(27);
    });

    it('fills missing days in the daily series', () => {
        const s = buildLiveStats(V, G, counts(5, 7, 0, 0));
        expect(s.daily.map((d) => d.day)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
        expect(s.daily[1].total).toBe(0);
        expect(s.daily[2].by_variation.v1).toBe(7);
    });

    it('says too early with small samples even with a big gap', () => {
        const s = buildLiveStats(V, G, counts(40, 40, 2, 20));
        expect(s.headline.status).toBe('Too early to call');
    });

    it('calls a significant variation ahead', () => {
        const s = buildLiveStats(V, G, counts(2000, 2000, 100, 180));
        const g = s.goals.find((x) => x.goal_id === 'g1')!;
        expect(g.status).toBe('Variation 1 is ahead');
        expect(s.headline.status).toBe('Variation 1 is ahead');
        const arm = g.arms[1];
        expect(arm.uplift).toBeCloseTo(0.8, 5);
        expect(arm.uplift_ci!.lower).toBeGreaterThan(0);
        expect(arm.uplift_ci!.upper).toBeGreaterThan(arm.uplift!);
    });

    it('calls control ahead when the variation is significantly worse', () => {
        const s = buildLiveStats(V, G, counts(2000, 2000, 200, 100));
        expect(s.headline.status).toBe('Control is ahead');
        expect(s.headline.tone).toBe('behind');
    });

    it('upliftInterval is null without control clicks', () => {
        expect(upliftInterval(0, 100, 5, 100)).toBeNull();
        expect(goalStatus([]).status).toBe('Too early to call');
    });
});

describe('live stats end to end', () => {
    let cleanup: () => void;
    let sdkKey: string;
    let experimentId: string;
    const req = (url: string, body: unknown, headers: Record<string, string> = {}) =>
        new NextRequest(`http://localhost${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...headers }, body: JSON.stringify(body) });

    beforeAll(async () => {
        cleanup = useTempDatabase();
        const u = await db.createUser({ email: 'live@example.com', name: 'Live' });
        const ws = await db.ensureWorkspace(u);
        await makePaid(ws.orgId); // several goals per test are a paid feature
        await seedProjectDomain(ws.projectId, 'localhost');
        const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'dev')!;
        sdkKey = (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key;
        session.current = { user: { id: u.id } };
        const res = await create(req('/api/experiments', flowExperimentBody({
            goals: [
                { name: 'Header CTA', selector: '#headerCTA', is_primary: true },
                { name: 'Body CTA', selector: '.bodyCTA', is_primary: false },
            ],
        })));
        experimentId = (await res.json()).experiment.id;
    });
    afterAll(() => cleanup());

    it('returns an empty live block before any traffic', async () => {
        await db.updateExperiment(experimentId, { status: 'running', started_at: new Date().toISOString() });
        const r = await (await results(new NextRequest(`http://localhost/api/experiments/${experimentId}/results`), { params: Promise.resolve({ id: experimentId }) })).json();
        expect(r.live.total_visitors).toBe(0);
        expect(r.live.goals).toHaveLength(2);
    });

    it('records redirects on bootstrap and splits clicks by goal', async () => {
        const goals = await db.getGoals(experimentId);
        const body = goals.find((g) => g.selector === '.bodyCTA')!;
        const header = goals.find((g) => g.selector === '#headerCTA')!;
        let redirected = 0;
        for (let i = 0; i < 30; i++) {
            const user = `live_${i}`;
            const b = await (await bootstrap(req('/api/sdk/bootstrap', { url: 'http://localhost/demo/control.html', user_id: user }, { 'X-API-Key': sdkKey }))).json();
            if (b.action === 'redirect') {
                redirected++;
                const land = await (await bootstrap(req('/api/sdk/bootstrap', { url: b.variation_url, user_id: user }, { 'X-API-Key': sdkKey }))).json();
                expect(land.action).toBe('stay');
            }
            await track(req('/api/track', { experiment_id: experimentId, variation_id: b.variation_id, user_id: user, event_type: 'page_view' }, { 'X-API-Key': sdkKey }));
            await track(req('/api/track', { experiment_id: experimentId, variation_id: b.variation_id, user_id: user, event_type: 'conversion', goal_id: body.id }, { 'X-API-Key': sdkKey }));
            if (i % 3 === 0) await track(req('/api/track', { experiment_id: experimentId, variation_id: b.variation_id, user_id: user, event_type: 'conversion', goal_id: header.id }, { 'X-API-Key': sdkKey }));
        }
        expect(redirected).toBeGreaterThan(0);
        const r = await (await results(new NextRequest(`http://localhost/api/experiments/${experimentId}/results`), { params: Promise.resolve({ id: experimentId }) })).json();
        expect(r.live.total_visitors).toBe(30);
        expect(r.live.total_redirects).toBe(redirected);
        expect(r.live.goals[0].selector).toBe('.bodyCTA');
        expect(r.live.goals[0].total_clicks).toBe(30);
        expect(r.live.goals[1].total_clicks).toBe(10);
        expect(r.live.daily).toHaveLength(1);
        expect(r.live.daily[0].total).toBe(30);
    });
});
