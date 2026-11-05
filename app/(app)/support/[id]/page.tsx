import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getAppContext } from '@/lib/appContext';
import { getTicket, CATEGORY_LABELS } from '@/lib/support';
import { PageHeader, Badge, ButtonLink } from '@/app/components/ui';
import { TicketThread, statusLabel, statusTone } from '@/app/components/support/TicketThread';

export const metadata: Metadata = { title: 'Support ticket' };
export const dynamic = 'force-dynamic';

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
    const ctx = await getAppContext();
    if (!ctx) redirect('/signin');
    const t = await getTicket((await params).id);
    if (!t || !ctx.projects.some((p) => p.org_id === t.ticket.org_id)) notFound();
    const messages = t.messages.map((m) => ({ ...m, author_email: m.from_staff ? null : m.author_email, author_name: m.from_staff ? 'Support' : m.author_name }));
    return (
        <div className="max-w-3xl space-y-6">
            <PageHeader
                title={t.ticket.subject}
                description={<span className="flex items-center gap-2"><Badge tone={statusTone[t.ticket.status]}>{statusLabel[t.ticket.status]}</Badge>{CATEGORY_LABELS[t.ticket.category]}</span>}
                actions={<ButtonLink href="/support" variant="secondary" size="sm">All tickets</ButtonLink>}
            />
            <TicketThread ticketId={t.ticket.id} status={t.ticket.status} messages={messages} />
        </div>
    );
}
