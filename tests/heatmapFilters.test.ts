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
import { captureSchema, normalizeSource, normalizeVisitor, parseHeatmapQuery } from '@/lib/heatmaps';
import { runRetention } from '@/lib/retention';
import { POST as capture } from '@/app/api/capture/route';
import { GET as report } from '@/app/api/experiments/[id]/heatmaps/route';
import { GET as exportJson } from '@/app/api/experiments/[id]/heatmaps/export/route';

let cleanup: () => void;
let user: { id: string; email: string };
let key = '';
let exp = '';
let control = '';
let other = '';

const send = (variation: string, device: string, events: unknown[], src?: string, vid?: string) => capture(new NextRequest('http://localhost/api/capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', 'X-API-Key': key },
    body: JSON.stringify({ experiment_id: exp, variation_id: variation, device, events, ...(src !== undefined ? { src } : {}), ...(vid !== undefined ? { vid } : {}) }),
}));
const get = async (q: string) => {
    session.current = { user };
    const r = await report(new NextRequest(`http://localhost/api/experiments/${exp}/heatmaps?variation=${control}&${q}`), { params: Promise.resolve({ id: exp }) });
    expect(r.status).toBe(200);
    return r.json();
};

beforeAll(async () => {
    cleanup = useTempDatabase();
    process.env.HEATMAP_SAMPLE_RATE = '1';
    const u = await db.createUser({ email: 'f@example.com', name: 'F' });
    user = { id: u.id, email: 'f@example.com' };
    const ws = await db.ensureWorkspace(u);
    await db.updateOrganization(ws.orgId, { plan: 'starter' });
    await seedProjectDomain(ws.projectId, 'localhost');
    const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'dev')!;
    exp = generateId('exp');
    await db.createExperiment({ id: exp, project_id: ws.projectId, user_id: u.id, name: 'F', status: 'running', traffic_allocation: 100, control_url: 'http://localhost/page' },
        [{ name: 'Control', weight: 50, is_control: true, url: 'http://localhost/page' }, { name: 'B', weight: 50, is_control: false, url: 'http://localhost/b' }]);
    const vars = await db.getVariations(exp);
    control = vars.find((v) => v.is_control)!.id;
    other = vars.find((v) => !v.is_control)!.id;
    key = (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key;
    clearConfigCache();

    expect((await send(control, 'desktop', [{ t: 'c', x: 500, y: 100, sel: 'button.buy' }, { t: 'c', x: 510, y: 100, sel: 'button.buy' }, { t: 's', d: 83 }], 'Google', 'u_buyer')).status).toBe(202);
    expect((await send(control, 'mobile', [{ t: 'c', x: 100, y: 600, sel: 'a.faq' }, { t: 's', d: 40 }], 'newsletter', 'u_reader')).status).toBe(202);
    expect((await send(control, 'desktop', [{ t: 'c', x: 990, y: 20, sel: 'a.logo' }], 'direct')).status).toBe(202);
    const d = await getDb();
    await d.run(sql`insert into events (id, experiment_id, variation_id, user_id, event_type) values ('ev1', ${exp}, ${control}, 'u_buyer', 'conversion')`);
});
afterAll(() => { delete process.env.HEATMAP_SAMPLE_RATE; cleanup(); });

describe('heatmap filter inputs', () => {
    it('normalizes source and visitor and keeps the capture schema strict', () => {
        expect(normalizeSource('WWW.Google.com')).toBe('google.com');
        expect(normalizeSource('bad source<script>')).toBe('');
        expect(normalizeVisitor('u_1:abc-2')).toBe('u_1:abc-2');
        expect(normalizeVisitor('x y')).toBe('');
        expect(captureSchema.safeParse({ experiment_id: 'e', variation_id: 'v', device: 'desktop', events: [], src: 'x', vid: 'y' }).success).toBe(true);
        expect(captureSchema.safeParse({ experiment_id: 'e', variation_id: 'v', device: 'desktop', events: [], src: 'x'.repeat(81) }).success).toBe(false);
        expect(captureSchema.safeParse({ experiment_id: 'e', variation_id: 'v', device: 'desktop', events: [], value: 'secret' }).success).toBe(false);
    });

    it('parses range and filters from the query', () => {
        expect(parseHeatmapQuery(new URLSearchParams('days=7&source=Google&converted=yes'))).toEqual({ days: 7, filters: { source: 'google', converted: 'yes' } });
        expect(parseHeatmapQuery(new URLSearchParams('days=365&converted=maybe'))).toEqual({ days: 30, filters: {} });
    });

    it('stores source, visitor and one scroll row per scroll event', async () => {
        const d = await getDb();
        const pts = await d.all<{ source: string; visitor: string }>(sql`select source, visitor from heatmap_points order by id`);
        expect(pts.map((p) => p.source)).toEqual(['google', 'google', 'newsletter', 'direct']);
        expect(pts[3].visitor).toBe('');
        const sc = await d.all<{ depth: number; source: string }>(sql`select depth, source from heatmap_scroll_points order by id`);
        expect(sc).toEqual([{ depth: 80, source: 'google' }, { depth: 40, source: 'newsletter' }]);
    });
});

describe('filtered reports', () => {
    it('unfiltered report is unchanged and lists sources', async () => {
        const all = await get('device=all&days=30');
        expect(all.totals.clicks).toBe(4);
        expect(all.filters).toEqual({});
        expect(all.sources).toEqual([{ source: 'google', clicks: 2 }, { source: 'direct', clicks: 1 }, { source: 'newsletter', clicks: 1 }]);
    });

    it('filters by source, including scroll and devices', async () => {
        const g = await get('device=all&source=google');
        expect(g.totals).toEqual({ clicks: 2, rage: 0, dead: 0, sessions: 1 });
        expect(g.list).toEqual([{ selector: 'button.buy', clicks: 2, rage: 0, dead: 0 }]);
        expect(g.devices.desktop.clicks).toBe(2);
        expect(g.devices.mobile.clicks).toBe(0);
        expect(g.scroll.find((s: { depth: number }) => s.depth === 80).reach).toBe(100);
        expect(g.grid).toEqual([{ gx: 25, gy: 4, clicks: 2 }]);
        expect(g.confetti).toHaveLength(2);
    });

    it('filters by converted visitors', async () => {
        const yes = await get('device=all&converted=yes');
        expect(yes.totals.clicks).toBe(2);
        const no = await get('device=all&converted=no');
        expect(no.list.map((r: { selector: string }) => r.selector)).toEqual(['a.faq']); // clicks without a visitor id are left out
        const none = await get('device=desktop&source=newsletter');
        expect(none.totals.clicks).toBe(0);
    });

    it('caps a filtered range at 30 days', async () => {
        const r = await get('days=90&source=google');
        expect(r.days).toBe(30);
        expect((await get('days=90')).days).toBe(90);
    });

    it('applies the filters to the export', async () => {
        session.current = { user };
        const r = await exportJson(new NextRequest(`http://localhost/api/experiments/${exp}/heatmaps/export?device=all&source=newsletter&days=90`), { params: Promise.resolve({ id: exp }) });
        const j = await r.json();
        expect(j.filters).toEqual({ source: 'newsletter' });
        expect(j.period_days).toBe(30);
        const c = j.variations.find((v: { id: string }) => v.id === control);
        expect(c.totals.clicks).toBe(1);
        expect(j.variations.find((v: { id: string }) => v.id === other).totals.clicks).toBe(0);
    });
});

describe('retention and capture script', () => {
    it('deletes old scroll rows with old clicks', async () => {
        const d = await getDb();
        await d.run(sql`update heatmap_scroll_points set created_at = '2020-01-01T00:00:00.000Z' where source = 'newsletter'`);
        const r = await runRetention(new Date(Date.now() + 2 * 3_600_000)); // after the hourly claim taken by capture
        expect(r?.heatmapScrolls).toBe(1);
        expect(Number((await d.all<{ n: number }>(sql`select count(*) as n from heatmap_scroll_points`))[0].n)).toBe(1);
    });

    it('sends the landing source and visitor id, and still never reads keys or values', () => {
        const js = fs.readFileSync('public/heatmap.js', 'utf8');
        expect(js).toContain('utm_source');
        expect(js).toContain('getUserId');
        expect(js).toMatch(/src: src/);
        expect(js).not.toMatch(/keydown|keypress|\.value\b|innerText|textContent/);
    });
});
