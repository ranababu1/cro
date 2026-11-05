import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getTicket, CATEGORY_LABELS } from '@/lib/support';
import { PageHeader, Badge, ButtonLink } from '@/app/components/ui';
import { TicketThread, statusTone } from '@/app/components/support/TicketThread';

export const metadata: Metadata = { title: 'Support ticket' };
export const dynamic = 'force-dynamic';

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
    const t = await getTicket((await params).id);
    if (!t) notFound();
    const org = await db.getOrganization(t.ticket.org_id);
    return (
        <div className="max-w-3xl space-y-6">
            <PageHeader
                title={t.ticket.subject}
                description={<span className="flex flex-wrap items-center gap-2"><Badge tone={statusTone[t.ticket.status]}>{t.ticket.status}</Badge>{CATEGORY_LABELS[t.ticket.category]} · <Link className="text-blue-700 hover:underline" href={`/admin/orgs/${t.ticket.org_id}`}>{org?.name ?? t.ticket.org_id}</Link> ({org?.plan})</span>}
                actions={<ButtonLink href="/admin/support" variant="secondary" size="sm">Queue</ButtonLink>}
            />
            <TicketThread staff ticketId={t.ticket.id} status={t.ticket.status} messages={t.messages} />
        </div>
    );
}
