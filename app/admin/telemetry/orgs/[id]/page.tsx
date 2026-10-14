import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { db, monthStartIso } from '@/lib/db';
import { getTenantSummary } from '@/lib/admin';
import { METRICS } from '@/lib/telemetry';
import { defaultRange } from '@/lib/telemetryQueries';
import { PageHeader, Card, CardHeader, CardBody, Stat, Table, THead, TBody, TR, TH, TD, StatusBadge, ButtonLink } from '@/app/components/ui';
import { DateRangeFilter } from '../../DateRangeFilter';
import { Sparkline } from '../../TelemetryCharts';

export const metadata: Metadata = { title: 'Telemetry · Org' };

export default async function TelemetryOrgPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ from?: string; to?: string }>;
}) {
    const { id } = await params;
    const sp = await searchParams;
    const { from, to } = defaultRange(sp);
    const summary = await getTenantSummary(id);
    if (!summary) notFound();

    const series = await db.getTelemetryRange({ from, to, scopeType: 'org', scopeId: id });
    const timeline = await db.listProductEvents({ from, to, orgId: id, limit: 100 });
    const totals: Record<string, number> = {};
    for (const m of Object.values(METRICS)) {
        totals[m] = await db.sumTelemetry({ from, to, scopeType: 'org', scopeId: id, metric: m });
    }
    const monthUsage = await db.getOrgUsage(id, monthStartIso());
    const visitorLimit = summary.org.monthly_visitor_limit;
    const visitorPct = visitorLimit && visitorLimit > 0 ? Math.round((monthUsage.visitors / visitorLimit) * 1000) / 10 : null;

    const byDay: Record<string, Record<string, number>> = {};
    for (const row of series) {
        byDay[row.day] ??= {};
        byDay[row.day][row.metric] = row.value;
    }
    const days: string[] = [];
    for (let d = new Date(from + 'T00:00:00Z'); d <= new Date(to + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
        days.push(d.toISOString().slice(0, 10));
    }
    const volume = days.map((day) => (byDay[day]?.[METRICS.unique_visitors] || 0) + (byDay[day]?.[METRICS.sdk_assign] || 0));

    return (
        <>
            <PageHeader
                title={summary.org.name}
                description={`${summary.org.slug} · ${summary.org.plan} plan`}
                breadcrumb={
                    <span>
                        <Link href={`/admin/telemetry?from=${from}&to=${to}`} className="hover:underline">Telemetry</Link>
                        {' / '}
                        <Link href={`/admin/telemetry/orgs?from=${from}&to=${to}`} className="hover:underline">Orgs</Link>
                    </span>
                }
                actions={<ButtonLink href={`/admin/orgs/${id}`} variant="secondary" size="sm">Tenant controls</ButtonLink>}
            />
            <div className="mb-4"><Suspense fallback={null}><DateRangeFilter /></Suspense></div>
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Status" value={<StatusBadge status={summary.org.status} />} />
                <Stat label="Quota this month" value={visitorPct == null ? `${monthUsage.visitors.toLocaleString()} / ∞` : `${visitorPct}%`} hint={`${monthUsage.visitors.toLocaleString()} visitors`} />
                <Stat label="Unique visitors" value={(totals.unique_visitors || 0).toLocaleString()} />
                <Stat label="Conversions" value={(totals.conversions || 0).toLocaleString()} />
                <Stat label="SDK requests" value={((totals.sdk_assign || 0) + (totals.sdk_exposure || 0) + (totals.sdk_goal || 0)).toLocaleString()} />
                <Stat label="Tests created" value={(totals.tests_created || 0).toLocaleString()} />
                <Stat label="Domains added" value={(totals.domains_added || 0).toLocaleString()} />
                <Stat label="Errors / 429" value={`${totals.errors || 0} / ${totals.rate_limit_hits || 0}`} />
            </div>
            <Card className="mb-6">
                <CardHeader title="Visitor and assign volume" />
                <CardBody><Sparkline values={volume} labels={days} /></CardBody>
            </Card>
            <div className="mb-6 grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader title="Members" />
                    <CardBody>
                        <ul className="space-y-1 text-sm">
                            {summary.members.map((m) => (
                                <li key={m.user_id} className="flex justify-between gap-2">
                                    <Link href={`/admin/telemetry/users/${m.user_id}?from=${from}&to=${to}`} className="hover:underline">{m.email}</Link>
                                    <span className="text-zinc-500">{m.role}</span>
                                </li>
                            ))}
                        </ul>
                    </CardBody>
                </Card>
                <Card>
                    <CardHeader title="Projects" />
                    <CardBody>
                        <ul className="space-y-1 text-sm">
                            {summary.projects.map((p) => (
                                <li key={p.id}>{p.name}</li>
                            ))}
                        </ul>
                    </CardBody>
                </Card>
            </div>
            <Card>
                <CardHeader title="Timeline" description="Product-usage events for this org" />
                <Table>
                    <THead>
                        <tr><TH>When</TH><TH>Action</TH><TH>User</TH><TH>Experiment</TH></tr>
                    </THead>
                    <TBody>
                        {timeline.map((e) => (
                            <TR key={e.id}>
                                <TD className="tabular-nums text-xs">{new Date(e.occurred_at).toLocaleString()}</TD>
                                <TD>{e.action}</TD>
                                <TD className="font-mono text-xs">{e.user_id || '-'}</TD>
                                <TD className="font-mono text-xs">{e.experiment_id || '-'}</TD>
                            </TR>
                        ))}
                    </TBody>
                </Table>
            </Card>
        </>
    );
}
