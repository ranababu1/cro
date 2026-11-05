'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, CardBody, Field, Select, Textarea, Alert } from '@/app/components/ui';

export type ThreadMessage = { id: string; body: string; from_staff: boolean; created_at: string; author_name: string | null; author_email: string | null };
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export const statusTone = { open: 'brand', waiting: 'warning', closed: 'neutral' } as const;
export const statusLabel = { open: 'Open', waiting: 'Waiting for you', closed: 'Closed' } as const;

/** Messages of one ticket and a reply box. Customers reply or close; staff (admin) reply and pick the status. */
export function TicketThread({ ticketId, status, messages, staff = false }: { ticketId: string; status: 'open' | 'waiting' | 'closed'; messages: ThreadMessage[]; staff?: boolean }) {
    const router = useRouter();
    const [body, setBody] = useState('');
    const [next, setNext] = useState<'waiting' | 'open' | 'closed'>('waiting');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const url = staff ? `/api/admin/support/${ticketId}` : `/api/support/tickets/${ticketId}`;

    async function send(close = false) {
        setBusy(true); setError(null);
        const payload = staff ? { body, status: next } : { body: body || 'Closed by customer.', ...(close ? { status: 'closed' } : {}) };
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const j = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) { setError(j.error ?? 'Could not send'); return; }
        setBody('');
        router.refresh();
    }

    return (
        <div className="space-y-4">
            {messages.map((m) => (
                <Card key={m.id} className={m.from_staff ? 'border-brand-200' : undefined}>
                    <CardBody>
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                            {m.from_staff ? <Badge tone="brand">Support</Badge> : <span className="font-medium text-zinc-700">{m.author_name || m.author_email || 'Former member'}</span>}
                            <span>{when(m.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm text-zinc-800">{m.body}</p>
                    </CardBody>
                </Card>
            ))}
            <Card>
                <CardBody className="space-y-3">
                    {error && <Alert tone="danger">{error}</Alert>}
                    <Field label={status === 'closed' && !staff ? 'Reply to reopen this ticket' : 'Reply'}>
                        {(id) => <Textarea id={id} rows={5} value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} />}
                    </Field>
                    <div className="flex flex-wrap items-center gap-3">
                        {staff && (
                            <Select value={next} onChange={(e) => setNext(e.target.value as typeof next)} aria-label="Status after reply" className="w-48">
                                <option value="waiting">Waiting for customer</option>
                                <option value="open">Keep open</option>
                                <option value="closed">Close</option>
                            </Select>
                        )}
                        <Button disabled={busy || !body.trim()} onClick={() => send()}>{busy ? 'Sending...' : 'Send reply'}</Button>
                        {!staff && status !== 'closed' && <Button variant="secondary" disabled={busy} onClick={() => send(true)}>Close ticket</Button>}
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
