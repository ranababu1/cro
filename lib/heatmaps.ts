import { z } from 'zod';
import { and, eq, gte, lt, sql, desc } from 'drizzle-orm';
import { getDb } from './db';
import * as s from './db/schema';

/** Share of sessions on paid plans that load the capture module. HEATMAP_SAMPLE_RATE overrides (0-1). */
export function heatmapSampleRate(): number {
    const v = Number(process.env.HEATMAP_SAMPLE_RATE);
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.5;
}

/** Deterministic per visitor and experiment, so a visitor is either always or never captured. */
export function isSampled(userId: string, experimentId: string, rate = heatmapSampleRate()): boolean {
    if (rate >= 1) return true;
    if (rate <= 0) return false;
    let h = 2166136261;
    for (const ch of `${userId}:${experimentId}:heat`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    return h / 4294967296 < rate;
}

export const RAW_RETENTION_DAYS = 30;
export const DEVICES = ['desktop', 'tablet', 'mobile'] as const;
export type Device = (typeof DEVICES)[number];

// Strict objects: anything else (text, values, keys) is rejected, so no typed content can be sent.
const selector = z.string().min(1).max(200).regex(/^[a-zA-Z0-9 >:.#_()\-[\]="]+$/, 'Invalid selector');
const click = z.object({ t: z.literal('c'), x: z.number().int().min(0).max(1000), y: z.number().int().min(0).max(100_000), sel: selector, rage: z.boolean().optional(), dead: z.boolean().optional() }).strict();
const scroll = z.object({ t: z.literal('s'), d: z.number().int().min(0).max(100) }).strict();
export const captureSchema = z.object({
    experiment_id: z.string().min(1).max(64),
    variation_id: z.string().min(1).max(64),
    device: z.enum(DEVICES),
    events: z.array(z.discriminatedUnion('t', [click, scroll])).max(200),
}).strict();
export type CaptureBatch = z.infer<typeof captureSchema>;

const GRID_COLS = 50;
const ROW_PX = 25;
const day = (d = new Date()) => d.toISOString().slice(0, 10);

/** Stores a batch: rollups aggregated within the batch (few writes), raw click points for confetti. */
export async function ingestCapture(orgId: string, b: CaptureBatch): Promise<number> {
    const d = await getDb();
    const today = day();
    const clicks = new Map<string, { gx: number; gy: number; selector: string; clicks: number; rage: number; dead: number }>();
    const depths = new Map<number, number>();
    const points: (typeof s.heatmapPoints.$inferInsert)[] = [];
    for (const e of b.events) {
        if (e.t === 'c') {
            const gx = Math.min(GRID_COLS - 1, Math.floor((e.x / 1000) * GRID_COLS));
            const gy = Math.floor(e.y / ROW_PX);
            const key = `${gx}|${gy}|${e.sel}`;
            const row = clicks.get(key) ?? { gx, gy, selector: e.sel, clicks: 0, rage: 0, dead: 0 };
            row.clicks++; if (e.rage) row.rage++; if (e.dead) row.dead++;
            clicks.set(key, row);
            points.push({ org_id: orgId, experiment_id: b.experiment_id, variation_id: b.variation_id, device: b.device, x: e.x, y: e.y, selector: e.sel, rage: !!e.rage, dead: !!e.dead });
        } else {
            const depth = Math.min(100, Math.round(e.d / 10) * 10);
            depths.set(depth, (depths.get(depth) ?? 0) + 1);
        }
    }
    const base = { experiment_id: b.experiment_id, variation_id: b.variation_id, device: b.device, day: today };
    if (clicks.size) {
        await d.insert(s.heatmapClicksDaily).values([...clicks.values()].map((c) => ({ ...base, ...c })))
            .onConflictDoUpdate({
                target: [s.heatmapClicksDaily.experiment_id, s.heatmapClicksDaily.variation_id, s.heatmapClicksDaily.device, s.heatmapClicksDaily.day, s.heatmapClicksDaily.gx, s.heatmapClicksDaily.gy, s.heatmapClicksDaily.selector],
                set: {
                    clicks: sql`${s.heatmapClicksDaily.clicks} + excluded.clicks`,
                    rage: sql`${s.heatmapClicksDaily.rage} + excluded.rage`,
                    dead: sql`${s.heatmapClicksDaily.dead} + excluded.dead`,
                },
            });
    }
    if (depths.size) {
        await d.insert(s.heatmapScrollDaily).values([...depths].map(([depth, sessions]) => ({ ...base, depth, sessions })))
            .onConflictDoUpdate({
                target: [s.heatmapScrollDaily.experiment_id, s.heatmapScrollDaily.variation_id, s.heatmapScrollDaily.device, s.heatmapScrollDaily.day, s.heatmapScrollDaily.depth],
                set: { sessions: sql`${s.heatmapScrollDaily.sessions} + excluded.sessions` },
            });
    }
    if (points.length) await d.insert(s.heatmapPoints).values(points);
    return b.events.length;
}

/** Deletes raw points older than 30 days. Rollups are kept. */
export async function pruneHeatmapPoints(now = new Date()): Promise<void> {
    const cutoff = new Date(now.getTime() - RAW_RETENTION_DAYS * 86_400_000).toISOString();
    const d = await getDb();
    await d.delete(s.heatmapPoints).where(lt(s.heatmapPoints.created_at, cutoff));
}

export type HeatmapReport = {
    devices: Record<Device, { clicks: number; sessions: number }>;
    grid: { gx: number; gy: number; clicks: number }[];
    list: { selector: string; clicks: number; rage: number; dead: number }[];
    scroll: { depth: number; reach: number }[];
    confetti: { x: number; y: number; rage: boolean; dead: boolean }[];
    totals: { clicks: number; rage: number; dead: number; sessions: number };
    cols: number; rowPx: number;
};

export async function heatmapReport(experimentId: string, variationId: string, device: Device | 'all', days = 30): Promise<HeatmapReport> {
    const d = await getDb();
    const from = day(new Date(Date.now() - (days - 1) * 86_400_000));
    const C = s.heatmapClicksDaily, S = s.heatmapScrollDaily, P = s.heatmapPoints;
    const cw = and(eq(C.experiment_id, experimentId), eq(C.variation_id, variationId), gte(C.day, from), device === 'all' ? undefined : eq(C.device, device));
    const sw = and(eq(S.experiment_id, experimentId), eq(S.variation_id, variationId), gte(S.day, from), device === 'all' ? undefined : eq(S.device, device));
    const [grid, list, depthRows, byDeviceC, byDeviceS, confetti] = await Promise.all([
        d.select({ gx: C.gx, gy: C.gy, clicks: sql<number>`sum(${C.clicks})` }).from(C).where(cw).groupBy(C.gx, C.gy),
        d.select({ selector: C.selector, clicks: sql<number>`sum(${C.clicks})`, rage: sql<number>`sum(${C.rage})`, dead: sql<number>`sum(${C.dead})` }).from(C).where(cw).groupBy(C.selector).orderBy(sql`sum(${C.clicks}) desc`).limit(50),
        d.select({ depth: S.depth, sessions: sql<number>`sum(${S.sessions})` }).from(S).where(sw).groupBy(S.depth),
        d.select({ device: C.device, clicks: sql<number>`sum(${C.clicks})` }).from(C).where(and(eq(C.experiment_id, experimentId), eq(C.variation_id, variationId), gte(C.day, from))).groupBy(C.device),
        d.select({ device: S.device, sessions: sql<number>`sum(${S.sessions})` }).from(S).where(and(eq(S.experiment_id, experimentId), eq(S.variation_id, variationId), gte(S.day, from))).groupBy(S.device),
        d.select({ x: P.x, y: P.y, rage: P.rage, dead: P.dead }).from(P)
            .where(and(eq(P.experiment_id, experimentId), eq(P.variation_id, variationId), device === 'all' ? undefined : eq(P.device, device)))
            .orderBy(desc(P.id)).limit(2000),
    ]);
    const sessions = depthRows.reduce((n, r) => n + Number(r.sessions), 0);
    const scroll = Array.from({ length: 11 }, (_, i) => i * 10).map((depth) => ({
        depth,
        reach: sessions ? Math.round((depthRows.filter((r) => r.depth >= depth).reduce((n, r) => n + Number(r.sessions), 0) / sessions) * 1000) / 10 : 0,
    }));
    const devices = Object.fromEntries(DEVICES.map((dv) => [dv, {
        clicks: Number(byDeviceC.find((r) => r.device === dv)?.clicks ?? 0),
        sessions: Number(byDeviceS.find((r) => r.device === dv)?.sessions ?? 0),
    }])) as HeatmapReport['devices'];
    const L = list.map((r) => ({ selector: r.selector, clicks: Number(r.clicks), rage: Number(r.rage), dead: Number(r.dead) }));
    return {
        devices,
        grid: grid.map((g) => ({ gx: g.gx, gy: g.gy, clicks: Number(g.clicks) })),
        list: L,
        scroll,
        confetti,
        totals: { clicks: L.reduce((n, r) => n + r.clicks, 0), rage: L.reduce((n, r) => n + r.rage, 0), dead: L.reduce((n, r) => n + r.dead, 0), sessions },
        cols: GRID_COLS, rowPx: ROW_PX,
    };
}

/** Variations included in one export file. */
export const EXPORT_MAX_VARIATIONS = 20;
export const EXPORT_SCHEMA = 'freeabtest.heatmaps.v1';

/** Field guide written into every export, so the file explains itself when pasted into another tool. */
export const EXPORT_FIELDS = {
    grid: `Click counts per cell. The page is ${GRID_COLS} columns wide (gx 0 to ${GRID_COLS - 1}); each row (gy) is ${ROW_PX} px of page height from the top.`,
    list: 'Top 50 clicked elements by CSS selector, with rage clicks (3 or more fast clicks in one spot) and dead clicks (on something that is not a link or button).',
    scroll: 'Share of sessions (percent) that scrolled at least depth percent of the page.',
    confetti: 'Individual clicks: x is 0 to 1000 across the page width, y is pixels from the top.',
    totals: 'Clicks, rage clicks, dead clicks and sessions with scroll data in the period.',
    devices: 'Clicks and sessions per device type.',
};

/** File name for an export: letters, numbers and dashes only. */
export function exportFileName(experimentName: string, device: string, now = new Date()): string {
    const slug = experimentName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'test';
    return `heatmaps-${slug}-${device}-${now.toISOString().slice(0, 10)}.json`;
}
