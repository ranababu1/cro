'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardBody, Button, Input } from '@/app/components/ui';

/** Create, copy or turn off a read-only public link to this test's results. */
export function ShareResults({ experimentId }: { experimentId: string }) {
    const [url, setUrl] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    const endpoint = `/api/experiments/${experimentId}/share`;

    useEffect(() => {
        void fetch(endpoint).then((r) => (r.ok ? r.json() : null)).then((d) => d && setUrl(d.url));
    }, [endpoint]);

    async function call(method: 'POST' | 'DELETE') {
        setBusy(true);
        const res = await fetch(endpoint, { method });
        setBusy(false);
        if (res.ok) { setUrl((await res.json()).url); setCopied(false); }
    }

    return (
        <Card>
            <CardHeader title="Share results" description="Anyone with the link can see the numbers on this page. They cannot see your pages, settings or account, and cannot change anything." />
            <CardBody>
                {url ? (
                    <div className="flex flex-wrap items-center gap-2">
                        <Input readOnly value={url} aria-label="Share link" className="min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                        <Button variant="secondary" onClick={() => { void navigator.clipboard?.writeText(url); setCopied(true); }}>{copied ? 'Copied' : 'Copy link'}</Button>
                        <Button variant="ghost" disabled={busy} onClick={() => confirm('Turn off this link? Anyone using it loses access.') && call('DELETE')}>Turn off</Button>
                    </div>
                ) : (
                    <Button disabled={busy} onClick={() => call('POST')}>Create share link</Button>
                )}
            </CardBody>
        </Card>
    );
}
