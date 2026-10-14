'use client';

import { useCallback, useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';

interface Env { id: string; key: string; name: string }
interface Key {
    id: string; environment_id: string; environment_key: string; type: 'sdk' | 'secret';
    prefix: string; label: string | null; created_at: string; last_used_at: string | null; revoked_at: string | null;
}
interface ProjectBlock { project: { id: string; name: string } | null; environments: Env[]; keys: Key[] }

export default function ApiKeysPage() {
    const [projects, setProjects] = useState<ProjectBlock[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [newKey, setNewKey] = useState<string | null>(null);

    const load = useCallback(async () => {
        const res = await fetch('/api/keys');
        if (!res.ok) { setError(res.status === 401 ? 'Please sign in.' : 'Failed to load keys'); return; }
        setProjects((await res.json()).projects);
    }, []);

    useEffect(() => {
        // Initial fetch on mount. setState happens after the request resolves, not synchronously.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void load();
    }, [load]);

    async function createKey(environmentId: string, type: 'sdk' | 'secret') {
        setError(null);
        const res = await fetch('/api/keys', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ environment_id: environmentId, type }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Failed to create key'); return; }
        setNewKey(data.key);
        await load();
    }

    async function revokeKey(id: string) {
        if (!confirm('Revoke this key? Sites using it will stop working.')) return;
        const res = await fetch(`/api/keys/${id}`, { method: 'DELETE' });
        if (!res.ok) setError('Failed to revoke key');
        await load();
    }

    return (
        <div className="min-h-screen bg-base-100">
            <Navbar />
            <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
                <h1 className="text-3xl font-bold">API Keys</h1>
                <p className="text-base-content/70">
                    SDK keys (cro_pk_...) go in your website snippet. Secret keys (cro_sk_...) are for server calls to the
                    management API and must never be put in a browser.
                </p>
                {error && <div className="alert alert-error">{error}</div>}
                {newKey && (
                    <div className="alert alert-success flex-col items-start">
                        <span>Copy this key now. It will not be shown again.</span>
                        <code className="break-all select-all">{newKey}</code>
                        <button className="btn btn-sm" onClick={() => setNewKey(null)}>Done</button>
                    </div>
                )}
                {projects.map((p) => (
                    <div key={p.project?.id} className="card bg-base-200">
                        <div className="card-body">
                            <h2 className="card-title">{p.project?.name}</h2>
                            {p.environments.map((env) => (
                                <div key={env.id} className="border-t border-base-300 pt-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold">{env.name} <span className="badge">{env.key}</span></h3>
                                        <div className="flex gap-2">
                                            <button className="btn btn-sm btn-primary" onClick={() => createKey(env.id, 'sdk')}>New SDK key</button>
                                            <button className="btn btn-sm" onClick={() => createKey(env.id, 'secret')}>New secret key</button>
                                        </div>
                                    </div>
                                    <table className="table table-sm mt-2">
                                        <thead><tr><th>Key</th><th>Type</th><th>Created</th><th>Last used</th><th></th></tr></thead>
                                        <tbody>
                                            {p.keys.filter((k) => k.environment_id === env.id).map((k) => (
                                                <tr key={k.id} className={k.revoked_at ? 'opacity-50' : ''}>
                                                    <td><code>{k.prefix}...</code></td>
                                                    <td>{k.type}</td>
                                                    <td>{new Date(k.created_at).toLocaleString()}</td>
                                                    <td>{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never'}</td>
                                                    <td>{k.revoked_at ? 'Revoked' : (
                                                        <button className="btn btn-xs btn-error" onClick={() => revokeKey(k.id)}>Revoke</button>
                                                    )}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
