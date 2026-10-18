import { deviceFromUserAgent } from './targeting';

/** Traffic overview dimensions. Totals use key ''. */
export const TRAFFIC_DIMS = ['views', 'entries', 'new_views', 'page', 'source', 'device', 'country'] as const;
export type TrafficDim = (typeof TRAFFIC_DIMS)[number];
export const TRAFFIC_RANGES = [7, 30, 90] as const;
export const TRAFFIC_TOP = 20;
/** Distinct page paths kept per environment per UTC day. Views on further new paths that day count under OTHER_PAGES. */
export const TRAFFIC_MAX_PAGES_PER_DAY = 500;
export const OTHER_PAGES = '(other)';
const MAX_KEY = 200;

export interface TrafficHit { url: string; referrer?: string | null; userAgent?: string | null; country?: string | null; visitor?: 'new' | 'returning' | null }

const bareHost = (h: string) => h.toLowerCase().replace(/^www\./, '');

/**
 * Turns one page view into the counters it adds. Sources count only entries (no referrer, or a
 * referrer on another site), so internal clicks do not show up as a source.
 */
export function trafficDimensions(hit: TrafficHit): Array<{ dim: TrafficDim; key: string }> {
    let page: URL;
    try { page = new URL(hit.url); } catch { return []; }
    const out: Array<{ dim: TrafficDim; key: string }> = [{ dim: 'views', key: '' }];
    let path = page.pathname || '/';
    if (path.length > 1) path = path.replace(/\/+$/, '') || '/';
    out.push({ dim: 'page', key: path.slice(0, MAX_KEY) });
    if (hit.visitor === 'new') out.push({ dim: 'new_views', key: '' });
    out.push({ dim: 'device', key: deviceFromUserAgent(hit.userAgent) });
    const country = (hit.country || '').toUpperCase();
    if (/^[A-Z]{2}$/.test(country)) out.push({ dim: 'country', key: country });

    let refHost = '';
    if (hit.referrer) { try { refHost = bareHost(new URL(hit.referrer).hostname); } catch { refHost = ''; } }
    const internal = !!refHost && refHost === bareHost(page.hostname);
    if (!internal) {
        out.push({ dim: 'entries', key: '' });
        const utm = (page.searchParams.get('utm_source') || '').trim().toLowerCase().slice(0, 100);
        out.push({ dim: 'source', key: utm || refHost || 'direct' });
    }
    return out;
}

export interface TrafficRow { day: string; dim: string; key: string; views: number }

export interface TrafficSummary {
    days: Array<{ day: string; views: number; entries: number; new_views: number }>;
    totals: { views: number; entries: number; new_views: number };
    pages: Array<{ key: string; views: number }>;
    sources: Array<{ key: string; views: number }>;
    devices: Array<{ key: string; views: number }>;
    countries: Array<{ key: string; views: number }>;
}

/** Daily series for the totals (every day in range, zeros filled) and top keys per dimension. */
export function summarizeTraffic(daily: TrafficRow[], grouped: Array<{ dim: string; key: string; views: number }>, days: string[]): TrafficSummary {
    const byDay = new Map(days.map((d) => [d, { day: d, views: 0, entries: 0, new_views: 0 }]));
    for (const r of daily) {
        const row = byDay.get(r.day);
        if (row && (r.dim === 'views' || r.dim === 'entries' || r.dim === 'new_views')) row[r.dim] += r.views;
    }
    const series = [...byDay.values()];
    const top = (dim: string) => grouped.filter((g) => g.dim === dim).sort((a, b) => b.views - a.views || a.key.localeCompare(b.key)).slice(0, TRAFFIC_TOP).map(({ key, views }) => ({ key, views }));
    return {
        days: series,
        totals: series.reduce((a, d) => ({ views: a.views + d.views, entries: a.entries + d.entries, new_views: a.new_views + d.new_views }), { views: 0, entries: 0, new_views: 0 }),
        pages: top('page'),
        sources: top('source'),
        devices: top('device'),
        countries: top('country'),
    };
}

/** UTC days from (today - n + 1) to today, oldest first. */
export function lastDays(n: number, now = new Date()): string[] {
    const out: string[] = [];
    for (let i = n - 1; i >= 0; i--) out.push(new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10));
    return out;
}
