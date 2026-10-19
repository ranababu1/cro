import { createHash } from 'node:crypto';
import { z } from 'zod';

/**
 * JavaScript error tracking (paid): errors on pages in a running test, counted per test version per day.
 * The browser module sends at most a few reports per page; the server keeps daily counts, not single events.
 */
export const ERRORS_PER_BATCH = 20;
/** Distinct errors kept per test per UTC day. Further new errors that day count under OTHER_ERRORS. */
export const ERROR_MAX_PER_DAY = 200;
export const OTHER_ERRORS = '(other)';
/** Row that counts pages (page loads) that had at least one error. */
export const PAGES_WITH_ERRORS = '(pages)';
export const ERROR_RANGES = [7, 30, 90] as const;
export const ERROR_TOP = 50;

export const errorReportSchema = z.object({
    experiment_id: z.string().min(1).max(64),
    variation_id: z.string().min(1).max(64),
    /** True on the first report a page sends, so pages with errors are counted once. */
    first: z.boolean().optional(),
    errors: z.array(z.object({
        kind: z.enum(['error', 'rejection']),
        message: z.string().max(2000),
        source: z.string().max(2000).optional(),
        line: z.number().int().min(0).max(10_000_000).optional(),
        count: z.number().int().min(1).max(1000).default(1),
    })).min(1).max(ERRORS_PER_BATCH),
});
export type ErrorReport = z.infer<typeof errorReportSchema>;

/** Removes details that could identify a person (emails, long numbers, tokens) and query strings. */
export function cleanMessage(message: string): string {
    const m = message
        .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
        .replace(/https?:\/\/[^\s'")]+/g, (u) => u.split(/[?#]/)[0])
        .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[token]')
        .replace(/\d{4,}/g, 'N')
        .replace(/\s+/g, ' ')
        .trim();
    return (m || 'Unknown error').slice(0, 300);
}

export function cleanSource(source: string | undefined): string {
    if (!source) return '';
    try {
        const u = new URL(source);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return u.protocol.replace(':', '');
        return (u.host + u.pathname).slice(0, 300);
    } catch {
        return source.split(/[?#]/)[0].slice(0, 300);
    }
}

export function errorFingerprint(kind: string, message: string, source: string, line: number): string {
    return createHash('sha1').update(`${kind}|${message}|${source}|${line}`).digest('hex').slice(0, 16);
}

export interface ErrorRow { kind: string; message: string; source: string; line: number; fingerprint: string; count: number }

/** Turns one browser report into daily counter rows. */
export function errorRows(report: ErrorReport): ErrorRow[] {
    const rows = new Map<string, ErrorRow>();
    for (const e of report.errors) {
        const message = cleanMessage(e.message);
        const source = cleanSource(e.source);
        const line = e.line ?? 0;
        const fingerprint = errorFingerprint(e.kind, message, source, line);
        const cur = rows.get(fingerprint);
        if (cur) cur.count += e.count;
        else rows.set(fingerprint, { kind: e.kind, message, source, line, fingerprint, count: e.count });
    }
    const out = [...rows.values()];
    if (report.first) out.push({ kind: 'pages', message: '', source: '', line: 0, fingerprint: PAGES_WITH_ERRORS, count: 1 });
    return out;
}

export interface ErrorSummary {
    variations: Array<{ id: string; name: string; is_control: boolean; visitors: number; pages_with_errors: number; errors: number }>;
    top: Array<{ fingerprint: string; kind: string; message: string; source: string; line: number; total: number; last_seen: string; by_variation: Record<string, number> }>;
}

export function summarizeErrors(
    rows: Array<{ variation_id: string; fingerprint: string; kind: string; message: string; source: string; line: number; count: number; last_seen: string }>,
    variations: Array<{ id: string; name: string; is_control: boolean }>,
    visitors: Map<string, number>,
): ErrorSummary {
    const per = new Map(variations.map((v) => [v.id, { id: v.id, name: v.name, is_control: !!v.is_control, visitors: visitors.get(v.id) ?? 0, pages_with_errors: 0, errors: 0 }]));
    const top = new Map<string, ErrorSummary['top'][number]>();
    for (const r of rows) {
        const v = per.get(r.variation_id);
        if (!v) continue;
        if (r.fingerprint === PAGES_WITH_ERRORS) { v.pages_with_errors += r.count; continue; }
        v.errors += r.count;
        const t = top.get(r.fingerprint) ?? { fingerprint: r.fingerprint, kind: r.kind, message: r.fingerprint === OTHER_ERRORS ? 'Other errors' : r.message, source: r.source, line: r.line, total: 0, last_seen: '', by_variation: {} };
        t.total += r.count;
        t.by_variation[r.variation_id] = (t.by_variation[r.variation_id] ?? 0) + r.count;
        if (r.last_seen > t.last_seen) t.last_seen = r.last_seen;
        top.set(r.fingerprint, t);
    }
    return {
        variations: [...per.values()],
        top: [...top.values()].sort((a, b) => b.total - a.total || a.message.localeCompare(b.message)).slice(0, ERROR_TOP),
    };
}
