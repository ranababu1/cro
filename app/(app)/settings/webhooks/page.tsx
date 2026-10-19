'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader, Card, CardHeader, CardBody, Button, Alert, Field, Input, Badge, Spinner, Table, THead, TBody, TR, TH, TD, EmptyState } from '@/app/components/ui';
import { UpgradeNote } from '@/app/components/UpgradeNote';

type Hook = { id: string; url: string; events: string[]; enabled: boolean; created_at: string; last_delivery_at: string | null; last_status: number | null; last_error: string | null; secret_hint: string };
type Delivery = { id: string; webhook_id: string; event: string; status: string; attempts: number; response_status: number | null; last_error: string | null; created_at: string; sent_at: string | null; next_attempt_at: string };
type State = { allowed: boolean; owner: boolean; upgrade: string | null; events: { id: string; label: string }[]; max: number; webhooks: Hook[]; deliveries: Delivery[] };

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const tone = (s: string) => (s === 'sent' ? 'success' : s === 'failed' ? 'danger' : 'warning') as 'success' | 'danger' | 'warning';

/** Webhooks: signed POSTs to your endpoints when tests change. Paid plans; owners manage them. */
export default function WebhooksPage() {
    const [s, setS] = useState<State | null>(null);
    const [failed, setFailed] = useState(false);
    const [url, setUrl] = useState('');
    const [events, setEvents] = useState<string[]>(['test.winner', 'test.completed']);
    const [secret, setSecret] = useState<{ id: string; value: string } | null>(null);
    const [error, setError] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);

    const fetchState = useCallback(async (): Promise<State | null> => {
        const res = await fetch('/api/webhooks');
        return res.ok ? res.json() : null;
    }, []);
    const load = useCallback(async () => {
        const next = await fetchState();
        if (next) setS(next); else setFailed(true);
    }, [fetchState]);
    useEffect(() => {
        let live = true;
        fetchState().then((next) => { if (!live) return; if (next) setS(next); else setFailed(true); }).catch(() => live && setFailed(true));
        return () => { live = false; };
    }, [fetchState]);

    async function call(path: string, method: string, body?: unknown) {
        setBusy(true); setError(''); setNote('');
        const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
        const data = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) { setError(String(data.error || 'Something went wrong')); return null; }
        await load();
        return data;
    }

    if (failed) return <Alert tone="danger">Could not load webhooks.</Alert>;
    if (!s) return <div className="flex justify-center py-16"><Spinner /></div>;
    const label = (id: string) => s.events.find((e) => e.id === id)?.label ?? id;
    const hookUrl = (id: string) => s.webhooks.find((w) => w.id === id)?.url ?? 'Deleted endpoint';

    return (
        <>
            <PageHeader title="Webhooks" description="Get a signed POST to your own endpoint when a test finds a winner, finishes, shows a sample ratio warning, or your organization reaches a plan limit." />
            {!s.allowed && <div className="mb-6"><UpgradeNote>{s.upgrade}</UpgradeNote></div>}
            {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
            {note && <Alert tone="success" className="mb-4">{note}</Alert>}
            {secret && (
                <Alert tone="warning" className="mb-4" title="Copy your signing secret now">
                    <span className="block">It is shown only once. Use it to check the X-FreeABTest-Signature header. See <a className="underline" href="/docs/webhooks#verify" target="_blank" rel="noopener noreferrer">how to verify a delivery</a>.</span>
                    <code className="mt-2 block break-all rounded bg-white/70 px-2 py-1 font-mono text-xs" data-testid="webhook-secret">{secret.value}</code>
                </Alert>
            )}

            {s.allowed && s.owner && s.webhooks.length < s.max && (
                <Card className="mb-6">
                    <CardHeader title="Add an endpoint" description={`Up to ${s.max} endpoints. The address must use https and be reachable from the internet.`} />
                    <CardBody>
                        <form className="space-y-4" onSubmit={async (e) => {
                            e.preventDefault();
                            const d = await call('/api/webhooks', 'POST', { url, events });
                            if (d) { setSecret({ id: d.webhook.id, value: d.secret }); setUrl(''); }
                        }}>
                            <Field label="Endpoint URL">{(id) => <Input id={id} type="url" required placeholder="https://example.com/hooks/freeabtest" value={url} onChange={(e) => setUrl(e.target.value)} />}</Field>
                            <fieldset>
                                <legend className="mb-2 text-sm font-medium text-zinc-800">Events</legend>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {s.events.map((ev) => (
                                        <label key={ev.id} className="flex items-center gap-2 text-sm text-zinc-700">
                                            <input type="checkbox" checked={events.includes(ev.id)} onChange={(e) => setEvents((cur) => (e.target.checked ? [...cur, ev.id] : cur.filter((x) => x !== ev.id)))} />
                                            {ev.label} <code className="text-xs text-zinc-500">{ev.id}</code>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                            <div className="flex justify-end"><Button type="submit" disabled={busy || !events.length}>Add webhook</Button></div>
                        </form>
                    </CardBody>
                </Card>
            )}

            <Card className="mb-6">
                <CardHeader title="Endpoints" description={s.owner ? undefined : 'Only owners can add or change webhooks.'} />
                {s.webhooks.length === 0 ? (
                    <EmptyState title="No webhooks yet" description="Add an endpoint to get events as they happen." />
                ) : (
                    <ul className="divide-y divide-zinc-100">
                        {s.webhooks.map((w) => (
                            <li key={w.id} className="space-y-2 p-5" data-testid="webhook">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="break-all font-mono text-sm text-zinc-900">{w.url}</span>
                                    {w.enabled ? <Badge tone="success">On</Badge> : <Badge>Off</Badge>}
                                </div>
                                <p className="text-xs text-zinc-500">{w.events.map(label).join(', ')}. Secret {w.secret_hint}.</p>
                                <p className="text-xs text-zinc-500">
                                    {w.last_delivery_at ? <>Last delivery {when(w.last_delivery_at)}: {w.last_error ? <span className="text-red-700">{w.last_error}</span> : <span className="text-emerald-700">answered {w.last_status}</span>}</> : 'No deliveries yet.'}
                                </p>
                                {s.owner && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {s.allowed && w.enabled && <Button size="sm" variant="secondary" disabled={busy} onClick={async () => {
                                            const d = await call(`/api/webhooks/${w.id}/test`, 'POST');
                                            if (d) d.ok ? setNote(`Test delivery sent. Your endpoint answered ${d.status}.`) : setError(`Test delivery failed: ${d.error}`);
                                        }}>Send test</Button>}
                                        {(s.allowed || w.enabled) && <Button size="sm" variant="secondary" disabled={busy} onClick={() => void call(`/api/webhooks/${w.id}`, 'PATCH', { enabled: !w.enabled })}>{w.enabled ? 'Turn off' : 'Turn on'}</Button>}
                                        {s.allowed && <Button size="sm" variant="secondary" disabled={busy} onClick={async () => {
                                            if (!confirm('Replace the signing secret? Deliveries are signed with the new one at once.')) return;
                                            const d = await call(`/api/webhooks/${w.id}`, 'PATCH', { rotate_secret: true });
                                            if (d?.secret) setSecret({ id: w.id, value: d.secret });
                                        }}>Replace secret</Button>}
                                        <Button size="sm" variant="danger" disabled={busy} onClick={() => confirm('Delete this webhook? Its queued deliveries are deleted too.') && void call(`/api/webhooks/${w.id}`, 'DELETE')}>Delete</Button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card>
                <CardHeader title="Recent deliveries" description="The last 30 attempts. Failed deliveries are retried after 1, 5, 30, 120 and 720 minutes. Records are kept for 30 days." />
                {s.deliveries.length === 0 ? <CardBody><p className="text-sm text-zinc-500">Nothing sent yet.</p></CardBody> : (
                    <Table>
                        <THead><tr><TH>When</TH><TH>Event</TH><TH>Endpoint</TH><TH>Status</TH><TH align="right">Tries</TH></tr></THead>
                        <TBody>
                            {s.deliveries.map((d) => (
                                <TR key={d.id}>
                                    <TD>{when(d.created_at)}</TD>
                                    <TD><code className="text-xs">{d.event}</code></TD>
                                    <TD className="max-w-[14rem] truncate font-mono text-xs" title={hookUrl(d.webhook_id)}>{hookUrl(d.webhook_id)}</TD>
                                    <TD>
                                        <Badge tone={tone(d.status)}>{d.status === 'pending' && d.attempts > 0 ? 'retrying' : d.status}</Badge>
                                        {d.response_status && <span className="ml-1 text-xs text-zinc-500">{d.response_status}</span>}
                                        {d.last_error && d.status !== 'sent' && <span className="block text-xs text-zinc-500">{d.last_error}</span>}
                                    </TD>
                                    <TD numeric>{d.attempts}</TD>
                                </TR>
                            ))}
                        </TBody>
                    </Table>
                )}
            </Card>
        </>
    );
}
