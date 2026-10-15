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
import { isSampled, pruneHeatmapPoints, captureSchema } from '@/lib/heatmaps';
import { POST as capture } from '@/app/api/capture/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';
import { GET as report } from '@/app/api/experiments/[id]/heatmaps/route';

let cleanup: () => void;
type T = { user: { id: string; email: string }; key: string; exp: string; vars: { id: string; is_control: boolean }[] };
const t: Record<string, T> = {};

async function tenant(email: string, plan: string): Promise<T> {
    const u = await db.createUser({ email, name: email });
    const ws = await db.ensureWorkspace(u);
    await db.updateOrganization(ws.orgId, { plan });
    await seedProjectDomain(ws.projectId, 'localhost');
    const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'dev')!;
    const exp = generateId('exp');
    await db.createExperiment({ id: exp, project_id: ws.projectId, user_id: u.id, name: 'H', status: 'running', traffic_allocation: 100, control_url: 'http://localhost/page' },
        [{ name: 'Control', weight: 50, is_control: true, url: 'http://localhost/page' }, { name: 'B', weight: 50, is_control: false, url: 'http://localhost/page-b' }]);
    return { user: { id: u.id, email }, key: (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key, exp, vars: await db.getVariations(exp) };
}
const sdk = (path: string, key: string, body: unknown, text = false) => new NextRequest(`http://localhost${path}${text ? `?key=${key}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': text ? 'text/plain' : 'application/json', Origin: 'http://localhost', ...(text ? {} : { 'X-API-Key': key }) },
    body: JSON.stringify(body),
});
const batch = (who: T, variation: string, device: string, events: unknown[]) => ({ experiment_id: who.exp, variation_id: variation, device, events });
const getReport = (who: T, q: string) => { session.current = { user: who.user }; return report(new NextRequest(`http://localhost/api/experiments/${who.exp}/heatmaps?${q}`), { params: Promise.resolve({ id: who.exp }) }); };

beforeAll(async () => {
    cleanup = useTempDatabase();
    process.env.HEATMAP_SAMPLE_RATE = '1';
    t.free = await tenant('free@example.com', 'free');
    t.paid = await tenant('paid@example.com', 'starter');
    clearConfigCache();
});
afterAll(() => { delete process.env.HEATMAP_SAMPLE_RATE; cleanup(); });

describe('sampling and bootstrap', () => {
    it('is deterministic per visitor and close to the rate', () => {
        expect(isSampled('v1', 'e1', 0.5)).toBe(isSampled('v1', 'e1', 0.5));
        let n = 0;
        for (let i = 0; i < 4000; i++) if (isSampled(`v${i}`, 'e1', 0.25)) n++;
        expect(n / 4000).toBeGreaterThan(0.2);
        expect(n / 4000).toBeLessThan(0.3);
        expect(isSampled('v', 'e', 0)).toBe(false);
    });

    it('offers capture only to paid orgs on matched pages, and honours the sample rate', async () => {
        const body = { url: 'http://localhost/page', user_id: 'visitor-1' };
        expect((await (await bootstrap(sdk('/api/sdk/bootstrap', t.free.key, body))).json()).capture).toBeUndefined();
        // Find a visitor bucketed into the control, so they stay on this page (redirects carry no capture).
        let paid: { matched: boolean; action: string; capture?: unknown } = { matched: false, action: 'none' };
        for (let i = 0; i < 40 && paid.action !== 'stay'; i++) {
            body.user_id = `visitor-${i}`;
            paid = await (await bootstrap(sdk('/api/sdk/bootstrap', t.paid.key, body))).json();
            if (paid.action === 'redirect') expect(paid.capture).toBeUndefined();
        }
        expect(paid.matched).toBe(true);
        expect(paid.capture).toEqual({ heatmaps: true, sample_rate: 1 });
        process.env.HEATMAP_SAMPLE_RATE = '0';
        expect((await (await bootstrap(sdk('/api/sdk/bootstrap', t.paid.key, body))).json()).capture).toMatchObject({ heatmaps: false });
        process.env.HEATMAP_SAMPLE_RATE = '1';
        expect((await (await bootstrap(sdk('/api/sdk/bootstrap', t.paid.key, { url: 'http://localhost/other', user_id: 'v3' }))).json()).capture).toBeUndefined();
    });
});

describe('capture ingest', () => {
    it('refuses free orgs even with a valid batch', async () => {
        const res = await capture(sdk('/api/capture', t.free.key, batch(t.free, t.free.vars[0].id, 'desktop', [{ t: 'c', x: 500, y: 100, sel: 'button.buy' }])));
        expect(res.status).toBe(403);
    });

    it('privacy: rejects keystrokes, values, text or unknown fields', () => {
        const base = batch(t.paid, 'v', 'desktop', []);
        expect(captureSchema.safeParse({ ...base, events: [{ t: 'k', key: 'a' }] }).success).toBe(false);
        expect(captureSchema.safeParse({ ...base, events: [{ t: 'c', x: 1, y: 1, sel: 'input', value: 'secret' }] }).success).toBe(false);
        expect(captureSchema.safeParse({ ...base, events: [{ t: 'c', x: 1, y: 1, sel: 'div', text: 'hello' }] }).success).toBe(false);
        expect(captureSchema.safeParse({ ...base, events: [{ t: 'c', x: 1, y: 1, sel: '<script>' }] }).success).toBe(false);
        expect(captureSchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
        expect(captureSchema.safeParse({ ...base, events: Array(201).fill({ t: 's', d: 10 }) }).success).toBe(false);
    });

    it('stores batched clicks and scroll into rollups, per device and variation, via beacon text/plain', async () => {
        const [control, b] = t.paid.vars.sort((x, y) => Number(y.is_control) - Number(x.is_control));
        const clicks = [
            { t: 'c', x: 500, y: 110, sel: 'button.buy' }, { t: 'c', x: 505, y: 112, sel: 'button.buy' },
            { t: 'c', x: 500, y: 111, sel: 'button.buy', rage: true }, { t: 'c', x: 100, y: 900, sel: 'div.hero > img', dead: true },
            { t: 's', d: 74 },
        ];
        expect((await capture(sdk('/api/capture', t.paid.key, batch(t.paid, control.id, 'desktop', clicks), true))).status).toBe(202);
        expect((await capture(sdk('/api/capture', t.paid.key, batch(t.paid, control.id, 'mobile', [{ t: 'c', x: 900, y: 50, sel: 'a.menu' }, { t: 's', d: 100 }])))).status).toBe(202);
        expect((await capture(sdk('/api/capture', t.paid.key, batch(t.paid, b.id, 'desktop', [{ t: 'c', x: 10, y: 10, sel: 'a.logo' }])))).status).toBe(202);
        expect((await capture(sdk('/api/capture', t.paid.key, batch(t.paid, 'var_nope', 'desktop', [])))).status).toBe(400);

        const d = await getDb();
        const rows = await d.all<{ n: number }>(sql`select count(*) as n from heatmap_clicks_daily`);
        expect(Number(rows[0].n)).toBe(4); // three buy clicks share one cell and selector

        const all = await (await getReport(t.paid, `variation=${control.id}&device=all`)).json();
        expect(all.totals).toEqual({ clicks: 5, rage: 1, dead: 1, sessions: 2 });
        expect(all.list[0]).toEqual({ selector: 'button.buy', clicks: 3, rage: 1, dead: 0 });
        expect(all.devices.desktop.clicks).toBe(4);
        expect(all.devices.mobile.clicks).toBe(1);
        expect(all.scroll.find((s: { depth: number }) => s.depth === 70).reach).toBe(100);
        expect(all.scroll.find((s: { depth: number }) => s.depth === 100).reach).toBe(50);
        expect(all.confetti).toHaveLength(5);

        const mobile = await (await getReport(t.paid, `variation=${control.id}&device=mobile`)).json();
        expect(mobile.totals.clicks).toBe(1);
        const variationB = await (await getReport(t.paid, `variation=${b.id}`)).json();
        expect(variationB.variation.name).toBe('B');
        expect(variationB.totals.clicks).toBe(1);
    });

    it('rejects stopped experiments', async () => {
        const d = await getDb();
        await d.run(sql`update experiments set status = 'completed' where id = ${t.paid.exp}`);
        expect((await capture(sdk('/api/capture', t.paid.key, batch(t.paid, t.paid.vars[0].id, 'desktop', [])))).status).toBe(404);
        await d.run(sql`update experiments set status = 'running' where id = ${t.paid.exp}`);
    });
});

describe('reports and retention', () => {
    it('reports are paid only and owner only', async () => {
        expect((await getReport(t.free, '')).status).toBe(403);
        session.current = { user: t.free.user };
        const other = await report(new NextRequest(`http://localhost/api/experiments/${t.paid.exp}/heatmaps`), { params: Promise.resolve({ id: t.paid.exp }) });
        expect(other.status).toBe(404);
    });

    it('prunes raw points after 30 days and keeps rollups', async () => {
        const d = await getDb();
        await d.run(sql`update heatmap_points set created_at = '2020-01-01T00:00:00.000Z' where selector = 'a.menu'`);
        await pruneHeatmapPoints();
        const pts = await d.all<{ n: number }>(sql`select count(*) as n from heatmap_points where selector = 'a.menu'`);
        expect(Number(pts[0].n)).toBe(0);
        const roll = await d.all<{ n: number }>(sql`select count(*) as n from heatmap_clicks_daily where selector = 'a.menu'`);
        expect(Number(roll[0].n)).toBe(1);
    });
});

describe('capture module', () => {
    const src = fs.readFileSync('public/heatmap.js', 'utf8');
    it('never listens to keys or reads values or text', () => {
        expect(src).not.toMatch(/keydown|keyup|keypress|'input'|"input"\s*,|\.value\b|innerText|textContent|innerHTML/);
    });
    it('is loaded by the SDK only when the server says the session is sampled', () => {
        const sdkSrc = fs.readFileSync('sdk-src/sdk.js', 'utf8');
        expect(sdkSrc).toContain('if (data.capture && data.capture.heatmaps) loadHeatmaps(data);');
        expect(sdkSrc).toContain("'/heatmap.js'");
    });
});
