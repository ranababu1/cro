import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain } from './helpers';
import { lastDays, summarizeTraffic, trafficDimensions } from '@/lib/traffic';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';
import { GET as traffic } from '@/app/api/traffic/route';
import { bumpTraffic, flushTelemetry, pendingTelemetry } from '@/lib/telemetry';

describe('traffic dimensions', () => {
    const keys = (h: Parameters<typeof trafficDimensions>[0]) => trafficDimensions(h).map((d) => `${d.dim}:${d.key}`).sort();
    it('counts an entry from another site with its source, device and country', () => {
        expect(keys({ url: 'https://www.shop.com/pricing/?a=1', referrer: 'https://www.google.com/search', userAgent: 'Mozilla/5.0 (iPhone)', country: 'in', visitor: 'new' }))
            .toEqual(['country:IN', 'device:mobile', 'entries:', 'new_views:', 'page:/pricing', 'source:google.com', 'views:'].sort());
    });
    it('prefers utm_source, uses direct with no referrer, and skips internal clicks as sources', () => {
        expect(keys({ url: 'https://shop.com/?utm_source=Newsletter', referrer: 'https://mail.example.com/' })).toContain('source:newsletter');
        expect(keys({ url: 'https://shop.com/' })).toContain('source:direct');
        const internal = keys({ url: 'https://shop.com/b', referrer: 'https://www.shop.com/a', visitor: 'returning' });
        expect(internal.some((k) => k.startsWith('source:') || k === 'entries:' || k === 'new_views:')).toBe(false);
        expect(internal).toContain('page:/b');
        expect(keys({ url: 'not a url' })).toEqual([]);
        expect(keys({ url: 'https://shop.com/x', country: 'XX1' }).some((k) => k.startsWith('country:'))).toBe(false);
    });
    it('summarizes with zero-filled days and top keys', () => {
        const days = lastDays(3, new Date('2026-10-19T12:00:00Z'));
        expect(days).toEqual(['2026-10-17', '2026-10-18', '2026-10-19']);
        const s = summarizeTraffic(
            [{ day: '2026-10-18', dim: 'views', key: '', views: 5 }, { day: '2026-10-19', dim: 'entries', key: '', views: 2 }],
            [{ dim: 'page', key: '/a', views: 1 }, { dim: 'page', key: '/b', views: 4 }],
            days,
        );
        expect(s.days.map((d) => d.views)).toEqual([0, 5, 0]);
        expect(s.totals).toEqual({ views: 5, entries: 2, new_views: 0 });
        expect(s.pages.map((p) => p.key)).toEqual(['/b', '/a']);
    });
});

describe('traffic overview end to end', () => {
    let cleanup: () => void;
    const t: Record<string, { userId: string; orgId: string; key: string; projectId: string }> = {};
    const prevSync = process.env.TELEMETRY_SYNC;
    async function tenant(name: string, plan: string, opts: { special?: boolean } = {}) {
        const u = await db.createUser({ email: `${name}@example.com`, name });
        const ws = await db.ensureWorkspace(u);
        await db.updateOrganization(ws.orgId, { plan, ...(opts.special ? { special_friend: true, custom_allowances: JSON.stringify({ traffic: true }) } : {}) });
        await seedProjectDomain(ws.projectId, 'localhost');
        const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'prod')!;
        return { userId: u.id, orgId: ws.orgId, projectId: ws.projectId, key: (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key };
    }
    const boot = (key: string, url: string, referrer = '') => bootstrap(new NextRequest('http://localhost/api/sdk/bootstrap', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': key, Origin: 'http://localhost', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0)', 'x-vercel-ip-country': 'DE' },
        body: JSON.stringify({ url, user_id: 'v1', referrer, visitor: 'new' }),
    }));
    const get = (q = '') => traffic(new NextRequest(`http://localhost/api/traffic${q}`));

    beforeAll(async () => {
        cleanup = useTempDatabase();
        t.free = await tenant('tfree', 'free');
        t.paid = await tenant('tpaid', 'starter');
        t.friend = await tenant('tfriend', 'free', { special: true });
        clearConfigCache();
    });
    afterAll(() => { process.env.TELEMETRY_SYNC = prevSync; cleanup(); });

    it('free plans record nothing and cannot open the report', async () => {
        await boot(t.free.key, 'http://localhost/home');
        await flushTelemetry();
        expect((await db.getEnvironments(t.free.projectId)).length).toBeGreaterThan(0);
        const env = (await db.getEnvironments(t.free.projectId)).find((e) => e.key === 'prod')!;
        expect((await db.getTraffic(env.id, '2000-01-01', '2100-01-01')).daily).toEqual([]);
        session.current = { user: { id: t.free.userId } };
        const res = await get();
        expect(res.status).toBe(403);
        expect((await res.json()).upgrade).toMatch(/paid plans/);
        session.current = null;
        expect((await get()).status).toBe(401);
    });

    it('paid plans and special friends get page views, pages, sources, devices and countries', async () => {
        await boot(t.paid.key, 'http://localhost/home', 'https://www.google.com/');
        await boot(t.paid.key, 'http://localhost/pricing', 'http://localhost/home');
        await boot(t.paid.key, 'http://localhost/pricing?x=1');
        session.current = { user: { id: t.paid.userId } };
        const res = await get('?days=7');
        expect(res.status).toBe(200);
        const d = await res.json();
        expect(d.range).toBe(7);
        expect(d.days).toHaveLength(7);
        expect(d.totals).toEqual({ views: 3, entries: 2, new_views: 3 });
        expect(d.pages).toEqual([{ key: '/pricing', views: 2 }, { key: '/home', views: 1 }]);
        expect(d.sources.map((s: { key: string }) => s.key).sort()).toEqual(['direct', 'google.com']);
        expect(d.devices).toEqual([{ key: 'desktop', views: 3 }]);
        expect(d.countries).toEqual([{ key: 'DE', views: 3 }]);
        expect((await get('?environment=nope')).status).toBe(400);
        const dev = await (await get('?environment=dev')).json();
        expect(dev.totals.views).toBe(0);

        await boot(t.friend.key, 'http://localhost/a');
        session.current = { user: { id: t.friend.userId } };
        expect((await (await get()).json()).totals.views).toBe(1);
    });

    it('batches counters in memory and writes them in one flush', async () => {
        process.env.TELEMETRY_SYNC = '0';
        await flushTelemetry();
        const env = (await db.getEnvironments(t.paid.projectId)).find((e) => e.key === 'prod')!;
        const dims = trafficDimensions({ url: 'http://localhost/batch' });
        for (let i = 0; i < 25; i++) await bumpTraffic({ environmentId: env.id, projectId: t.paid.projectId }, dims);
        // 25 page views merge into one buffered row per dimension.
        expect(pendingTelemetry()).toBe(dims.length);
        const spy = vi.spyOn(db, 'bumpTelemetryBatch');
        await flushTelemetry();
        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
        process.env.TELEMETRY_SYNC = prevSync;
        session.current = { user: { id: t.paid.userId } };
        const d = await (await get()).json();
        expect(d.pages.find((p: { key: string }) => p.key === '/batch').views).toBe(25);
    });
});

describe('traffic wiring', () => {
    const read = (f: string) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    it('bootstrap records traffic only for entitled orgs and pricing lists it', () => {
        expect(read('app/api/sdk/bootstrap/route.ts')).toMatch(/canUseFeature\(auth\.ctx\.orgId, 'traffic'\)/);
        expect(read('app/pricing/page.tsx')).toMatch(/\['Traffic overview', 'Not included', 'Included'/);
        expect(read('app/components/shell/AppShell.tsx')).toMatch(/href: '\/traffic'/);
    });
    it('migration is newer than every earlier one', () => {
        const j = JSON.parse(read('drizzle/meta/_journal.json')) as { entries: { tag: string; when: number }[] };
        const i = j.entries.findIndex((e) => e.tag === '0021_traffic_daily');
        expect(i).toBeGreaterThan(0);
        for (const e of j.entries.slice(0, i)) expect(j.entries[i].when).toBeGreaterThan(e.when);
    });
});
