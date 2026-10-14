import Link from 'next/link';
import type { Metadata } from 'next';
import { listTenants } from '@/lib/admin';
import { PageHeader, Card, StatusBadge, Table, THead, TBody, TR, TH, TD, Stat, EmptyState, ButtonLink } from '@/app/components/ui';

export const metadata: Metadata = { title: 'Admin console' };

const limit = (n: number | null) => (n === null ? 'Unlimited' : n.toLocaleString());

export default async function AdminHome() {
    const tenants = await listTenants();
    const active = tenants.filter((t) => t.org.status === 'active').length;
    const visitors = tenants.reduce((s, t) => s + t.usage.month.visitors, 0);
    const events = tenants.reduce((s, t) => s + t.usage.month.events, 0);

    return (
        <>
            <PageHeader
                title="Tenants"
                description="Every organization on this installation. Visible to platform admins only."
                actions={<ButtonLink href="/admin/telemetry" variant="secondary" size="sm">Platform telemetry</ButtonLink>}
            />
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Organizations" value={tenants.length} />
                <Stat label="Active" value={active} hint={`${tenants.length - active} suspended`} />
                <Stat label="Visitors this month" value={visitors.toLocaleString()} />
                <Stat label="Events this month" value={events.toLocaleString()} />
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
