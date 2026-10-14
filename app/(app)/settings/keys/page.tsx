'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader, Card, CardHeader, Button, Badge, Table, THead, TBody, TR, TH, TD, Alert, EmptyState, Spinner, CodeBlock } from '@/app/components/ui';

interface Env { id: string; key: string; name: string }
interface Key {
    id: string; environment_id: string; environment_key: string; type: 'sdk' | 'secret';
    prefix: string; label: string | null; created_at: string; last_used_at: string | null; revoked_at: string | null;
}
interface ProjectBlock { project: { id: string; name: string } | null; environments: Env[]; keys: Key[] }

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never');
const envOrder: Record<string, number> = { prod: 0, staging: 1, dev: 2 };

export default function ApiKeysPage() {
    const [projects, setProjects] = useState<ProjectBlock[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [created, setCreated] = useState<{ key: string; type: string; env: string } | null>(null);

    const load = useCallback(async () => {
        const res = await fetch('/api/keys');
        if (!res.ok) return setError('Could not load keys.');
        setProjects((await res.json()).projects);
    }, []);

    useEffect(() => {
        // Initial fetch; state is set after the request resolves.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void load();
    }, [load]);

    async function createKey(env: Env, type: 'sdk' | 'secret') {
        setError(null);
        const res = await fetch('/api/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ environment_id: env.id, type }) });
        const data = await res.json();
        if (!res.ok) return setError(data.error || 'Could not create the key.');
        setCreated({ key: data.key, type, env: env.name });
        await load();
    }

    async function revokeKey(id: string) {
        if (!confirm('Revoke this key? Anything using it stops working immediately.')) return;
        const res = await fetch(`/api/keys/${id}`, { method: 'DELETE' });
        if (!res.ok) setError('Could not revoke the key.');
        await load();
    }

    return (
        <>
            <PageHeader
                title="API keys"
                description="SDK keys (cro_pk_) are public and go in your site snippet. Secret keys (cro_sk_) are for server-side calls to the REST API. Never put a secret key in a browser."
            />
            {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
            {created && (
                <Card className="mb-6 border-emerald-200">
                    <CardHeader
                        title={`New ${created.type === 'sdk' ? 'SDK' : 'secret'} key for ${created.env}`}
                        description="Copy it now. For security it is stored as a hash and will not be shown again."
                        actions={<Button variant="secondary" size="sm" onClick={() => setCreated(null)}>Done</Button>}
                    />
                    <div className="p-5"><CodeBlock label="Key" code={created.key} /></div>
                </Card>
            )}
            {projects === null ? (
                <div className="flex h-40 items-center justify-center"><Spinner /></div>
            ) : (
                <div className="space-y-6">
                    {projects.flatMap((p) =>
                        [...p.environments].sort((a, b) => envOrder[a.key] - envOrder[b.key]).map((env) => {
                            const keys = p.keys.filter((k) => k.environment_id === env.id);
                            return (
                                <Card key={env.id}>
                                    <CardHeader
                                        title={<span className="flex items-center gap-2">{env.name}<Badge tone={env.key === 'prod' ? 'brand' : 'neutral'}>{env.key}</Badge></span>}
                                        description={projects.length > 1 ? p.project?.name : undefined}
                                        actions={
                                            <>
                                                <Button variant="secondary" size="sm" onClick={() => createKey(env, 'secret')}>New secret key</Button>
                                                <Button size="sm" onClick={() => createKey(env, 'sdk')}>New SDK key</Button>
                                            </>
                                        }
                                    />
                                    {keys.length === 0 ? (
                                        <EmptyState title="No keys" description={`Create an SDK key to send traffic from ${env.name.toLowerCase()}.`} />
                                    ) : (
                                        <Table>
                                            <THead><tr><TH>Key</TH><TH>Type</TH><TH>Created</TH><TH>Last used</TH><TH align="right"><span className="sr-only">Actions</span></TH></tr></THead>
                                            <TBody>
                                                {keys.map((k) => (
                                                    <TR key={k.id} className={k.revoked_at ? 'text-zinc-400' : ''}>
                                                        <TD><code className="font-mono text-xs text-zinc-800">{k.prefix}...</code></TD>
                                                        <TD>{k.type === 'sdk' ? 'SDK' : 'Secret'}</TD>
                                                        <TD>{when(k.created_at)}</TD>
                                                        <TD>{when(k.last_used_at)}</TD>
                                                        <TD align="right">
                                                            {k.revoked_at ? <Badge>Revoked</Badge> : <Button variant="danger" size="sm" onClick={() => revokeKey(k.id)}>Revoke</Button>}
                                                        </TD>
                                                    </TR>
                                                ))}
                                            </TBody>
                                        </Table>
                                    )}
                                </Card>
                            );
                        }),
                    )}
                </div>
            )}
        </>
    );
}
