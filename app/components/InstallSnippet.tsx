'use client';

import { useEffect, useMemo, useState } from 'react';
import { CodeBlock } from '@/app/components/ui';
import { installSnippetHtml } from '@/lib/publicOrigin';
import { INSTALL_ONCE } from '@/lib/installCopy';

type EnvChoice = 'prod' | 'dev';

interface InstallPayload {
    origin: string;
    keys: { prod: string | null; dev: string | null };
    default_env?: EnvChoice;
}

export function InstallSnippet({ className }: { className?: string }) {
    const [data, setData] = useState<InstallPayload | null>(null);
    const [env, setEnv] = useState<EnvChoice>('prod');
    const [error, setError] = useState('');

    useEffect(() => {
        void (async () => {
            const res = await fetch('/api/install').catch(() => null);
            if (!res || !res.ok) {
                const body = res ? ((await res.json().catch(() => null)) as { error?: string } | null) : null;
                setError(body?.error || 'Could not load your install snippet.');
                return;
            }
            const json = (await res.json()) as InstallPayload;
            setData(json);
            setEnv(json.default_env === 'dev' ? 'dev' : 'prod');
        })();
    }, []);

    const key = env === 'dev' ? data?.keys.dev : data?.keys.prod;
    const code = useMemo(() => {
        if (!data?.origin || !key) return '';
        return installSnippetHtml(data.origin, key);
    }, [data, key]);

    if (error) return <p className="text-sm text-red-600">{error}</p>;
    if (!data) return <p className="text-sm text-zinc-500">Loading install snippet…</p>;
    if (!key) return <p className="text-sm text-zinc-500">No SDK key available yet. Open API keys to create one.</p>;

    return (
        <div className={className}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-zinc-500">Environment</span>
                <div className="inline-flex rounded-md border border-zinc-200 p-0.5">
                    {([
                        ['prod', 'Production'],
                        ['dev', 'Development'],
                    ] as const).map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setEnv(id)}
                            className={`rounded px-2.5 py-1 text-xs font-medium ${env === id ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>
            <CodeBlock label="HTML" code={code} />
            <p className="mt-3 text-sm text-zinc-500">
                Paste this into the &lt;head&gt; of your control page and every variation page. The key is already filled in.
            </p>
            <p className="mt-1 text-sm text-zinc-600" data-testid="install-once">{INSTALL_ONCE}</p>
        </div>
    );
}
