import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { sql } from 'drizzle-orm';
import { db, getDb } from '@/lib/db';
import { generateId } from '@/lib/ids';
import { clearConfigCache } from '@/lib/configCache';
import { heatmapCollection, heatmapRate, heatmapSettingsSchema } from '@/lib/heatmapRules';
import { collectionSummary } from '@/app/(app)/experiments/[id]/HeatmapCollection';
import { POST as capture } from '@/app/api/capture/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';
import { GET as getSettings, PATCH as patchSettings } from '@/app/api/experiments/[id]/heatmaps/settings/route';

let cleanup: () => void;
type T = { user: { id: string; email: string }; key: string; exp: string; control: string };
const t: Record<string, T> = {};

async function tenant(email: string, plan: string): Promise<T> {
    const u = await db.createUser({ email, name: email });
    const ws = await db.ensureWorkspace(u);
    await db.updateOrganization(ws.orgId, { plan });
    await seedProjectDomain(ws.projectId, 'localhost');
    const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'dev')!;
    const exp = generateId('exp');
    await db.createExperiment({ id: exp, project_id: ws.projectId, user_id: u.id, name: 'S', status: 'running', traffic_allocation: 100, control_url: 'http://localhost/page' },
        [{ name: 'Control', weight: 100, is_control: true, url: 'http://localhost/page' }]);
    const control = (await db.getVariations(exp))[0].id;
    return { user: { id: u.id, email }, key: (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key, exp, control };
}
const sdk = (path: string, key: string, body: unknown) => new NextRequest(`http://localhost${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', 'X-API-Key': key }, body: JSON.stringify(body),
});
const settings = (who: T, body?: unknown) => {
    session.current = { user: who.user };
    const req = new NextRequest(`http://localhost/api/experiments/${who.exp}/heatmaps/settings`, body === undefined ? {} : { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return (body === undefined ? getSettings : patchSettings)(req, { params: Promise.resolve({ id: who.exp }) });
};
const pageView = (who: T) => capture(sdk('/api/capture', who.key, { experiment_id: who.exp, variation_id: who.control, device: 'desktop', events: [{ t: 'c', x: 10, y: 10, sel: 'a.x' }, { t: 's', d: 50 }] }));
const boot = async (who: T, user: string) => (await (await bootstrap(sdk('/api/sdk/bootstrap', who.key, { user_id: user, url: 'http://localhost/page' }))).json());

beforeAll(async () => {
    cleanup = useTempDatabase();
    process.env.HEATMAP_SAMPLE_RATE = '0.5';
    t.free = await tenant('free@example.com', 'free');
    t.paid = await tenant('paid@example.com', 'starter');
    clearConfigCache();
});
afterAll(() => { delete process.env.HEATMAP_SAMPLE_RATE; cleanup(); });

const base = { heatmap_sample: null, heatmap_stop_days: null, heatmap_stop_views: null, heatmap_views: 0, heatmap_since: null, started_at: '2026-10-01T00:00:00.000Z', created_at: '2026-09-30T00:00:00.000Z' };

describe('rules', () => {
    it('uses the default sample and never stops without rules', () => {
        const c = heatmapCollection(base, new Date('2027-10-01'));
        expect(c).toMatchObject({ sample_percent: 50, custom_sample: false, collecting: true, stopped_by: null, since: base.started_at, ends_at: null });
        expect(heatmapRate({ ...base, heatmap_sample: 10 })).toBe(0.1);
    });

    it('stops on days from the test start or the new period, and on page views', () => {
        const r = { ...base, heatmap_stop_days: 30 };
        expect(heatmapCollection(r, new Date('2026-10-30T23:00:00Z')).collecting).toBe(true);
        expect(heatmapCollection(r, new Date('2026-10-31T00:00:00Z')).stopped_by).toBe('days');
        expect(heatmapRate(r, new Date('2026-11-01'))).toBe(0);
        expect(heatmapCollection({ ...r, heatmap_since: '2026-11-01T00:00:00.000Z' }, new Date('2026-11-15')).collecting).toBe(true);
        expect(heatmapCollection({ ...base, heatmap_stop_views: 100, heatmap_views: 100 }).stopped_by).toBe('views');
        expect(heatmapCollection({ ...base, heatmap_stop_views: 100, heatmap_views: 99 }).collecting).toBe(true);
    });

    it('validates input', () => {
        expect(heatmapSettingsSchema.safeParse({ sample_percent: 0 }).success).toBe(false);
        expect(heatmapSettingsSchema.safeParse({ stop_views: 50 }).success).toBe(false);
        expect(heatmapSettingsSchema.safeParse({ stop_days: 400 }).success).toBe(false);
        expect(heatmapSettingsSchema.safeParse({ sample_percent: null, stop_days: 60, stop_views: 25000 }).success).toBe(true);
        expect(heatmapSettingsSchema.safeParse({ other: 1 }).success).toBe(false);
    });

    it('summarizes the state in plain words', () => {
        const c = heatmapCollection({ ...base, heatmap_stop_days: 60, heatmap_stop_views: 25000, heatmap_views: 1200 }, new Date('2026-10-05'));
        expect(collectionSummary(c)).toMatch(/^Collecting from 50% of visitors\. 1,200 page views captured since .+\. Stops after 60 days or 25,000 page views\.$/);
        expect(collectionSummary(heatmapCollection({ ...base, heatmap_stop_views: 100, heatmap_views: 100 }))).toBe('Collection stopped after 100 page views. The data below is kept.');
    });
});

describe('settings route, bootstrap and capture', () => {
    it('is paid only', async () => {
        expect((await settings(t.free)).status).toBe(403);
        expect((await settings(t.free, { sample_percent: 10 })).status).toBe(403);
    });

    it('applies the sample rate to the bootstrap', async () => {
        expect((await (await settings(t.paid, { sample_percent: 100 })).json()).sample_percent).toBe(100);
        const all = await Promise.all(Array.from({ length: 20 }, (_, i) => boot(t.paid, `v${i}`)));
        expect(all.every((b) => b.capture?.heatmaps === true && b.capture.sample_rate === 1)).toBe(true);
        expect((await settings(t.paid, { stop_days: 0 })).status).toBe(400);
    });

    it('counts page views, stops capture and bootstrap at the limit, and restarts', async () => {
        await settings(t.paid, { stop_views: 100 });
        for (let i = 0; i < 99; i++) expect((await pageView(t.paid)).status).toBe(202);
        expect((await (await settings(t.paid)).json()).views).toBe(99);
        expect((await (await pageView(t.paid)).json()).accepted).toBe(2);
        const stopped = await (await settings(t.paid)).json();
        expect(stopped).toMatchObject({ views: 100, collecting: false, stopped_by: 'views' });
        const dropped = await (await pageView(t.paid)).json();
        expect(dropped).toEqual({ success: true, accepted: 0, stopped: true });
        clearConfigCache();
        expect((await boot(t.paid, 'v1')).capture).toEqual({ heatmaps: false, sample_rate: 0 });

        const fresh = await (await settings(t.paid, { restart: true })).json();
        expect(fresh).toMatchObject({ views: 0, collecting: true, stop_views: 100, sample_percent: 100 });
        expect((await boot(t.paid, 'v1')).capture.heatmaps).toBe(true);
        expect((await (await settings(t.paid, { sample_percent: null, stop_views: null })).json())).toMatchObject({ sample_percent: 50, custom_sample: false, stop_views: null });
    });

    it('records the change in the audit log', async () => {
        const d = await getDb();
        const rows = await d.all<{ action: string }>(sql`select action from audit_log where entity_id = ${t.paid.exp}`);
        expect(rows.map((r) => r.action)).toContain('heatmaps:settings');
        expect(rows.map((r) => r.action)).toContain('heatmaps:restart');
    });
});
