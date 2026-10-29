'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader, Card, CardHeader, CardBody, Button, Alert, Field, Input, Select, Badge, Spinner } from '@/app/components/ui';
import { UpgradeNote } from '@/app/components/UpgradeNote';

type Provider = { id: string; label: string; images: boolean; text_models: string[]; default_text_model: string; key_url: string; key_placeholder: string; key: { last4: string; added_at: string } | null };
type State = { configured: boolean; allowed: boolean; upgrade: string | null; owner: boolean; providers: Provider[]; text_provider: string | null; text_model: string | null; ready: boolean; limits: { hourly: number; daily: number } };

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** AI settings: the organization's own provider keys and the model used for suggestions. Growth and above; owners manage keys. */
export default function AiSettingsPage() {
    const [s, setS] = useState<State | null>(null);
    const [failed, setFailed] = useState(false);
    const [error, setError] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [keyFor, setKeyFor] = useState<string | null>(null);
    const [keyValue, setKeyValue] = useState('');
    const [provider, setProvider] = useState('');
    const [model, setModel] = useState('');

    const apply = useCallback((next: State) => {
        setS(next);
        setProvider(next.text_provider ?? '');
        setModel(next.text_model ?? '');
    }, []);
    useEffect(() => {
        let live = true;
        fetch('/api/ai').then((r) => (r.ok ? r.json() : null)).then((next) => { if (!live) return; if (next) apply(next); else setFailed(true); }).catch(() => live && setFailed(true));
        return () => { live = false; };
    }, [apply]);

    async function call(tag: string, path: string, method: string, body?: unknown) {
        setBusy(tag); setError(''); setNote('');
        try {
            const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { setError(String(data.error || 'Something went wrong')); return false; }
            apply(data);
            return true;
        } finally {
            setBusy(null);
        }
    }

    if (failed) return <Alert tone="danger">Could not load AI settings.</Alert>;
    if (!s) return <div className="flex justify-center py-16"><Spinner /></div>;
    const withKeys = s.providers.filter((p) => p.key);
    const current = s.providers.find((p) => p.id === provider);
    const canEdit = s.configured && s.allowed && s.owner;

    return (
        <>
            <PageHeader title="AI" description="Use your own AI provider key to get test ideas from a page, hypotheses in the new test wizard, copy suggestions in the visual editor, and plain-words summaries of your results." />
            {!s.configured && <Alert tone="neutral" className="mb-6" title="Not available yet">AI features are not switched on for this site yet. Please check back soon.</Alert>}
            {s.configured && !s.allowed && <div className="mb-6"><UpgradeNote>{s.upgrade}</UpgradeNote></div>}
            {s.configured && s.allowed && !s.owner && <Alert tone="neutral" className="mb-6">Only owners of the organization can add or remove keys.</Alert>}
            {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
            {note && <Alert tone="success" className="mb-4">{note}</Alert>}

            <Card className="mb-6">
                <CardHeader title="Provider keys" description="Each key is checked with the provider when you save it, stored encrypted, and never shown again. Only its last 4 characters are visible here. You pay the provider directly for what you use." />
                <CardBody>
                    <ul className="divide-y divide-zinc-200">
                        {s.providers.map((p) => (
                            <li key={p.id} className="py-4 first:pt-0 last:pb-0" data-testid={`ai-provider-${p.id}`}>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="font-medium text-zinc-900">{p.label} {p.images ? <Badge className="ml-1">Text and images</Badge> : <Badge className="ml-1">Text</Badge>}</p>
                                        <p className="text-sm text-zinc-500">
                                            {p.key ? <>Key ending in <code className="font-mono">{p.key.last4}</code>, added {when(p.key.added_at)}</> : 'No key saved.'}
                                            {' '}<a className="underline" href={p.key_url} target="_blank" rel="noopener noreferrer">Get a key</a>
                                        </p>
                                    </div>
                                    {canEdit && (
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="secondary" onClick={() => { setKeyFor(keyFor === p.id ? null : p.id); setKeyValue(''); }}>{p.key ? 'Replace key' : 'Add key'}</Button>
                                            {p.key && (
                                                <Button size="sm" variant="danger" disabled={busy !== null} onClick={async () => {
                                                    if (!window.confirm(`Remove the ${p.label} key? AI features that use it stop working until you add a key again.`)) return;
                                                    if (await call(`del-${p.id}`, `/api/ai/keys/${p.id}`, 'DELETE')) setNote(`${p.label} key removed.`);
                                                }}>Remove</Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {canEdit && keyFor === p.id && (
                                    <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={async (e) => {
                                        e.preventDefault();
                                        if (await call(`key-${p.id}`, '/api/ai/keys', 'POST', { provider: p.id, key: keyValue })) { setNote(`${p.label} key checked and saved.`); setKeyFor(null); }
                                        setKeyValue('');
                                    }}>
                                        <Field label={`${p.label} API key`} className="min-w-64 flex-1">{(id) => <Input id={id} type="password" autoComplete="off" spellCheck={false} required placeholder={p.key_placeholder} value={keyValue} onChange={(e) => setKeyValue(e.target.value)} />}</Field>
                                        <Button type="submit" disabled={busy !== null || !keyValue.trim()}>{busy === `key-${p.id}` ? 'Checking...' : 'Check and save'}</Button>
                                    </form>
                                )}
                            </li>
                        ))}
                    </ul>
                </CardBody>
            </Card>

            {withKeys.length > 0 && (
                <Card className="mb-6">
                    <CardHeader title="Model for text" description="The provider and model used for ideas, hypotheses, copy and summaries. Pick a suggested model or type any model name your key can use." />
                    <CardBody>
                        <form className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={async (e) => {
                            e.preventDefault();
                            if (await call('settings', '/api/ai', 'PUT', { text_provider: provider, text_model: model })) setNote('Model saved.');
                        }}>
                            <Field label="Provider">{(id) => (
                                <Select id={id} value={provider} disabled={!canEdit} onChange={(e) => { setProvider(e.target.value); setModel(s.providers.find((p) => p.id === e.target.value)?.default_text_model ?? ''); }}>
                                    {withKeys.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                                </Select>
                            )}</Field>
                            <Field label="Model" hint={current ? `Suggested: ${current.text_models.join(', ')}` : undefined}>{(id) => (
                                <>
                                    <Input id={id} list="ai-models" value={model} disabled={!canEdit} required onChange={(e) => setModel(e.target.value)} />
                                    <datalist id="ai-models">{current?.text_models.map((m) => <option key={m} value={m} />)}</datalist>
                                </>
                            )}</Field>
                            {canEdit && <Button type="submit" disabled={busy !== null || !provider || !model.trim()}>Save</Button>}
                        </form>
                    </CardBody>
                </Card>
            )}

            <Card>
                <CardHeader title="Where AI helps" />
                <CardBody>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
                        <li>Test planner: enter a page address and a goal to get test ideas you can add to the planner.</li>
                        <li>New test: suggest a hypothesis and an expected outcome.</li>
                        <li>Visual editor: suggest other headlines, button labels and copy for the selected text.</li>
                        <li>Results: a plain-words summary that follows the statistical verdict, and follow-up test ideas once a test is stopped.</li>
                    </ul>
                    <p className="mt-3 text-sm text-zinc-500">Your organization can make up to {s.limits.hourly} AI requests an hour and {s.limits.daily} a day. Only what a feature needs is sent to the provider you chose: the page text, the test name and numbers, or the selected text.</p>
                </CardBody>
            </Card>
        </>
    );
}
