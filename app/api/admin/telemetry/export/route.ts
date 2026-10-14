import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { overviewTotals, parseRange, topOrgs, topUsers } from '@/lib/telemetryQueries';
import { METRICS, recordProductEvent, clientIpFromHeaders } from '@/lib/telemetry';

function csvEscape(v: unknown): string {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
    const lines = [headers.join(',')];
    for (const r of rows) lines.push(headers.map((h) => csvEscape(r[h])).join(','));
    return lines.join('\n') + '\n';
}

export async function GET(request: NextRequest) {
    const admin = await requirePlatformAdmin();
    if (admin instanceof NextResponse) return admin;
    const sp = request.nextUrl.searchParams;
    const { from, to } = parseRange(sp);
    const kind = sp.get('kind') || 'overview';
    void recordProductEvent({
        action: 'admin.telemetry.export',
        userId: admin.userId,
        ip: clientIpFromHeaders(request.headers),
        meta: { kind, from, to },
    });

    let csv = '';
    let filename = `telemetry-${kind}-${from}_${to}.csv`;
    if (kind === 'series') {
        const data = await overviewTotals(from, to);
        const metrics = Object.values(METRICS);
        const headers = ['day', ...metrics];
        csv = toCsv(headers, data.series as unknown as Record<string, unknown>[]);
    } else if (kind === 'users') {
        const data = await topUsers(from, to, sp.get('metric') || METRICS.api_key_requests, sp.get('q') || '');
        csv = toCsv(['scope_id', 'email', 'name', 'total', 'created_at', 'last_active_at', 'last_login_at'], data.rows as unknown as Record<string, unknown>[]);
    } else if (kind === 'orgs') {
        const data = await topOrgs(from, to, sp.get('metric') || METRICS.unique_visitors, sp.get('q') || '');
        csv = toCsv(['scope_id', 'name', 'slug', 'plan', 'status', 'total', 'created_at'], data.rows as unknown as Record<string, unknown>[]);
    } else {
        const data = await overviewTotals(from, to);
        csv = toCsv(['metric', 'value'], Object.entries(data.totals).map(([metric, value]) => ({ metric, value })));
        filename = `telemetry-overview-${from}_${to}.csv`;
    }

    return new NextResponse(csv, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    });
}
