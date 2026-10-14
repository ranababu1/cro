import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { db } from '@/lib/db';
import { METRICS } from '@/lib/telemetry';
import { defaultRange } from '@/lib/telemetryQueries';
import { PageHeader, Card, CardHeader, CardBody, Stat, Table, THead, TBody, TR, TH, TD } from '@/app/components/ui';
import { DateRangeFilter } from '../../DateRangeFilter';
import { Sparkline } from '../../TelemetryCharts';

export const metadata: Metadata = { title: 'Telemetry · User' };

export default async function TelemetryUserPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ from?: string; to?: string }>;
}) {
    const { id } = await params;
    const sp = await searchParams;
    const { from, to } = defaultRange(sp);
    const user = await db.getUser(id);
    if (!user) notFound();

    const series = await db.getTelemetryRange({ from, to, scopeType: 'user', scopeId: id });
    const timeline = await db.listProductEvents({ from, to, userId: id, limit: 100 });
    const projects = await db.getProjectsForUser(id);
    const totals: Record<string, number> = {};
    for (const m of Object.values(METRICS)) {
        totals[m] = await db.sumTelemetry({ from, to, scopeType: 'user', scopeId: id, metric: m });
    }

    const byDay: Record<string, Record<string, number>> = {};
    for (const row of series) {
        byDay[row.day] ??= {};
        byDay[row.day][row.metric] = row.value;
    }
    const days: string[] = [];
    for (let d = new Date(from + 'T00:00:00Z'); d <= new Date(to + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
        days.push(d.toISOString().slice(0, 10));
    }
    const volume = days.map((day) => (byDay[day]?.[METRICS.api_key_requests] || 0) + (byDay[day]?.[METRICS.tests_created] || 0) + (byDay[day]?.[METRICS.logins] || 0));

    return (
        <>
            <PageHeader
                title={user.email}
                description={`${user.name || 'User'} · signed up ${new Date(user.created_at).toLocaleDateString()}`}
                breadcrumb={
                    <span>
                        <Link href={`/admin/telemetry?from=${from}&to=${to}`} className="hover:underline">Telemetry</Link>
                        {' / '}
                        <Link href={`/admin/telemetry/users?from=${from}&to=${to}`} className="hover:underline">Users</Link>
                    </span>
                }
            />
            <div className="mb-4"><Suspense fallback={null}><DateRangeFilter /></Suspense></div>
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Last active" value={user.last_active_at ? new Date(user.last_active_at).toLocaleString() : '-'} />
                <Stat label="Last login" value={user.last_login_at ? new Date(user.last_login_at).toLocaleString() : '-'} />
                <Stat label="Logins" value={(totals.logins || 0).toLocaleString()} />
                <Stat label="Tests created" value={(totals.tests_created || 0).toLocaleString()} />
                <Stat label="Domains added" value={(totals.domains_added || 0).toLocaleString()} />
                <Stat label="API key requests" value={(totals.api_key_requests || 0).toLocaleString()} />
                <Stat label="Projects" value={projects.length} />
                <Stat label="Product events" value={timeline.length} />
            </div>
            <Card className="mb-6">
                <CardHeader title="Activity volume" description="Logins + tests created + API key requests" />
                <CardBody><Sparkline values={volume} labels={days} /></CardBody>
            </Card>
            <div className="mb-6 grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader title="Projects" />
                    <CardBody>
                        {projects.length === 0 ? <p className="text-sm text-zinc-500">None</p> : (
                            <ul className="space-y-1 text-sm">
                                {projects.map((p) => (
                                    <li key={p.id} className="flex justify-between gap-2">
                                        <span>{p.name}</span>
                                        <span className="text-zinc-500 font-mono text-xs">{p.org_id}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardBody>
                </Card>
                <Card>
                    <CardHeader title="Metric totals" description={`${from} → ${to}`} />
                    <CardBody className="space-y-1 text-sm">
                        {Object.entries(totals).filter(([, v]) => v > 0).map(([k, v]) => (
                            <div key={k} className="flex justify-between"><span className="text-zinc-600">{k}</span><span className="tabular-nums">{v.toLocaleString()}</span></div>
                        ))}
                        {Object.values(totals).every((v) => !v) && <p className="text-zinc-500">No counters in range.</p>}
                    </CardBody>
                </Card>
            </div>
            <Card>
                <CardHeader title="Timeline" description="Product-usage events (dashboard actions)" />
                <Table>
                    <THead>
                        <tr><TH>When</TH><TH>Action</TH><TH>Project</TH><TH>Experiment</TH></tr>
                    </THead>
                    <TBody>
                        {timeline.map((e) => (
                            <TR key={e.id}>
                                <TD className="tabular-nums text-xs">{new Date(e.occurred_at).toLocaleString()}</TD>
                                <TD>{e.action}</TD>
                                <TD className="font-mono text-xs">{e.project_id || '-'}</TD>
                                <TD className="font-mono text-xs">{e.experiment_id || '-'}</TD>
                            </TR>
                        ))}
                    </TBody>
                </Table>
            </Card>
        </>
    );
}
