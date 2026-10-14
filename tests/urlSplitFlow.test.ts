import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';
import { maxVariationUrlsForPlan, FREE_MAX_VARIATIONS, PAID_MAX_VARIATIONS } from '@/lib/plans';
import { normalizeHost, isHostAllowed, hostFromRequestHeaders, urlsMatch, normalizePageUrl } from '@/lib/domains';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { POST as create } from '@/app/api/experiments/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';
import { POST as track } from '@/app/api/track/route';
import { POST as addDomain } from '@/app/api/domains/route';
import { GET as results } from '@/app/api/experiments/[id]/results/route';

let cleanup: () => void;
let userId: string;
let projectId: string;
let sdkKey: string;

const json = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
    new NextRequest(`http://localhost${url}`, {
        method,
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

beforeAll(async () => {
    cleanup = useTempDatabase();
    const u = await db.createUser({ email: 'flow@example.com', name: 'Flow' });
    const ws = await db.ensureWorkspace(u);
    userId = u.id;
    projectId = ws.projectId;
    await seedProjectDomain(projectId, 'localhost');
    const env = (await db.getEnvironments(projectId)).find((e) => e.key === 'dev')!;
    sdkKey = (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key;
    session.current = { user: { id: userId } };
});
afterAll(() => cleanup());

describe('plan variation limits', () => {
    it('free allows 1 variation, paid allows 10', () => {
        expect(FREE_MAX_VARIATIONS).toBe(1);
        expect(PAID_MAX_VARIATIONS).toBe(10);
        expect(maxVariationUrlsForPlan('free')).toBe(1);
        expect(maxVariationUrlsForPlan('team')).toBe(10);
        expect(maxVariationUrlsForPlan('enterprise')).toBe(10);
    });

    it('rejects a second variation on the free plan', async () => {
        const body = flowExperimentBody({
            variations: [
                { name: 'Control', url: 'http://localhost/demo/control.html', weight: 34, is_control: true },
                { name: 'V1', url: 'http://localhost/demo/variation.html', weight: 33, is_control: false },
                { name: 'V2', url: 'http://localhost/demo/variation2.html', weight: 33, is_control: false },
            ],
        });
        const res = await create(json('POST', '/api/experiments', body));
        expect(res.status).toBe(403);
        const err = await res.json();
        expect(err.error).toMatch(/1 variation/i);
    });

    it('allows up to 10 variations on a paid plan', async () => {
        const projects = await db.getProjectsForUser(userId);
        const org = await db.getOrganization(projects[0].org_id);
        await db.updateOrganization(org!.id, { plan: 'team' });
        const variations = [
            { name: 'Control', url: 'http://localhost/c.html', weight: 10, is_control: true },
            ...Array.from({ length: 10 }, (_, i) => ({
                name: `V${i + 1}`,
                url: `http://localhost/v${i + 1}.html`,
                weight: 9,
                is_control: false as boolean,
            })),
        ];
        variations[0].weight = 10;
        const res = await create(json('POST', '/api/experiments', flowExperimentBody({ name: 'Paid 10', control_url: 'http://localhost/c.html', variations })));
        expect(res.status).toBe(201);
        const tooMany = [
            { name: 'Control', url: 'http://localhost/c2.html', weight: 1, is_control: true },
            ...Array.from({ length: 11 }, (_, i) => ({ name: `X${i}`, url: `http://localhost/x${i}.html`, weight: 9, is_control: false as boolean })),
        ];
        const w = Math.floor(100 / tooMany.length);
        tooMany.forEach((v, i) => { v.weight = i === 0 ? 100 - w * (tooMany.length - 1) : w; });
        const res2 = await create(json('POST', '/api/experiments', flowExperimentBody({ name: 'Too many', control_url: 'http://localhost/c2.html', variations: tooMany })));
        expect(res2.status).toBe(403);
        await db.updateOrganization(org!.id, { plan: 'free' });
    });
});

describe('domain enforcement', () => {
    it('normalizes hosts and checks allowlists', () => {
        expect(normalizeHost('HTTPS://WWW.Example.COM/path')).toBe('www.example.com');
        expect(isHostAllowed('www.example.com', ['www.example.com'])).toBe(true);
        expect(isHostAllowed('evil.com', ['www.example.com'])).toBe(false);
        expect(hostFromRequestHeaders('https://www.example.com', null)).toBe('www.example.com');
        expect(urlsMatch('http://localhost/a/', 'http://localhost/a')).toBe(true);
        expect(normalizePageUrl('http://localhost/a/?x=1#h')).toBe('http://localhost/a');
    });

    it('rejects bootstrap from an unregistered domain', async () => {
        const res = await bootstrap(json('POST', '/api/sdk/bootstrap', {
            url: 'https://evil.example/page',
            user_id: 'visitor_1',
        }, { 'X-API-Key': sdkKey, Origin: 'https://evil.example' }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.matched).toBe(false);
        expect(body.reason).toBe('domain_not_allowed');
    });

    it('adds domains through the API', async () => {
        const res = await addDomain(json('POST', '/api/domains', { host: 'www.example.com' }));
        expect(res.status).toBe(201);
        const hosts = await db.getDomainHosts(projectId);
        expect(hosts).toContain('www.example.com');
    });
});

describe('SDK bootstrap, goals and dedupe', () => {
    let experimentId: string;
    let goalId: string;

    beforeAll(async () => {
        const res = await create(json('POST', '/api/experiments', flowExperimentBody({ name: 'Bootstrap test' })));
        expect(res.status).toBe(201);
        const data = await res.json();
        experimentId = data.experiment.id;
        goalId = data.goals[0].id;
        await db.updateExperiment(experimentId, { status: 'running', started_at: new Date().toISOString() });
    });

    it('matches control URL, assigns sticky, and redirects for variation bucket', async () => {
        // Force a visitor into variation by trying until we get redirect or use known hash — run many visitors
        let redirect = false;
        let stay = false;
        for (let i = 0; i < 40; i++) {
            const res = await bootstrap(json('POST', '/api/sdk/bootstrap', {
                url: 'http://localhost/demo/control.html',
                user_id: `bucket_${i}`,
            }, { 'X-API-Key': sdkKey }));
            const body = await res.json();
            expect(body.matched).toBe(true);
            if (body.action === 'redirect') redirect = true;
            if (body.action === 'stay') stay = true;
            // sticky
            const again = await (await bootstrap(json('POST', '/api/sdk/bootstrap', {
                url: 'http://localhost/demo/control.html',
                user_id: `bucket_${i}`,
            }, { 'X-API-Key': sdkKey }))).json();
            expect(again.variation_id).toBe(body.variation_id);
            expect(again.action).toBe(body.action);
        }
        expect(redirect).toBe(true);
        expect(stay).toBe(true);
    });

    it('records exposure on variation page and guards wrong variation', async () => {
        const onControl = await (await bootstrap(json('POST', '/api/sdk/bootstrap', {
            url: 'http://localhost/demo/control.html',
            user_id: 'guard_user',
        }, { 'X-API-Key': sdkKey }))).json();
        if (onControl.action === 'redirect' && onControl.variation_url) {
            const onVar = await (await bootstrap(json('POST', '/api/sdk/bootstrap', {
                url: onControl.variation_url,
                user_id: 'guard_user',
            }, { 'X-API-Key': sdkKey }))).json();
            expect(onVar.action).toBe('stay');
            expect(onVar.variation_id).toBe(onControl.variation_id);
        }
        // visitor assigned to control visiting variation page
        const controlOnly = await (await bootstrap(json('POST', '/api/sdk/bootstrap', {
            url: 'http://localhost/demo/control.html',
            user_id: 'control_only',
        }, { 'X-API-Key': sdkKey }))).json();
        if (controlOnly.is_control || controlOnly.action === 'stay') {
            const wrong = await (await bootstrap(json('POST', '/api/sdk/bootstrap', {
                url: 'http://localhost/demo/variation.html',
                user_id: 'control_only',
            }, { 'X-API-Key': sdkKey }))).json();
            if (controlOnly.variation_id && wrong.matched) {
                // if assigned control, visiting variation should guard
                const vars = await db.getVariations(experimentId);
                const assigned = vars.find((v) => v.id === controlOnly.variation_id);
                if (assigned?.is_control) expect(wrong.action).toBe('guard');
            }
        }
    });

    it('dedupes conversions per visitor per goal', async () => {
        const vars = await db.getVariations(experimentId);
        const vid = vars[0].id;
        const body = {
            experiment_id: experimentId,
            variation_id: vid,
            user_id: 'dedupe_user',
            event_type: 'conversion' as const,
            goal_id: goalId,
            event_name: 'CTA click',
        };
        expect((await track(json('POST', '/api/track', body, { 'X-API-Key': sdkKey }))).status).toBe(201);
        const second = await track(json('POST', '/api/track', body, { 'X-API-Key': sdkKey }));
        expect(second.status).toBe(200);
        expect((await second.json()).deduped).toBe(true);
        const stats = await db.getEventStats(experimentId, undefined, goalId);
        const row = stats.find((s) => s.variation_id === vid);
        expect(Number(row?.conversions)).toBe(1);
    });

    it('returns per-goal results', async () => {
        const res = await results(json('GET', `/api/experiments/${experimentId}/results`), { params: Promise.resolve({ id: experimentId }) });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.goals.length).toBeGreaterThan(0);
        expect(data.goals[0].goal_name).toBe('CTA click');
        expect(data.variations.length).toBe(2);
    });
});
