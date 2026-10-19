import type { DailyBucketRow } from './rollups';

/**
 * Results export (all plans): one row per UTC day, version and goal, from the daily rollups.
 * new_* columns count visitors first seen that day, so the running totals are distinct counts and match the
 * results table on the last day. Cells starting with = + - @ are prefixed so spreadsheets do not run them.
 */
export const RESULTS_CSV_HEADER = ['date_utc', 'variation', 'variation_id', 'is_control', 'goal', 'goal_id', 'active_visitors', 'new_visitors', 'total_visitors', 'new_converters', 'total_converters', 'conversion_rate_total'];

export function csvCell(v: string | number | boolean | null | undefined): string {
    let t = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function resultsCsv(
    rows: DailyBucketRow[],
    variations: Array<{ id: string; name: string; is_control: boolean }>,
    goals: Array<{ id: string; name: string; is_primary: boolean }>,
): string {
    // Without named goals, all conversions are one goal.
    const goalList = goals.length ? [...goals].sort((a, b) => Number(b.is_primary) - Number(a.is_primary)) : [{ id: '', name: 'All conversions', is_primary: true }];
    const at = new Map<string, number>();
    for (const r of rows) at.set(`${r.day}|${r.variation_id}|${r.bucket}`, (at.get(`${r.day}|${r.variation_id}|${r.bucket}`) ?? 0) + r.users);
    const days = [...new Set(rows.map((r) => r.day))].sort();
    const lines = [RESULTS_CSV_HEADER.join(',')];
    for (const g of goalList) {
        const bucket = g.id ? `g:${g.id}` : 't:conversion';
        for (const v of [...variations].sort((x, y) => Number(y.is_control) - Number(x.is_control))) {
            let visitors = 0;
            let converters = 0;
            for (const day of days) {
                const nv = at.get(`${day}|${v.id}|v`) ?? 0;
                const nc = at.get(`${day}|${v.id}|${bucket}`) ?? 0;
                const active = at.get(`${day}|${v.id}|d`) ?? 0;
                visitors += nv;
                converters += nc;
                if (!nv && !nc && !active) continue;
                const rate = visitors ? (converters / visitors).toFixed(6) : '';
                lines.push([day, v.name, v.id, v.is_control, g.name, g.id, active, nv, visitors, nc, converters, rate].map(csvCell).join(','));
            }
        }
    }
    return lines.join('\n') + '\n';
}

export function resultsCsvName(name: string, env: string | null, now = new Date()): string {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'test';
    return `results-${slug}${env ? `-${env}` : ''}-${now.toISOString().slice(0, 10)}.csv`;
}
