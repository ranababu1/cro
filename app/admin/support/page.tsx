import Link from 'next/link';
import type { Metadata } from 'next';
import { listAllTickets, CATEGORY_LABELS, TICKET_STATUSES, type TicketStatus } from '@/lib/support';
import { PageHeader, Card, CardHeader, CardBody, Badge, ButtonLink } from '@/app/components/ui';
import { statusLabel, statusTone } from '@/app/components/support/TicketThread';

export const metadata: Metadata = { title: 'Support queue' };
export const dynamic = 'force-dynamic';

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST';

export default async function SupportQueuePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
    const { status } = await searchParams;
    const filter = TICKET_STATUSES.includes(status as TicketStatus) ? (status as TicketStatus) : undefined;
    const rows = await listAllTickets(filter);
    return (
        <>
            <PageHeader title="Support queue" description="Every customer ticket. Open tickets wait for us; waiting tickets wait for the customer." actions={<ButtonLink href="/admin" variant="secondary" size="sm">Back to tenants</ButtonLink>} />
            <div className="mb-4 flex gap-3 text-sm">
                {[undefined, ...TICKET_STATUSES].map((s) => (
                    <Link key={s ?? 'all'} href={s ? `/admin/support?status=${s}` : '/admin/support'} className={s === filter ? 'font-semibold text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}>{s ? statusLabel[s] : 'All'}</Link>
                ))}
            </div>
            <Card>
                <CardHeader title={`Tickets (${rows.length})`} />
                <CardBody>
                    {rows.length === 0 ? <p className="text-sm text-zinc-500">No tickets.</p> : (
                        <table className="w-full text-sm" data-testid="support-table">
                            <thead><tr className="text-left text-zinc-500"><th className="py-2">Subject</th><th>Status</th><th>Topic</th><th>Org</th><th>From</th><th>Last activity</th></tr></thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.id} className="border-t border-zinc-100">
                                        <td className="py-2"><Link className="text-blue-700 hover:underline" href={`/admin/support/${r.id}`}>{r.subject}</Link></td>
                                        <td><Badge tone={statusTone[r.status]}>{r.status}</Badge></td>
                                        <td>{CATEGORY_LABELS[r.category]}</td>
                                        <td><Link className="text-blue-700 hover:underline" href={`/admin/orgs/${r.org_id}`}>{r.org_name}</Link> <span className="text-zinc-400">{r.org_plan}</span></td>
                                        <td>{r.user_email ?? '-'}</td>
                                        <td className="whitespace-nowrap">{when(r.updated_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardBody>
            </Card>
        </>
    );
}
