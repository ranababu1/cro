import Link from 'next/link';
import type { Metadata } from 'next';
import { listTenants } from '@/lib/admin';
import { PageHeader, Card, Badge, StatusBadge, Table, THead, TBody, TR, TH, TD, Stat, EmptyState, ButtonLink } from '@/app/components/ui';

export const metadata: Metadata = { title: 'Admin console' };

const limit = (n: number | null) => (n === null ? 'Unlimited' : n.toLocaleString());

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
    const { filter } = await searchParams;
    const all = await listTenants();
    const specialOnly = filter === 'special';
    const tenants = specialOnly ? all.filter((t) => t.org.special_friend) : all;
    const active = tenants.filter((t) => t.org.status === 'active').length;
    const visitors = tenants.reduce((s, t) => s + t.usage.month.visitors, 0);
    const events = tenants.reduce((s, t) => s + t.usage.month.events, 0);

    return (
        <>
            <PageHeader
                title="Tenants"
                description="Every organization on this installation. Visible to platform admins only."
                actions={<div className="flex gap-2"><ButtonLink href="/api/admin/profiles" variant="secondary" size="sm" prefetch={false}>Export profiles (CSV)</ButtonLink><ButtonLink href="/admin/abuse" variant="secondary" size="sm">Abuse and domains</ButtonLink><ButtonLink href="/admin/telemetry" variant="secondary" size="sm">Platform telemetry</ButtonLink></div>}
            />
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Organizations" value={tenants.length} />
                <Stat label="Active" value={active} hint={`${tenants.length - active} suspended`} />
                <Stat label="Visitors this month" value={visitors.toLocaleString()} />
                <Stat label="Events this month" value={events.toLocaleString()} />
            </div>
            <div className="mb-3 flex gap-2 text-sm" role="tablist" aria-label="Filter tenants">
                <Link href="/admin" className={`rounded-md px-3 py-1.5 ${specialOnly ? 'text-zinc-600 hover:bg-zinc-100' : 'bg-blue-50 font-medium text-blue-700'}`}>All ({all.length})</Link>
                <Link href="/admin?filter=special" className={`rounded-md px-3 py-1.5 ${specialOnly ? 'bg-blue-50 font-medium text-blue-700' : 'text-zinc-600 hover:bg-zinc-100'}`}>Special friends ({all.filter((t) => t.org.special_friend).length})</Link>
            </div>
            <Card>
                {tenants.length === 0 ? (
                    <EmptyState title="No tenants yet" description="Organizations are created when a user signs in for the first time." />
                ) : (
                    <Table>
                        <THead>
                            <tr>
                                <TH>Organization</TH><TH>Status</TH><TH>Plan</TH><TH>Members</TH><TH align="right">Projects</TH>
                                <TH align="right">Experiments</TH><TH align="right">Visitors / limit</TH><TH align="right">Events</TH><TH align="right">Created</TH>
                            </tr>
                        </THead>
                        <TBody>
                            {tenants.map(({ org, members, projects, usage }) => (
                                <TR key={org.id}>
                                    <TD>
                                        <Link className="font-medium text-zinc-900 hover:underline" href={`/admin/orgs/${org.id}`}>{org.name}</Link>
                                        <p className="text-xs text-zinc-500">{org.slug}</p>
                                        {org.special_friend && <Badge tone="brand" className="mt-1">Special friend</Badge>}
                                    </TD>
                                    <TD><StatusBadge status={org.status} /></TD>
                                    <TD className="capitalize">{org.plan}</TD>
                                    <TD className="max-w-[14rem] truncate" title={members.map((m) => m.email).join(', ')}>{members.map((m) => m.email).join(', ')}</TD>
                                    <TD numeric>{projects.length}</TD>
                                    <TD numeric>{usage.total.experiments}<span className="text-zinc-400"> ({usage.total.running} running)</span></TD>
                                    <TD numeric>{usage.month.visitors.toLocaleString()}<span className="text-zinc-400"> / {limit(org.monthly_visitor_limit)}</span></TD>
                                    <TD numeric>{usage.month.events.toLocaleString()}</TD>
                                    <TD numeric>{new Date(org.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</TD>
                                </TR>
                            ))}
                        </TBody>
                    </Table>
                )}
            </Card>
            <p className="mt-3 text-xs text-zinc-500">Usage counts the current calendar month in UTC.</p>
        </>
    );
}
