import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';
import { deviceFromUserAgent, failedRule, serializeTargeting, parseTargeting, describeTargeting, targetingSchema } from '@/lib/targeting';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { POST as create } from '@/app/api/experiments/route';
import { PATCH as patch } from '@/app/api/experiments/[id]/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const ANDROID_TAB = 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/120 Safari/537.36';

describe('targeting rules', () => {
    it('detects devices', () => {
        expect(deviceFromUserAgent(IPHONE)).toBe('mobile');
        expect(deviceFromUserAgent(IPAD)).toBe('tablet');
        expect(deviceFromUserAgent(ANDROID_TAB)).toBe('tablet');
        expect(deviceFromUserAgent(MAC)).toBe('desktop');
        expect(deviceFromUserAgent(null)).toBe('desktop');
    });

    it('checks device, UTM, referrer and visitor type', () => {
        const t = { devices: ['mobile' as const], utm_source: 'Google', referrer_contains: 'news', visitor: 'new' as const };
        const ok = { url: 'https://x.com/?utm_source=google', userAgent: IPHONE, referrer: 'https://news.site/a', visitorType: 'new' as const };
        expect(failedRule(t, ok)).toBeNull();
        expect(failedRule(t, { ...ok, userAgent: MAC })).toBe('device');
        expect(failedRule(t, { ...ok, url: 'https://x.com/?utm_source=bing' })).toBe('utm_source');
        expect(failedRule(t, { ...ok, referrer: '' })).toBe('referrer');
        expect(failedRule(t, { ...ok, visitorType: 'returning' })).toBe('visitor');
        expect(failedRule({ visitor: 'returning' }, { ...ok, visitorType: null })).toBe('visitor');
        expect(failedRule({}, ok)).toBeNull();
    });

    it('stores empty rules as null and survives bad data', () => {
        expect(serializeTargeting({ devices: [], visitor: 'all', utm_source: '' })).toBeNull();
        expect(serializeTargeting({ devices: ['desktop', 'mobile', 'tablet'] })).toBeNull();
        expect(JSON.parse(serializeTargeting({ devices: ['mobile'], utm_medium: 'cpc' })!)).toEqual({ devices: ['mobile'], utm_medium: 'cpc' });
        expect(parseTargeting('not json')).toEqual({});
        expect(parseTargeting('{"devices":["watch"]}')).toEqual({});
        expect(describeTargeting({})).toBe('All visitors');
        expect(describeTargeting({ devices: ['mobile'], visitor: 'new' })).toBe('Mobile only, new visitors only');
        expect(targetingSchema.safeParse({ bogus: 1 }).success).toBe(false);
    });
});

describe('targeting at bootstrap', () => {
    let cleanup: () => void;
    let sdkKey: string;
    let expId: string;
    const json = (url: string, body: unknown, headers: Record<string, string> = {}, method = 'POST') =>
        new NextRequest(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...headers }, body: JSON.stringify(body) });
    const boot = (user: string, ua: string, extra: Record<string, unknown> = {}, url = 'http://localhost/demo/control.html') =>
        bootstrap(json('/api/sdk/bootstrap', { url, user_id: user, ...extra }, { 'X-API-Key': sdkKey, 'User-Agent': ua })).then((r) => r.json());

    beforeAll(async () => {
        cleanup = useTempDatabase();
        const u = await db.createUser({ email: 't@example.com', name: 'T' });
        const ws = await db.ensureWorkspace(u);
        await seedProjectDomain(ws.projectId, 'localhost');
        const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'dev')!;
        sdkKey = (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key;
        session.current = { user: { id: u.id } };
        const res = await create(json('/api/experiments', flowExperimentBody({ targeting: { devices: ['mobile'], visitor: 'new' } })));
        expect(res.status).toBe(201);
        const data = await res.json();
        expId = data.experiment.id;
        expect(JSON.parse(data.experiment.targeting)).toEqual({ devices: ['mobile'], visitor: 'new' });
        await patch(json(`/api/experiments/${expId}`, { status: 'running' }, {}, 'PATCH'), { params: Promise.resolve({ id: expId }) });
    });
    afterAll(() => cleanup());

    it('enrolls matching visitors and skips others without assigning them', async () => {
        expect((await boot('m1', IPHONE, { visitor: 'new' })).variation_id).toBeTruthy();
        const desk = await boot('d1', MAC, { visitor: 'new' });
        expect(desk.reason).toBe('not_targeted');
        expect(await db.getAssignment(expId, 'd1')).toBeNull();
        expect((await boot('m2', IPHONE, { visitor: 'returning' })).reason).toBe('not_targeted');
    });

    it('keeps existing visitors when targeting changes', async () => {
        await patch(json(`/api/experiments/${expId}`, { targeting: { devices: ['desktop'] } }, {}, 'PATCH'), { params: Promise.resolve({ id: expId }) });
        expect((await boot('m1', IPHONE)).variation_id).toBeTruthy();
        expect((await boot('m3', IPHONE)).reason).toBe('not_targeted');
        expect((await boot('d2', MAC)).variation_id).toBeTruthy();
        await patch(json(`/api/experiments/${expId}`, { targeting: {} }, {}, 'PATCH'), { params: Promise.resolve({ id: expId }) });
        expect((await db.getExperiment(expId))!.targeting).toBeNull();
    });

    it('UTM rule reads the page URL', async () => {
        await patch(json(`/api/experiments/${expId}`, { targeting: { utm_campaign: 'spring' } }, {}, 'PATCH'), { params: Promise.resolve({ id: expId }) });
        expect((await boot('u1', MAC, {}, 'http://localhost/demo/control.html?utm_campaign=spring')).variation_id).toBeTruthy();
        expect((await boot('u2', MAC)).reason).toBe('not_targeted');
    });
});

describe('SDK sends targeting context', () => {
    const code = fs.readFileSync(path.join(__dirname, '../sdk-src/sdk.js'), 'utf8');
    it('sends referrer and visitor type', () => {
        expect(code).toMatch(/referrer: document\.referrer/);
        expect(code).toMatch(/visitor: visitorType\(\)/);
        expect(code).toMatch(/ab_first_seen/);
    });
});
