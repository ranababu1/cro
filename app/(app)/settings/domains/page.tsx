'use client';

import { useEffect, useState } from 'react';
import { PageHeader, Card, CardHeader, CardBody, Button, Input, Field, EmptyState, Alert, CodeBlock } from '@/app/components/ui';

interface Domain { id: string; host: string; created_at: string }

export default function DomainsPage() {
    const [domains, setDomains] = useState<Domain[]>([]);
    const [host, setHost] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [snippet, setSnippet] = useState('');

    async function load() {
        const res = await fetch('/api/domains');
        const data = await res.json();
        setDomains(data.domains || []);
    }

    useEffect(() => {
        let cancelled = false;
        (async () => {
            await load();
            if (cancelled) return;
            const origin = window.location.origin;
            setSnippet(`<script src="${origin}/sdk.js" data-key="YOUR_SDK_KEY" async></script>`);
        })();
        return () => { cancelled = true; };
    }, []);

    async function add(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true); setError('');
        const res = await fetch('/api/domains', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host }) });
        const data = await res.json();
        setBusy(false);
        if (!res.ok) { setError(data.error || 'Could not add domain'); return; }
        setHost('');
        await load();
    }

    async function remove(id: string) {
        if (!confirm('Remove this domain? Running tests on it will stop accepting visitors.')) return;
        await fetch(`/api/domains/${id}`, { method: 'DELETE' });
        await load();
    }

    return (
        <div>
            <PageHeader title="Domains" description="Register the sites where your tests run. The SDK only accepts events from these domains." />
            {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader title="Registered domains" />
                    <CardBody>
                        <form onSubmit={add} className="mb-6 flex gap-2">
                            <Field label="Domain" className="flex-1">
                                {(id) => <Input id={id} placeholder="www.example.com" value={host} onChange={(e) => setHost(e.target.value)} required />}
                            </Field>
                            <Button type="submit" className="mt-7" disabled={busy}>Add</Button>
                        </form>
                        {domains.length === 0 ? (
                            <EmptyState title="No domains yet" description="Add the hostname of your site, for example www.example.com." />
                        ) : (
                            <ul className="divide-y divide-zinc-100">
                                {domains.map((d) => (
                                    <li key={d.id} className="flex items-center justify-between py-3 text-sm">
                                        <span className="font-medium text-zinc-900">{d.host}</span>
                                        <Button variant="danger" size="sm" onClick={() => remove(d.id)}>Remove</Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardBody>
                </Card>
                <Card>
                    <CardHeader title="Install the SDK" description="One line in the &lt;head&gt; of your control page and every variation page." />
                    <CardBody>
                        <CodeBlock label="HTML" code={snippet || '<script src="/sdk.js" data-key="YOUR_SDK_KEY" async></script>'} />
                        <p className="mt-3 text-sm text-zinc-500">Create an SDK key under API keys and replace YOUR_SDK_KEY. The same tag goes on every page in the test.</p>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
