import Link from 'next/link';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { overviewTotals, defaultRange } from '@/lib/telemetryQueries';
import { METRICS } from '@/lib/telemetry';
import { PageHeader, Card, CardHeader, CardBody, Stat, ButtonLink } from '@/app/components/ui';
import { DateRangeFilter } from './DateRangeFilter';
import { Sparkline } from './TelemetryCharts';

export const metadata: Metadata = { title: 'Platform telemetry' };

export default async function TelemetryOverview({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
    const sp = await searchParams;
    const { from, to } = defaultRange(sp);
    const data = await overviewTotals(from, to);
    const t = data.totals;
    const num = (row: Record<string, string | number>, key: string) => Number(row[key] || 0);

    const eventVolume = data.series.map((d) => num(d, METRICS.sdk_assign) + num(d, METRICS.sdk_exposure) + num(d, METRICS.sdk_goal));
    const activeSeries = data.series.map((d) => num(d, METRICS.active_users));
    const signupSeries = data.series.map((d) => num(d, METRICS.signups));
    const days = data.series.map((d) => String(d.day));

    const topQuota = [...data.quotas].sort((a, b) => (b.visitor_pct ?? -1) - (a.visitor_pct ?? -1)).slice(0, 8);

    return (
        <>
            <PageHeader
                title="Platform telemetry"
                description="Usage volume across users, orgs, projects, and experiments. Platform admins only. No visitor PII."
                actions={
                    <div className="flex flex-wrap gap-2">
                        <ButtonLink href={`/api/admin/telemetry/export?kind=overview&from=${from}&to=${to}`} variant="secondary" size="sm">Export totals CSV</ButtonLink>
                        <ButtonLink href={`/api/admin/telemetry/export?kind=series&from=${from}&to=${to}`} variant="secondary" size="sm">Export series CSV</ButtonLink>
                        <ButtonLink href="/admin" variant="ghost" size="sm">Tenants</ButtonLink>
                    </div>
                }
            />
            <div className="mb-4">
                <Suspense fallback={null}>
                    <DateRangeFilter />
                </Suspense>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
                <Stat label="Users" value={t.users.toLocaleString()} />
                <Stat label="DAU" value={t.dau.toLocaleString()} hint="Last 24h active" />
                <Stat label="WAU" value={t.wau.toLocaleString()} hint="Last 7d active" />
                <Stat label="MAU" value={t.mau.toLocaleString()} hint="Last 30d active" />
                <Stat label="Orgs" value={t.orgs.toLocaleString()} />
                <Stat label="Tests running" value={t.tests_running.toLocaleString()} hint={`${t.tests_total} total`} />
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Signups" value={(t.signups || 0).toLocaleString()} />
                <Stat label="Logins" value={(t.logins || 0).toLocaleString()} />
                <Stat label="Tests created" value={(t.tests_created || 0).toLocaleString()} />
                <Stat label="Domains added" value={(t.domains_added || 0).toLocaleString()} />
                <Stat label="Unique visitors" value={(t.unique_visitors || 0).toLocaleString()} />
                <Stat label="Conversions" value={(t.conversions || 0).toLocaleString()} />
                <Stat label="SDK assign" value={(t.sdk_assign || 0).toLocaleString()} />
                <Stat label="SDK exposure / goal" value={`${(t.sdk_exposure || 0).toLocaleString()} / ${(t.sdk_goal || 0).toLocaleString()}`} />
                <Stat label="API key requests" value={(t.api_key_requests || 0).toLocaleString()} />
                <Stat label="Errors" value={(t.errors || 0).toLocaleString()} />
                <Stat label="Rate-limit hits" value={(t.rate_limit_hits || 0).toLocaleString()} />
                <Stat label="Variations created" value={(t.variations_created || 0).toLocaleString()} />
            </div>

            <div className="mb-6 grid gap-4 lg:grid-cols-3">
                <Card>
                    <CardHeader title="Event volume" description="Assign + exposure + goal per day" />
                    <CardBody><Sparkline values={eventVolume} labels={days} /></CardBody>
                </Card>
                <Card>
                    <CardHeader title="Active users (daily)" description="Dashboard activity bumps" />
                    <CardBody><Sparkline values={activeSeries} labels={days} stroke="#059669" /></CardBody>
                </Card>
                <Card>
                    <CardHeader title="Signups" description="New accounts per day" />
                    <CardBody><Sparkline values={signupSeries} labels={days} stroke="#7c3aed" /></CardBody>
                </Card>
            </div>

            <div className="mb-6 grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader
                        title="Plan and quota usage"
                        description="Visitor quota percent this calendar month (UTC)"
                        actions={<Link className="text-sm text-blue-600 hover:underline" href="/admin">All tenants</Link>}
                    />
                    <CardBody className="space-y-2">
                        {topQuota.length === 0 ? (
                            <p className="text-sm text-zinc-500">No orgs yet.</p>
                        ) : (
                            topQuota.map((q) => (
                                <div key={q.org_id} className="flex items-center justify-between gap-3 text-sm">
                                    <Link href={`/admin/telemetry/orgs/${q.org_id}?from=${from}&to=${to}`} className="truncate font-medium text-zinc-900 hover:underline">{q.name}</Link>
                                    <span className="capitalize text-zinc-500">{q.plan}</span>
                                    <span className="tabular-nums text-zinc-700">
                                        {q.visitors.toLocaleString()}
                                        {q.visitor_limit != null ? ` / ${q.visitor_limit.toLocaleString()}` : ' / ∞'}
                                        {q.visitor_pct != null ? ` (${q.visitor_pct}%)` : ''}
                                    </span>
                                </div>
                            ))
                        )}
                    </CardBody>
                </Card>
                <Card>
                    <CardHeader
                        title="Browse"
                        description="Drill into users and organizations"
                    />
                    <CardBody className="flex flex-wrap gap-3">
                        <ButtonLink href={`/admin/telemetry/users?from=${from}&to=${to}`}>Top users</ButtonLink>
                        <ButtonLink href={`/admin/telemetry/orgs?from=${from}&to=${to}`} variant="secondary">Top orgs</ButtonLink>
                    </CardBody>
                </Card>
            </div>

            <Card>
                <CardHeader title="Daily series snapshot" description={`${from} → ${to}`} />
                <CardBody className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="text-xs uppercase text-zinc-500">
                            <tr>
                                <th className="py-2 pr-4">Day</th>
                                <th className="py-2 pr-4">Assign</th>
                                <th className="py-2 pr-4">Exposure</th>
                                <th className="py-2 pr-4">Goal</th>
                                <th className="py-2 pr-4">Visitors</th>
                                <th className="py-2 pr-4">Conv</th>
                                <th className="py-2 pr-4">Logins</th>
                                <th className="py-2 pr-4">Errors</th>
                                <th className="py-2">429</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.series.slice(-14).map((row) => (
                                <tr key={row.day} className="border-t border-zinc-100">
                                    <td className="py-1.5 pr-4 tabular-nums">{row.day}</td>
                                    <td className="py-1.5 pr-4 tabular-nums">{num(row, METRICS.sdk_assign)}</td>
                                    <td className="py-1.5 pr-4 tabular-nums">{num(row, METRICS.sdk_exposure)}</td>
                                    <td className="py-1.5 pr-4 tabular-nums">{num(row, METRICS.sdk_goal)}</td>
                                    <td className="py-1.5 pr-4 tabular-nums">{num(row, METRICS.unique_visitors)}</td>
                                    <td className="py-1.5 pr-4 tabular-nums">{num(row, METRICS.conversions)}</td>
                                    <td className="py-1.5 pr-4 tabular-nums">{num(row, METRICS.logins)}</td>
                                    <td className="py-1.5 pr-4 tabular-nums">{num(row, METRICS.errors)}</td>
                                    <td className="py-1.5 tabular-nums">{num(row, METRICS.rate_limit_hits)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardBody>
            </Card>
        </>
    );
}
