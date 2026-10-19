import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { useTempDatabase, seedProjectDomain } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db, getDb } from '@/lib/db';
import { generateId } from '@/lib/ids';
import { clearConfigCache } from '@/lib/configCache';
import { pickPageHeatmap, pagePreviewUrl, MAX_PAGE_HEATMAPS } from '@/lib/pageHeatmaps';
import { runRetention } from '@/lib/retention';
import { POST as capture } from '@/app/api/capture/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';
import { GET as list, POST as create } from '@/app/api/page-heatmaps/route';
import { GET as getOne, PATCH as patchOne, DELETE as deleteOne } from '@/app/api/page-heatmaps/[id]/route';
import { GET as report } from '@/app/api/page-heatmaps/[id]/heatmaps/route';
import { PATCH as patchSettings } from '@/app/api/page-heatmaps/[id]/heatmaps/settings/route';
import { GET as exportFile } from '@/app/api/page-heatmaps/[id]/heatmaps/export/route';

let cleanup: () => void;
type T = { user: { id: string; email: string }; key: string; projectId: string; exp: string };
const t: Record<string, T> = {};

async function tenant(email: string, plan: string): Promise<T> {
    const u = await db.createUser({ email, name: email });
    const ws = await db.ensureWorkspace(u);
    await db.updateOrganization(ws.orgId, { plan });
    await seedProjectDomain(ws.projectId, 'localhost');
    const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'dev')!;
    const exp = generateId('exp');
    await db.createExperiment({ id: exp, project_id: ws.projectId, user_id: u.id, name: 'Test page', status: 'running', traffic_allocation: 100, control_url: 'http://localhost/tested' },
        [{ name: 'Control', weight: 50, is_control: true, url: 'http://localhost/tested' }, { name: 'B', weight: 50, is_control: false, url: 'http://localhost/tested?b=1' }]);
    return { user: { id: u.id, email }, key: (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key, projectId: ws.projectId, exp };
}
const sdk = (path: string, key: string, body: unknown, text = false) => new NextRequest(`http://localhost${path}${text ? `?key=${key}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': text ? 'text/plain' : 'application/json', Origin: 'http://localhost', ...(text ? {} : { 'X-API-Key': key }) },
    body: JSON.stringify(body),
});
const as = (who: T) => { session.current = { user: who.user }; };
const json = (url: string, method: string, body?: unknown) => new NextRequest(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
const p = (id: string) => ({ params: Promise.resolve({ id }) });
const boot = async (who: T, url: string, user_id: string) => (await bootstrap(sdk('/api/sdk/bootstrap', who.key, { url, user_id }))).json();
const pageBatch = (id: string, events: unknown[], variation = 'page') => ({ experiment_id: id, variation_id: variation, device: 'desktop', events, src: 'google.com', vid: 'v1' });

let hm = '';

beforeAll(async () => {
    cleanup = useTempDatabase();
    process.env.HEATMAP_SAMPLE_RATE = '1';
    t.free = await tenant('free-ph@example.com', 'free');
    t.paid = await tenant('paid-ph@example.com', 'starter');
    t.other = await tenant('other-ph@example.com', 'starter');
    clearConfigCache();
});
afterAll(() => { delete process.env.HEATMAP_SAMPLE_RATE; cleanup(); });

describe('page heatmaps API', () => {
    it('is paid only', async () => {
        as(t.free);
        expect((await list(json('/api/page-heatmaps', 'GET'))).status).toBe(403);
        expect((await create(json('/api/page-heatmaps', 'POST', { name: 'x', match: 'equals', match_value: '/x' }))).status).toBe(403);
    });

    it('validates and creates, active right away', async () => {
        as(t.paid);
        expect((await create(json('/api/page-heatmaps', 'POST', { name: 'x', match: 'equals', match_value: '' }))).status).toBe(400);
        expect((await create(json('/api/page-heatmaps', 'POST', { name: 'x', match: 'equals', match_value: '/x', preview_url: 'javascript:alert(1)' }))).status).toBe(400);
        expect((await create(json('/api/page-heatmaps', 'POST', { name: 'x', match: 'regex', match_value: '/x' }))).status).toBe(400);
        const res = await create(json('/api/page-heatmaps', 'POST', { name: 'Landing', match: 'starts_with', match_value: '/landing' }));
        expect(res.status).toBe(201);
        const body = await res.json();
        hm = body.heatmap.id;
        expect(hm.startsWith('phm_')).toBe(true);
        expect(body.heatmap).toMatchObject({ status: 'active', rule: 'Page address starts with /landing', collection: { collecting: true, views: 0, sample_percent: 100 } });
        const l = await (await list(json('/api/page-heatmaps', 'GET'))).json();
        expect(l.heatmaps.map((h: { id: string }) => h.id)).toEqual([hm]);
        expect(l.max).toBe(MAX_PAGE_HEATMAPS);
    });

    it('caps page heatmaps per project', async () => {
        as(t.other);
        for (let i = 0; i < MAX_PAGE_HEATMAPS; i++) expect((await create(json('/api/page-heatmaps', 'POST', { name: `h${i}`, match: 'equals', match_value: `/p${i}` }))).status).toBe(201);
        const res = await create(json('/api/page-heatmaps', 'POST', { name: 'one more', match: 'equals', match_value: '/x' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toMatch(/up to 10/);
    });

    it('never reaches another account\'s page heatmap', async () => {
        as(t.other);
        expect((await getOne(json(`/api/page-heatmaps/${hm}`, 'GET'), p(hm))).status).toBe(404);
        expect((await patchOne(json(`/api/page-heatmaps/${hm}`, 'PATCH', { status: 'paused' }), p(hm))).status).toBe(404);
        expect((await deleteOne(json(`/api/page-heatmaps/${hm}`, 'DELETE'), p(hm))).status).toBe(404);
        expect((await report(json(`/api/page-heatmaps/${hm}/heatmaps`, 'GET'), p(hm))).status).toBe(404);
    });
});

describe('bootstrap', () => {
    it('loads heatmap.js on matching pages without a test, for paid orgs only', async () => {
        const r = await boot(t.paid, 'http://localhost/landing/spring?utm_source=x', 'v1');
        expect(r.matched).toBe(false);
        expect(r.page_heatmap).toEqual({ id: hm });
        expect(r.modules).toContain('heatmap');
        expect((await boot(t.paid, 'http://localhost/pricing', 'v1')).page_heatmap).toBeUndefined();
        const free = await boot(t.free, 'http://localhost/landing', 'v1');
        expect(free.page_heatmap).toBeUndefined();
        expect(free.modules ?? []).not.toContain('heatmap');
    });

    it('leaves visitors in a test to the test heatmap', async () => {
        as(t.paid);
        const res = await create(json('/api/page-heatmaps', 'POST', { name: 'Everything', match: 'contains', match_value: 'localhost' }));
        const all = (await res.json()).heatmap.id;
        const r = await boot(t.paid, 'http://localhost/tested', 'visitor-t');
        expect(r.matched).toBe(true);
        expect(r.page_heatmap).toBeUndefined();
        expect((await boot(t.paid, 'http://localhost/about', 'visitor-t')).page_heatmap).toEqual({ id: all });
        await deleteOne(json(`/api/page-heatmaps/${all}`, 'DELETE'), p(all));
    });

    it('honours pause, sample and stop rules', async () => {
        as(t.paid);
        await patchOne(json(`/api/page-heatmaps/${hm}`, 'PATCH', { status: 'paused' }), p(hm));
        expect((await boot(t.paid, 'http://localhost/landing', 'v1')).page_heatmap).toBeUndefined();
        await patchOne(json(`/api/page-heatmaps/${hm}`, 'PATCH', { status: 'active' }), p(hm));
        const rows = await db.listPageHeatmaps(t.paid.projectId);
        const row = rows.find((h) => h.id === hm)!;
        let n = 0;
        for (let i = 0; i < 2000; i++) if (pickPageHeatmap([{ ...row, heatmap_sample: 10 }], 'http://localhost/landing', `u${i}`)) n++;
        expect(n / 2000).toBeGreaterThan(0.07);
        expect(n / 2000).toBeLessThan(0.13);
        expect(pickPageHeatmap([{ ...row, heatmap_stop_views: 100, heatmap_views: 100 }], 'http://localhost/landing', 'v1')).toBeNull();
        expect(pickPageHeatmap([{ ...row, heatmap_stop_days: 1, heatmap_since: '2020-01-01T00:00:00.000Z' }], 'http://localhost/landing', 'v1')).toBeNull();
    });
});

describe('capture and report', () => {
    it('stores page batches in the page tables and counts page views', async () => {
        const events = [{ t: 'c', x: 500, y: 110, sel: 'button.buy' }, { t: 'c', x: 505, y: 112, sel: 'button.buy', rage: true }, { t: 'c', x: 100, y: 900, sel: 'div.hero', dead: true }, { t: 's', d: 74 }];
        const res = await capture(sdk('/api/capture', t.paid.key, pageBatch(hm, events), true));
        expect(res.status).toBe(202);
        expect((await res.json()).accepted).toBe(4);
        const d = await getDb();
        expect(Number((await d.all<{ n: number }>(sql`select count(*) as n from page_heatmap_points where heatmap_id = ${hm}`))[0].n)).toBe(3);
        expect(Number((await d.all<{ n: number }>(sql`select count(*) as n from heatmap_points`))[0].n)).toBe(0);
        expect((await db.getPageHeatmap(hm))!.heatmap_views).toBe(1);
    });

    it('refuses other projects, unknown versions, paused heatmaps and free orgs', async () => {
        const ev = [{ t: 'c', x: 1, y: 1, sel: 'a' }];
        expect((await capture(sdk('/api/capture', t.other.key, pageBatch(hm, ev), true))).status).toBe(404);
        expect((await capture(sdk('/api/capture', t.paid.key, pageBatch(hm, ev, 'B'), true))).status).toBe(400);
        expect((await capture(sdk('/api/capture', t.free.key, pageBatch(hm, ev), true))).status).toBe(403);
        expect((await capture(sdk('/api/capture', t.paid.key, pageBatch('phm_missing', ev), true))).status).toBe(404);
        await db.updatePageHeatmap(hm, { status: 'paused' });
        expect((await capture(sdk('/api/capture', t.paid.key, pageBatch(hm, ev), true))).status).toBe(404);
        await db.updatePageHeatmap(hm, { status: 'active' });
    });

    it('drops batches quietly once a stop rule is reached, and a new period starts again', async () => {
        as(t.paid);
        await db.updatePageHeatmap(hm, { stop_views: 100 });
        await getDb().then((d) => d.run(sql`update page_heatmaps set heatmap_views = 100 where id = ${hm}`));
        const res = await capture(sdk('/api/capture', t.paid.key, pageBatch(hm, [{ t: 'c', x: 1, y: 1, sel: 'a' }]), true));
        expect(await res.json()).toMatchObject({ accepted: 0, stopped: true });
        const s = await (await patchSettings(json(`/api/page-heatmaps/${hm}/heatmaps/settings`, 'PATCH', { restart: true, stop_views: null }), p(hm))).json();
        expect(s).toMatchObject({ collecting: true, views: 0, stop_views: null });
    });

    it('reports in the same shape as a test heatmap, without the converted filter', async () => {
        as(t.paid);
        const r = await (await report(json(`/api/page-heatmaps/${hm}/heatmaps?converted=yes`, 'GET'), p(hm))).json();
        expect(r.variations).toHaveLength(1);
        expect(r.filters).toEqual({});
        expect(r.totals).toMatchObject({ clicks: 3, rage: 1, dead: 1, sessions: 1 });
        expect(r.list[0]).toMatchObject({ selector: 'button.buy', clicks: 2 });
        expect(r.sources).toEqual([{ source: 'google.com', clicks: 3 }]);
        const f = await (await report(json(`/api/page-heatmaps/${hm}/heatmaps?source=bing.com`, 'GET'), p(hm))).json();
        expect(f.totals.clicks).toBe(0);
        const file = await exportFile(json(`/api/page-heatmaps/${hm}/heatmaps/export`, 'GET'), p(hm));
        expect(file.headers.get('Content-Disposition')).toMatch(/attachment; filename="heatmaps-landing-all-/);
        const body = JSON.parse(await file.text());
        expect(body.page_heatmap).toMatchObject({ id: hm, pages: 'Page address starts with /landing' });
        expect(body.variations[0].totals.clicks).toBe(3);
    });

    it('uses the preview address, or the rule when it is a full address, for the overlay', () => {
        expect(pagePreviewUrl({ match: 'equals', match_value: 'https://shop.example/a', preview_url: null })).toBe('https://shop.example/a');
        expect(pagePreviewUrl({ match: 'contains', match_value: 'https://shop.example/a', preview_url: null })).toBeNull();
        expect(pagePreviewUrl({ match: 'equals', match_value: '/a', preview_url: 'https://shop.example/a' })).toBe('https://shop.example/a');
    });
});

describe('retention and delete', () => {
    it('removes raw page clicks after 30 days and keeps daily totals', async () => {
        const d = await getDb();
        await d.run(sql`update page_heatmap_points set created_at = '2020-01-01T00:00:00.000Z' where selector = 'div.hero'`);
        await d.run(sql`update page_heatmap_scroll_points set created_at = '2020-01-01T00:00:00.000Z'`);
        await d.run(sql`delete from maintenance_runs`);
        const r = await runRetention();
        expect(r?.heatmapPoints).toBeGreaterThanOrEqual(1);
        expect(r?.heatmapScrolls).toBeGreaterThanOrEqual(1);
        expect(Number((await d.all<{ n: number }>(sql`select count(*) as n from page_heatmap_points where heatmap_id = ${hm}`))[0].n)).toBe(2);
        expect(Number((await d.all<{ n: number }>(sql`select count(*) as n from page_heatmap_clicks_daily where heatmap_id = ${hm}`))[0].n)).toBeGreaterThan(0);
    });

    it('deleting a page heatmap deletes its data', async () => {
        as(t.paid);
        expect((await deleteOne(json(`/api/page-heatmaps/${hm}`, 'DELETE'), p(hm))).status).toBe(200);
        const d = await getDb();
        for (const table of ['page_heatmap_points', 'page_heatmap_scroll_points', 'page_heatmap_clicks_daily', 'page_heatmap_scroll_daily']) {
            expect(Number((await d.all<{ n: number }>(sql.raw(`select count(*) as n from ${table} where heatmap_id = '${hm}'`)))[0].n)).toBe(0);
        }
        const audit = await d.all<{ action: string }>(sql`select action from audit_log where entity = 'page_heatmap' and entity_id = ${hm} order by created_at`);
        expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(['create', 'update', 'heatmaps:restart', 'heatmap:export', 'delete']));
    });
});

describe('capture module', () => {
    const src = fs.readFileSync('public/heatmap.js', 'utf8');
    it('reads a page heatmap from the module reply, with the key from the install snippet', () => {
        expect(src).toContain('pageConfig(window.__ABTestMod)');
        expect(src).toContain("variation_id: 'page'");
        expect(src).not.toMatch(/keydown|keyup|keypress|'input'|"input"\s*,|\.value\b|innerText|textContent|innerHTML/);
    });
    it('leaves the install snippet unchanged', () => {
        expect(fs.readFileSync('sdk-src/sdk.js', 'utf8')).not.toContain('page_heatmap');
    });
});
