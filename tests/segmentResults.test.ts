import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';
import { computeSegments, landingSourceOf, segmentOf, MAX_SOURCES, NOT_RECORDED, OTHER_SOURCES } from '@/lib/segments';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import { computeEntitlements } from '@/lib/entitlements';
import { POST as create } from '@/app/api/experiments/route';
import { PATCH as patch } from '@/app/api/experiments/[id]/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';
import { GET as segmentsRoute } from '@/app/api/experiments/[id]/segments/route';

const json = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
    new NextRequest(`http://localhost${url}`, {
        method,
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
const p = (id: string) => ({ params: Promise.resolve({ id }) });
const MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';

describe('segment keys', () => {
    it('reads the landing value the SDK sends', () => {
        const url = 'https://shop.example.com/pricing';
        expect(landingSourceOf({ url, src: 'utm:Newsletter' })).toBe('newsletter');
        expect(landingSourceOf({ url, src: 'utm:spring%20sale' })).toBe('direct');
        expect(landingSourceOf({ url, src: 'ref:https://www.google.com/search?q=x' })).toBe('google.com');
        expect(landingSourceOf({ url, src: 'ref:' })).toBe('direct');
        expect(landingSourceOf({ url, src: 'ref:https://shop.example.com/' })).toBe('direct');
    });
    it('falls back to the current page for older SDKs, leaving internal visits unknown', () => {
        expect(landingSourceOf({ url: 'https://example.com/?utm_source=ads', referrer: 'https://example.com/' })).toBe('ads');
        expect(landingSourceOf({ url: 'https://example.com/', referrer: 'https://bing.com/' })).toBe('bing.com');
        expect(landingSourceOf({ url: 'https://example.com/', referrer: '' })).toBe('direct');
        expect(landingSourceOf({ url: 'https://example.com/b', referrer: 'https://www.example.com/a' })).toBeNull();
    });
    it('stores device and new or returning', () => {
        expect(segmentOf({ url: 'https://example.com/', userAgent: MOBILE, visitor: 'returning' })).toEqual({ segment_device: 'mobile', segment_source: 'direct', segment_visitor: 'returning' });
        expect(segmentOf({ url: 'https://example.com/', userAgent: null }).segment_visitor).toBeNull();
    });
});

describe('segment statistics', () => {
    const vars = [{ id: 'c', name: 'Control', is_control: true }, { id: 'b', name: 'B', is_control: false }];
    it('compares each variation with the control inside the segment, with a correction across segments', () => {
        const rows = [
            { dim: 'device' as const, key: 'mobile', variation_id: 'c', users: 2000, conversions: 100 },
            { dim: 'device' as const, key: 'mobile', variation_id: 'b', users: 2000, conversions: 200 },
            { dim: 'device' as const, key: 'desktop', variation_id: 'c', users: 2000, conversions: 100 },
            { dim: 'device' as const, key: 'desktop', variation_id: 'b', users: 2000, conversions: 104 },
            { dim: 'device' as const, key: null, variation_id: 'c', users: 50, conversions: 5 },
            { dim: 'device' as const, key: null, variation_id: 'b', users: 50, conversions: 5 },
        ];
        const device = computeSegments(vars, rows).find((d) => d.dim === 'device')!;
        expect(device.comparisons).toBe(2);
        expect(device.segments.map((s) => s.key)).toEqual(['desktop', 'mobile', NOT_RECORDED]);
        const mobile = device.segments.find((s) => s.key === 'mobile')!.variations.find((v) => v.variation_id === 'b')!;
        expect(mobile.lift).toBeCloseTo(1);
        expect(mobile.sequential_significant).toBe(true);
        expect(mobile.chance_to_beat_control).toBeGreaterThan(0.999);
        const desktop = device.segments.find((s) => s.key === 'desktop')!.variations.find((v) => v.variation_id === 'b')!;
        expect(desktop.sequential_significant).toBe(false);
        const nr = device.segments.find((s) => s.key === NOT_RECORDED)!.variations.find((v) => v.variation_id === 'b')!;
        expect(nr.sequential_significant).toBe(false);
        expect(nr.chance_to_beat_control).toBeNull();
    });
    it('needs 100 visitors per version in a segment and groups the long tail of sources', () => {
        const rows = Array.from({ length: MAX_SOURCES + 3 }, (_, i) => [
            { dim: 'source' as const, key: `s${i}.com`, variation_id: 'c', users: 100 - i, conversions: 1 },
            { dim: 'source' as const, key: `s${i}.com`, variation_id: 'b', users: 100 - i, conversions: 50 },
        ]).flat();
        const source = computeSegments(vars, rows).find((d) => d.dim === 'source')!;
        expect(source.segments).toHaveLength(MAX_SOURCES + 1);
        expect(source.segments[MAX_SOURCES].key).toBe(OTHER_SOURCES);
        expect(source.segments[0].variations[1].chance_to_beat_control).not.toBeNull();
        expect(source.segments[1].variations[1].chance_to_beat_control).toBeNull();
        expect(source.segments[1].variations[1].sequential_significant).toBe(false);
    });
    it('is a paid feature', () => {
        expect(computeEntitlements({ plan: 'free' }, ['a@x.com']).features.segments).toBe(false);
        expect(computeEntitlements({ plan: 'starter' }, ['a@x.com']).features.segments).toBe(true);
    });
});

describe('results by segment end to end', () => {
    let cleanup: () => void;
    const t: Record<string, { expId: string; userId: string; sdkKey: string; goalId: string }> = {};

    async function tenant(name: string, plan: string) {
        const u = await db.createUser({ email: `${name}@example.com`, name });
        const ws = await db.ensureWorkspace(u);
        await db.updateOrganization(ws.orgId, { plan });
        await seedProjectDomain(ws.projectId, 'localhost');
        const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'dev')!;
        const sdkKey = (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key;
        session.current = { user: { id: u.id } };
        const data = await (await create(json('POST', '/api/experiments', flowExperimentBody()))).json();
        const expId = data.experiment.id;
        await patch(json('PATCH', `/api/experiments/${expId}`, { status: 'running' }), p(expId));
        const goalId = data.goals.find((g: { is_primary: boolean }) => g.is_primary).id;
        return { expId, userId: u.id, sdkKey, goalId };
    }
    const boot = (key: string, user: string, ua: string, extra: Record<string, unknown> = {}) =>
        bootstrap(json('POST', '/api/sdk/bootstrap', { url: 'http://localhost/demo/control.html', user_id: user, ...extra }, { 'X-API-Key': key, 'User-Agent': ua }));

    beforeAll(async () => {
        cleanup = useTempDatabase();
        t.free = await tenant('sfree', 'free');
        t.paid = await tenant('spaid', 'starter');
        clearConfigCache();
    });
    afterAll(() => cleanup());

    it('stores the segment on the assignment and reports it per variation', async () => {
        const visitors = [
            { id: 'm1', ua: MOBILE, src: 'utm:newsletter', visitor: 'new', convert: true },
            { id: 'm2', ua: MOBILE, src: 'ref:https://google.com/', visitor: 'returning', convert: false },
            { id: 'd1', ua: DESKTOP, src: 'ref:', visitor: 'new', convert: true },
        ];
        for (const v of visitors) {
            expect((await boot(t.paid.sdkKey, v.id, v.ua, { src: v.src, visitor: v.visitor })).status).toBe(200);
            const a = (await db.getAssignment(t.paid.expId, v.id))!;
            await db.createEvent({ experiment_id: t.paid.expId, variation_id: a.variation_id, environment_id: a.environment_id, user_id: v.id, event_type: 'page_view', event_name: null, goal_id: null, metadata: null });
            if (v.convert) await db.createEvent({ experiment_id: t.paid.expId, variation_id: a.variation_id, environment_id: a.environment_id, user_id: v.id, event_type: 'conversion', event_name: 'CTA', goal_id: t.paid.goalId, metadata: null });
        }
        const m1 = (await db.getAssignment(t.paid.expId, 'm1'))!;
        expect([m1.segment_device, m1.segment_source, m1.segment_visitor]).toEqual(['mobile', 'newsletter', 'new']);
        // An existing assignment keeps its first segment.
        await boot(t.paid.sdkKey, 'm1', DESKTOP, { src: 'utm:other' });
        expect((await db.getAssignment(t.paid.expId, 'm1'))!.segment_device).toBe('mobile');

        session.current = { user: { id: t.paid.userId } };
        const res = await segmentsRoute(json('GET', `/api/experiments/${t.paid.expId}/segments`), p(t.paid.expId));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.goal_id).toBe(t.paid.goalId);
        const sum = (dim: string, key: string, f: 'total_users' | 'conversions') =>
            body.dimensions.find((d: { dim: string }) => d.dim === dim).segments.find((s: { key: string }) => s.key === key)
                ?.variations.reduce((a: number, v: Record<string, number>) => a + v[f], 0);
        expect(sum('device', 'mobile', 'total_users')).toBe(2);
        expect(sum('device', 'mobile', 'conversions')).toBe(1);
        expect(sum('device', 'desktop', 'conversions')).toBe(1);
        expect(sum('source', 'google.com', 'total_users')).toBe(1);
        expect(sum('source', 'direct', 'total_users')).toBe(1);
        expect(sum('visitor', 'new', 'conversions')).toBe(2);
        expect((await segmentsRoute(json('GET', `/api/experiments/${t.paid.expId}/segments?goal=nope`), p(t.paid.expId))).status).toBe(400);
    });

    it('is locked on Free and hidden from other accounts', async () => {
        session.current = { user: { id: t.free.userId } };
        const r = await segmentsRoute(json('GET', `/api/experiments/${t.free.expId}/segments`), p(t.free.expId));
        expect(r.status).toBe(403);
        expect((await r.json()).upgrade).toMatch(/paid plans/);
        expect((await segmentsRoute(json('GET', `/api/experiments/${t.paid.expId}/segments`), p(t.paid.expId))).status).toBe(404);
        session.current = null;
        expect((await segmentsRoute(json('GET', `/api/experiments/${t.paid.expId}/segments`), p(t.paid.expId))).status).toBe(401);
    });
});

describe('segment wiring', () => {
    const root = path.join(__dirname, '..');
    const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
    it('SDK sends the session landing value with the bootstrap', () => {
        expect(read('sdk-src/sdk.js')).toMatch(/src: landingSource\(\)/);
    });
    it('migration adds the segment columns with a newer timestamp', () => {
        const j = JSON.parse(read('drizzle/meta/_journal.json')) as { entries: { tag: string; when: number }[] };
        const i = j.entries.findIndex((e) => e.tag === '0031_assignment_segments');
        expect(i).toBeGreaterThan(0);
        expect(j.entries[i].when).toBeGreaterThan(j.entries[i - 1].when);
        expect(read('drizzle/0031_assignment_segments.sql')).toMatch(/ADD `segment_device` text/);
    });
});
