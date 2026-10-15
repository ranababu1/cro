import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTenantSummary } from '@/lib/admin';
import { db } from '@/lib/db';
import { PageHeader, Card, CardHeader, StatusBadge, Badge, Table, THead, TBody, TR, TH, TD, Stat, Alert, EmptyState, ButtonLink, CardBody } from '@/app/components/ui';
import TenantControls from './TenantControls';
import SpecialFriendPanel from './SpecialFriendPanel';
import { parseAllowances } from '@/lib/allowances';
import { getOrgEntitlements } from '@/lib/entitlements';
import { getPageviewStatus } from '@/lib/pageviewQuota';

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export default async function TenantDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const tenant = await getTenantSummary(id);
    if (!tenant) notFound();
    const audit = await db.getAuditLog(id, 50);
    const { org, members, projects, usage } = tenant;
    const pv = await getPageviewStatus(id, { fresh: true });
    const visitorLimit = (await getOrgEntitlements(id)).limits.monthlyVisitors;

    return (
        <>
            <PageHeader
                breadcrumb={<Link href="/admin" className="hover:text-zinc-900">Tenants</Link>}
                title={<span className="flex flex-wrap items-center gap-3">{org.name}<StatusBadge status={org.status} />{org.special_friend && <Badge tone="brand">Special friend</Badge>}</span>}
                description={`${org.slug} · created ${when(org.created_at)}`}
            />
            {org.status === 'suspended' && (
                <Alert tone="danger" className="mb-6" title="Suspended">
                    {org.suspended_reason || 'No reason recorded.'} {org.suspended_at && `Since ${when(org.suspended_at)}.`} SDK keys, secret keys and the dashboard are blocked.
                </Alert>
            )}
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
                <Stat label="Pageviews this month" value={pv.used.toLocaleString()} hint={pv.limit === null ? 'Unlimited' : `${pv.paused ? 'Paused at cap. ' : ''}Cap ${pv.limit.toLocaleString()}`} />
                <Stat label="Visitors this month" value={usage.month.visitors.toLocaleString()} hint={visitorLimit === null ? 'No limit' : `Limit ${visitorLimit.toLocaleString()}`} />
                <Stat label="Events this month" value={usage.month.events.toLocaleString()} />
                <Stat label="Experiments" value={usage.total.experiments} hint={`${usage.total.running} running`} />
                <Stat label="All-time visitors" value={usage.total.visitors.toLocaleString()} hint={`${usage.total.events.toLocaleString()} events`} />
            </div>

            <TenantControls org={org} />
            <SpecialFriendPanel orgId={org.id} specialFriend={org.special_friend} allowances={parseAllowances(org.custom_allowances)} />

            <Card className="mt-6">
                <CardHeader title="Member profiles" actions={<ButtonLink href="/api/admin/profiles" variant="secondary" size="sm" prefetch={false}>Export all profiles (CSV)</ButtonLink>} />
                <CardBody>
                    <div className="grid gap-4 md:grid-cols-2" data-testid="member-profiles">
                        {members.map((m) => (
                            <dl key={m.user_id} className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1 rounded-lg border border-zinc-200 p-3 text-sm">
                                <dt className="col-span-2 mb-1 font-medium text-zinc-900">{m.email}</dt>
                                {([
                                    ['Name', [m.first_name, m.last_name].filter(Boolean).join(' ')],
                                    ['Country', m.country], ['Phone', m.phone], ['Company or website', m.company], ['Job role', m.job_role],
                                    ['Company size', m.company_size], ['Heard about us', m.heard_from], ['Primary goal', m.primary_goal],
                                    ['Marketing emails', m.marketing_opt_in ? 'Opted in' : 'No'],
                                    ['Profile', m.profile_completed_at ? `Completed ${new Date(m.profile_completed_at).toLocaleDateString()}` : 'Not completed'],
                                ] as const).map(([k, v]) => (
                                    <div key={k} className="contents"><dt className="text-zinc-500">{k}</dt><dd className="text-zinc-800">{v || '-'}</dd></div>
                                ))}
                            </dl>
                        ))}
                    </div>
                </CardBody>
            </Card>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader title="Members" />
                    <Table>
                        <THead><tr><TH>Email</TH><TH>Role</TH><TH align="right">Joined</TH></tr></THead>
                        <TBody>{members.map((m) => (
                            <TR key={m.user_id}><TD className="text-zinc-900">{m.email}</TD><TD><Badge tone={m.role === 'owner' ? 'brand' : 'neutral'}>{m.role}</Badge></TD><TD numeric>{new Date(m.joined_at).toLocaleDateString()}</TD></TR>
                        ))}</TBody>
                    </Table>
                </Card>
                <Card>
                    <CardHeader title="Projects" />
                    <Table>
                        <THead><tr><TH>Name</TH><TH>ID</TH></tr></THead>
                        <TBody>{projects.map((p) => (
                            <TR key={p.id}><TD className="text-zinc-900">{p.name}</TD><TD><code className="font-mono text-xs">{p.id}</code></TD></TR>
                        ))}</TBody>
                    </Table>
                </Card>
            </div>

            <Card className="mt-6">
                <CardHeader title="Audit log" description="Latest 50 entries for this organization." />
                {audit.length === 0 ? <EmptyState title="No entries" /> : (
                    <Table>
                        <THead><tr><TH>When</TH><TH>Action</TH><TH>Entity</TH><TH>Actor</TH></tr></THead>
                        <TBody>{audit.map((a) => (
                            <TR key={a.id}>
                                <TD className="whitespace-nowrap">{when(a.created_at)}</TD>
                                <TD><code className="font-mono text-xs text-zinc-800">{a.action}</code></TD>
                                <TD>{a.entity} <span className="font-mono text-xs text-zinc-400">{a.entity_id}</span></TD>
                                <TD className="font-mono text-xs">{a.actor_id ?? 'system'}</TD>
                            </TR>
                        ))}</TBody>
                    </Table>
                )}
            </Card>
        </>
    );
}
