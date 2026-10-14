import Link from 'next/link';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { topUsers, defaultRange } from '@/lib/telemetryQueries';
import { METRICS } from '@/lib/telemetry';
import { PageHeader, Card, Table, THead, TBody, TR, TH, TD, ButtonLink, Input } from '@/app/components/ui';
import { DateRangeFilter } from '../DateRangeFilter';

export const metadata: Metadata = { title: 'Telemetry · Users' };

export default async function TelemetryUsersPage({
    searchParams,
}: {
    searchParams: Promise<{ from?: string; to?: string; q?: string; metric?: string }>;
}) {
    const sp = await searchParams;
    const { from, to } = defaultRange(sp);
    const metric = sp.metric || METRICS.api_key_requests;
    const q = sp.q || '';
    const data = await topUsers(from, to, metric, q);

    return (
        <>
            <PageHeader
                title="Top users by volume"
                description="Sortable by selected metric. Search by email or name."
                breadcrumb={<Link href={`/admin/telemetry?from=${from}&to=${to}`} className="hover:underline">Telemetry</Link>}
                actions={
                    <ButtonLink href={`/api/admin/telemetry/export?kind=users&from=${from}&to=${to}&metric=${metric}&q=${encodeURIComponent(q)}`} variant="secondary" size="sm">
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
                        <Input name="q" defaultValue={q} placeholder="email or name" className="mt-1" />
                    </label>
                    <button type="submit" className="h-9 rounded-md bg-brand-600 px-3 text-sm font-medium text-white">Filter</button>
                </form>
            </div>
            <Card>
                <Table>
                    <THead>
                        <tr>
                            <TH>User</TH>
                            <TH>Metric total</TH>
                            <TH>Last active</TH>
                            <TH>Last login</TH>
                            <TH>Signed up</TH>
                        </tr>
                    </THead>
                    <TBody>
                        {data.rows.map((r) => (
                            <TR key={r.scope_id}>
                                <TD>
                                    <Link className="font-medium text-zinc-900 hover:underline" href={`/admin/telemetry/users/${r.scope_id}?from=${from}&to=${to}`}>
                                        {r.email}
                                    </Link>
                                    <p className="text-xs text-zinc-500">{r.name}</p>
                                </TD>
                                <TD numeric>{r.total.toLocaleString()}</TD>
                                <TD>{r.last_active_at ? new Date(r.last_active_at).toLocaleString() : '-'}</TD>
                                <TD>{r.last_login_at ? new Date(r.last_login_at).toLocaleString() : '-'}</TD>
                                <TD>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '-'}</TD>
                            </TR>
                        ))}
                    </TBody>
                </Table>
            </Card>
        </>
    );
}
