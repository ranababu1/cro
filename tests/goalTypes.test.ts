import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody, makePaid } from './helpers';
import { matchesPageGoal, describeGoal } from '@/lib/goals';
import { goalSchema } from '@/lib/validation';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { POST as create } from '@/app/api/experiments/route';
import { PATCH as patch } from '@/app/api/experiments/[id]/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';
import { POST as customEvent } from '@/app/api/sdk/event/route';

const json = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
    new NextRequest(`http://localhost${url}`, {
        method,
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

describe('page goal matching', () => {
    it('equals ignores protocol, query, hash and trailing slash', () => {
        expect(matchesPageGoal('https://x.com/thanks/?a=1#t', 'equals', 'http://x.com/thanks')).toBe(true);
        expect(matchesPageGoal('https://x.com/thanks/more', 'equals', 'https://x.com/thanks')).toBe(false);
    });
    it('contains and regex', () => {
        expect(matchesPageGoal('https://x.com/order/123/thanks', 'contains', '/thanks')).toBe(true);
        expect(matchesPageGoal('https://x.com/order/123/done', 'regex', '/order/\\d+/done$')).toBe(true);
        expect(matchesPageGoal('https://x.com/a', 'regex', '(')).toBe(false);
    });
    it('describes goals', () => {
        expect(describeGoal({ type: 'event', selector: 'signup' })).toBe("ABTest.track('signup')");
        expect(describeGoal({ selector: '#cta' })).toBe('#cta');
    });
});

describe('goal validation', () => {
    it('defaults to click and validates per type', () => {
        expect(goalSchema.parse({ name: 'a', selector: '#x', is_primary: true }).type).toBe('click');
        expect(goalSchema.safeParse({ name: 'a', type: 'form', selector: '<form>', is_primary: true }).success).toBe(false);
        expect(goalSchema.safeParse({ name: 'a', type: 'event', selector: 'has space', is_primary: true }).success).toBe(false);
        expect(goalSchema.safeParse({ name: 'a', type: 'page', match_type: 'regex', selector: '(', is_primary: true }).success).toBe(false);
        const p = goalSchema.parse({ name: 'a', type: 'page', selector: 'https://x.com/t', is_primary: true });
        expect(p.match_type).toBe('equals');
        expect(goalSchema.parse({ name: 'a', type: 'click', match_type: 'regex', selector: '#x', is_primary: true }).match_type).toBeNull();
    });
});

describe('page, form and custom event goals end to end', () => {
    let cleanup: () => void;
    let sdkKey: string;
    let expId: string;
    const goalIds: Record<string, string> = {};

    beforeAll(async () => {
        cleanup = useTempDatabase();
        const u = await db.createUser({ email: 'goals@example.com', name: 'G' });
        const ws = await db.ensureWorkspace(u);
        await makePaid(ws.orgId); // form, page and custom event goals are paid features
        await seedProjectDomain(ws.projectId, 'localhost');
        const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'dev')!;
        sdkKey = (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key;
        session.current = { user: { id: u.id } };
        const res = await create(json('POST', '/api/experiments', flowExperimentBody({
            goals: [
                { name: 'CTA', type: 'click', selector: '#headerCTA', is_primary: true },
                { name: 'Signup form', type: 'form', selector: 'form#signup', is_primary: false },
                { name: 'Thanks page', type: 'page', match_type: 'contains', selector: '/thank-you', is_primary: false },
                { name: 'Signup event', type: 'event', selector: 'signup', is_primary: false },
            ],
        })));
        expect(res.status).toBe(201);
        const data = await res.json();
        expId = data.experiment.id;
        for (const g of data.goals) goalIds[g.type] = g.id;
        await patch(json('PATCH', `/api/experiments/${expId}`, { status: 'running' }), { params: Promise.resolve({ id: expId }) });
    });
    afterAll(() => cleanup());

    const boot = (url: string, user: string) => bootstrap(json('POST', '/api/sdk/bootstrap', { url, user_id: user }, { 'X-API-Key': sdkKey }));
    const conversions = async (user: string) =>
        (await db.getLiveCounts(expId)).goals.filter((g) => g.users > 0).length && user;

    it('sends only click and form goals to the browser', async () => {
        const body = await (await boot('http://localhost/demo/control.html', 'v1')).json();
        expect(body.matched).toBe(true);
        expect(body.goals.map((g: { type: string }) => g.type).sort()).toEqual(['click', 'form']);
    });

    it('counts a page visit goal once for an assigned visitor', async () => {
        await boot('http://localhost/checkout/thank-you?o=1', 'v1');
        await boot('http://localhost/checkout/thank-you', 'v1');
        expect(await db.hasConversion(expId, 'v1', goalIds.page)).toBe(true);
        const counts = await db.getLiveCounts(expId);
        expect(counts.goals.find((g) => g.goal_id === goalIds.page)?.users).toBe(1);
        expect(await conversions('v1')).toBeTruthy();
    });

    it('ignores page visits from visitors not in the test', async () => {
        await boot('http://localhost/checkout/thank-you', 'stranger');
        expect(await db.hasConversion(expId, 'stranger', goalIds.page)).toBe(false);
    });

    it('counts a custom event via ABTest.track', async () => {
        const res = await customEvent(json('POST', '/api/sdk/event', { user_id: 'v1', event_name: 'signup' }, { 'X-API-Key': sdkKey }));
        expect((await res.json()).recorded).toBe(1);
        const again = await customEvent(json('POST', '/api/sdk/event', { user_id: 'v1', event_name: 'signup' }, { 'X-API-Key': sdkKey }));
        expect((await again.json()).recorded).toBe(0);
        const bad = await customEvent(json('POST', '/api/sdk/event', { user_id: 'v1', event_name: 'no spaces' }, { 'X-API-Key': sdkKey }));
        expect(bad.status).toBe(400);
        const noKey = await customEvent(json('POST', '/api/sdk/event', { user_id: 'v1', event_name: 'signup' }));
        expect(noKey.status).toBe(401);
    });
});

describe('SDK goal types', () => {
    const code = fs.readFileSync(path.join(__dirname, '../sdk-src/sdk.js'), 'utf8');
    it('binds form submits and exposes ABTest.track', () => {
        expect(code).toMatch(/addEventListener\('submit'/);
        expect(code).toMatch(/\/api\/sdk\/event/);
        expect(code).toMatch(/track: trackEvent/);
    });
});
