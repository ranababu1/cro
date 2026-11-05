'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader, Card, CardHeader, CardBody, Button, Field, Input, Select, Textarea, Alert, Badge, Spinner, EmptyState, Table, THead, TBody, TR, TH, TD } from '@/app/components/ui';
import { statusLabel, statusTone } from '@/app/components/support/TicketThread';

type Ticket = { id: string; subject: string; category: string; status: 'open' | 'waiting' | 'closed'; created_at: string; updated_at: string };
const CATEGORIES: [string, string][] = [['question', 'Question'], ['bug', 'Something is broken'], ['billing', 'Plans and billing'], ['privacy', 'Privacy or data request'], ['security', 'Security'], ['other', 'Other']];
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Support: open a ticket for the current organization and follow its tickets. */
export default function SupportPage() {
    const router = useRouter();
    const [tickets, setTickets] = useState<Ticket[] | null>(null);
    const [form, setForm] = useState({ subject: '', category: 'question', body: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/support/tickets');
            const j = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(j.error ?? 'Could not load tickets');
            setTickets(j.tickets);
        } catch (e) { setError((e as Error).message); }
    }, []);
    useEffect(() => { load(); }, [load]);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true); setError(null);
        const res = await fetch('/api/support/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
        const j = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) { setError(j.error ?? 'Could not open the ticket'); return; }
        router.push(`/support/${j.id}`);
    }

    return (
        <div className="space-y-6">
            <PageHeader title="Support" description="Ask a question or report a problem. Everyone in your organization can see its tickets. We answer here, usually within one business day." />
            {error && <Alert tone="danger">{error}</Alert>}
            <Card>
                <CardHeader title="New ticket" />
                <CardBody>
                    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
                        <Field label="Subject">{(id) => <Input id={id} required minLength={3} maxLength={150} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />}</Field>
                        <Field label="Topic">
                            {(id) => <Select id={id} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                                {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </Select>}
                        </Field>
                        <Field label="Details" hint="Include the test name or page address if it is about one. Never paste secret API keys." className="sm:col-span-2">
                            {(id) => <Textarea id={id} required minLength={10} maxLength={5000} rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />}
                        </Field>
                        <div className="sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? 'Sending...' : 'Open ticket'}</Button></div>
                    </form>
                </CardBody>
            </Card>
            <Card>
                <CardHeader title="Your tickets" />
                {tickets === null ? <CardBody><Spinner /></CardBody> : tickets.length === 0 ? (
                    <CardBody><EmptyState title="No tickets yet" description="Tickets you and your team open appear here." /></CardBody>
                ) : (
                    <Table>
                        <THead><TR><TH>Subject</TH><TH>Status</TH><TH>Opened</TH><TH>Last activity</TH></TR></THead>
                        <TBody>
                            {tickets.map((t) => (
                                <TR key={t.id}>
                                    <TD><Link href={`/support/${t.id}`} className="font-medium text-zinc-900 hover:underline">{t.subject}</Link></TD>
                                    <TD><Badge tone={statusTone[t.status]}>{statusLabel[t.status]}</Badge></TD>
                                    <TD>{day(t.created_at)}</TD>
                                    <TD>{day(t.updated_at)}</TD>
                                </TR>
                            ))}
                        </TBody>
                    </Table>
                )}
            </Card>
        </div>
    );
}
