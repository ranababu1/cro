import Link from 'next/link';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { topOrgs, defaultRange } from '@/lib/telemetryQueries';
import { METRICS } from '@/lib/telemetry';
import { PageHeader, Card, Table, THead, TBody, TR, TH, TD, ButtonLink, Input, StatusBadge } from '@/app/components/ui';
import { DateRangeFilter } from '../DateRangeFilter';

export const metadata: Metadata = { title: 'Telemetry · Orgs' };

export default async function TelemetryOrgsPage({
    searchParams,
}: {
    searchParams: Promise<{ from?: string; to?: string; q?: string; metric?: string }>;
}) {
    const sp = await searchParams;
    const { from, to } = defaultRange(sp);
    const metric = sp.metric || METRICS.unique_visitors;
    const q = sp.q || '';
    const data = await topOrgs(from, to, metric, q);

    return (
        <>
            <PageHeader
                title="Top organizations by volume"
                description="Usage aggregated per tenant."
                breadcrumb={<Link href={`/admin/telemetry?from=${from}&to=${to}`} className="hover:underline">Telemetry</Link>}
                actions={
                    <ButtonLink href={`/api/admin/telemetry/export?kind=orgs&from=${from}&to=${to}&metric=${metric}&q=${encodeURIComponent(q)}`} variant="secondary" size="sm">
                        Export CSV
                    </ButtonLink>
                }
            />
            <div className="mb-4 flex flex-wrap items-end gap-4">
                <Suspense fallback={null}><DateRangeFilter /></Suspense>
                <form className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="from" value={from} />
                    <input type="hidden" name="to" value={to} />
                    <label className="text-xs text-zinc-500">
                        Metric
                        <select name="metric" defaultValue={metric} className="mt-1 block rounded-md border border-zinc-200 px-2 py-1.5 text-sm">
                            {Object.values(METRICS).map((m) => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    </label>
                    <label className="text-xs text-zinc-500">
                        Search
                        <Input name="q" defaultValue={q} placeholder="name or slug" className="mt-1" />
                    </label>
                    <button type="submit" className="h-9 rounded-md bg-brand-600 px-3 text-sm font-medium text-white">Filter</button>
                </form>
            </div>
            <Card>
                <Table>
                    <THead>
                        <tr>
                            <TH>Organization</TH>
                            <TH>Status</TH>
                            <TH>Plan</TH>
                            <TH align="right">Metric total</TH>
                            <TH align="right">Created</TH>
                        </tr>
                    </THead>
                    <TBody>
                        {data.rows.map((r) => (
                            <TR key={r.scope_id}>
                                <TD>
                                    <Link className="font-medium text-zinc-900 hover:underline" href={`/admin/telemetry/orgs/${r.scope_id}?from=${from}&to=${to}`}>
                                        {r.name}
                                    </Link>
                                    <p className="text-xs text-zinc-500">{r.slug}</p>
                                </TD>
                                <TD>{r.status ? <StatusBadge status={r.status as 'active' | 'suspended'} /> : '-'}</TD>
                                <TD className="capitalize">{r.plan || '-'}</TD>
                                <TD numeric>{r.total.toLocaleString()}</TD>
                                <TD numeric>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '-'}</TD>
                            </TR>
                        ))}
                    </TBody>
                </Table>
            </Card>
        </>
    );
}
