'use client';

import { useEffect, useState } from 'react';
import { PageHeader, Card, CardHeader, CardBody, Button, Input, Field, EmptyState, Alert } from '@/app/components/ui';
import { InstallSnippet } from '@/app/components/InstallSnippet';

interface Domain { id: string; host: string; created_at: string }

export default function DomainsPage() {
    const [domains, setDomains] = useState<Domain[]>([]);
    const [host, setHost] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

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
            <PageHeader title="Domains" description="Register the sites where your tests run. The SDK only accepts events from these domains. The free plan includes one domain, and subdomains count as the same domain. localhost always works with your development key." />
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
                    <CardHeader title="Install the SDK" description="One line in the &lt;head&gt; of your control page and every variation page. Your public SDK key is already filled in." />
                    <CardBody>
                        <InstallSnippet />
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
