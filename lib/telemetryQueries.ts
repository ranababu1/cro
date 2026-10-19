import { db, monthStartIso } from './db';
import { getOrgEntitlements } from './entitlements';
import { METRICS } from './telemetry';

export function defaultRange(sp: { from?: string; to?: string } = {}): { from: string; to: string } {
    const to = sp.to || new Date().toISOString().slice(0, 10);
    const from = sp.from || new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
    return { from, to };
}

export function parseRange(searchParams: URLSearchParams): { from: string; to: string } {
    const to = searchParams.get('to') || new Date().toISOString().slice(0, 10);
    const from = searchParams.get('from') || new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
    return { from, to };
}

export function daysAgoIso(days: number): string {
    return new Date(Date.now() - days * 864e5).toISOString();
}

export async function overviewTotals(from: string, to: string) {
    const metricList = Object.values(METRICS);
    const sums: Record<string, number> = {};
    await Promise.all(
        metricList.map(async (m) => {
            sums[m] = await db.sumTelemetry({ from, to, scopeType: 'platform', scopeId: 'platform', metric: m });
        }),
    );
    const [users, dau, wau, mau, orgs] = await Promise.all([
        db.countUsers(),
        db.countActiveUsersSince(daysAgoIso(1)),
        db.countActiveUsersSince(daysAgoIso(7)),
        db.countActiveUsersSince(daysAgoIso(30)),
        db.listOrganizations(),
    ]);

    // Live experiment counts from DB for accuracy
    let runningNow = 0;
    let testsTotal = 0;
    for (const org of orgs) {
        const u = await db.getOrgUsage(org.id);
        runningNow += u.running;
        testsTotal += u.experiments;
    }

    const series = await db.getTelemetryRange({
        from,
        to,
        scopeType: 'platform',
        scopeId: 'platform',
        metrics: [
            METRICS.sdk_assign,
            METRICS.sdk_exposure,
            METRICS.sdk_goal,
            METRICS.signups,
            METRICS.logins,
            METRICS.active_users,
            METRICS.unique_visitors,
            METRICS.conversions,
            METRICS.errors,
            METRICS.rate_limit_hits,
            METRICS.api_key_requests,
        ],
    });

    // Pivot series by day
    const byDay: Record<string, Record<string, number>> = {};
    for (const row of series) {
        byDay[row.day] ??= {};
        byDay[row.day][row.metric] = row.value;
    }
    const days: string[] = [];
    const start = new Date(from + 'T00:00:00Z');
    const end = new Date(to + 'T00:00:00Z');
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        days.push(d.toISOString().slice(0, 10));
    }

    // Quota snapshot
    const quotaRows = [];
    for (const org of orgs.slice(0, 100)) {
        const usage = await db.getOrgUsage(org.id, monthStartIso());
        const visitorLimit = org.monthly_visitor_limit;
        const visitorPct = visitorLimit && visitorLimit > 0 ? Math.round((usage.visitors / visitorLimit) * 1000) / 10 : null;
        quotaRows.push({
            org_id: org.id,
            name: org.name,
            plan: (await getOrgEntitlements(org.id)).plan,
            status: org.status,
            visitors: usage.visitors,
            visitor_limit: visitorLimit,
            visitor_pct: visitorPct,
            events: usage.events,
            experiments: usage.experiments,
            running: usage.running,
        });
    }

    return {
        from,
        to,
        totals: {
            users,
            orgs: orgs.length,
            dau,
            wau,
            mau,
            tests_total: testsTotal,
            tests_running: runningNow,
            ...sums,
        } as Record<string, number>,
        series: days.map((day) => ({ day, ...(byDay[day] || {}) })) as Array<Record<string, string | number>>,
        quotas: quotaRows,
    };
}

export async function topUsers(from: string, to: string, metric: string = METRICS.api_key_requests, q = '') {
    const tops = await db.topTelemetryScopes({ from, to, scopeType: 'user', metric, limit: 100 });
    const users = await db.listUsersForTelemetry(500);
    const byId = Object.fromEntries(users.map((u) => [u.id, u]));
    let rows = tops.map((t) => ({
        ...t,
        email: byId[t.scope_id]?.email ?? t.scope_id,
        name: byId[t.scope_id]?.name ?? '',
        created_at: byId[t.scope_id]?.created_at,
        last_active_at: byId[t.scope_id]?.last_active_at,
        last_login_at: byId[t.scope_id]?.last_login_at,
    }));
    // Include users with zero telemetry if searching
    if (q) {
        const ql = q.toLowerCase();
        const matched = users.filter((u) => u.email.toLowerCase().includes(ql) || u.name.toLowerCase().includes(ql));
        const have = new Set(rows.map((r) => r.scope_id));
        for (const u of matched) {
            if (!have.has(u.id)) {
                rows.push({
                    scope_id: u.id,
                    total: 0,
                    email: u.email,
                    name: u.name,
                    created_at: u.created_at,
                    last_active_at: u.last_active_at,
                    last_login_at: u.last_login_at,
                });
            }
        }
        rows = rows.filter((r) => (r.email || '').toLowerCase().includes(ql) || (r.name || '').toLowerCase().includes(ql));
    }
    rows.sort((a, b) => b.total - a.total);
    return { from, to, metric, rows };
}

export async function topOrgs(from: string, to: string, metric: string = METRICS.unique_visitors, q = '') {
    const tops = await db.topTelemetryScopes({ from, to, scopeType: 'org', metric, limit: 100 });
    const orgs = await db.listOrganizations();
    const byId = Object.fromEntries(orgs.map((o) => [o.id, o]));
    const ids = [...new Set([...tops.map((t) => t.scope_id).filter((id) => byId[id]), ...(q ? orgs.map((o) => o.id) : [])])];
    const plans: Record<string, string> = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, (await getOrgEntitlements(id)).plan] as const)));
    let rows = tops.map((t) => {
        const o = byId[t.scope_id];
        return {
            ...t,
            name: o?.name ?? t.scope_id,
            slug: o?.slug ?? '',
            plan: o ? plans[o.id] ?? o.plan : '',
            status: o?.status ?? '',
            created_at: o?.created_at,
        };
    });
    if (q) {
        const ql = q.toLowerCase();
        const matched = orgs.filter((o) => o.name.toLowerCase().includes(ql) || o.slug.toLowerCase().includes(ql));
        const have = new Set(rows.map((r) => r.scope_id));
        for (const o of matched) {
            if (!have.has(o.id)) {
                rows.push({
                    scope_id: o.id,
                    total: 0,
                    name: o.name,
                    slug: o.slug,
                    plan: plans[o.id] ?? o.plan,
                    status: o.status,
                    created_at: o.created_at,
                });
            }
        }
        rows = rows.filter((r) => (r.name || '').toLowerCase().includes(ql) || (r.slug || '').toLowerCase().includes(ql));
    }
    rows.sort((a, b) => b.total - a.total);
    return { from, to, metric, rows };
}
