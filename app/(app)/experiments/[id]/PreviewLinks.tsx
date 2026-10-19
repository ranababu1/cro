'use client';

import { useState } from 'react';
import { Card, CardHeader, CardBody, Button, Badge, Alert, CodeBlock } from '@/app/components/ui';
import type { Variation } from '@/lib/types';

/** QA preview links: open the control page as one variation, without entering the test or being counted. */
export function PreviewLinks({ experimentId, variations, completed }: { experimentId: string; variations: Variation[]; completed: boolean }) {
    const [links, setLinks] = useState<Record<string, { url: string; expires_at: string }>>({});
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');

    async function create(v: Variation) {
        setBusy(v.id); setError('');
        const res = await fetch(`/api/experiments/${experimentId}/variations/${v.id}/preview`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        setBusy('');
        if (!res.ok || !data.url) { setError(data.error || 'Could not create a preview link'); return; }
        setLinks((l) => ({ ...l, [v.id]: { url: data.url, expires_at: data.expires_at } }));
    }

    return (
        <Card data-testid="preview-links">
            <CardHeader
                title="Preview links"
                description="Check each version on your site before or during the test. A link opens the control page as that version, works for 7 days for anyone who has it, and is never counted in results."
            />
            <CardBody className="space-y-4">
                {completed && <Alert tone="neutral">This test is completed, so its versions can no longer be previewed.</Alert>}
                {error && <Alert tone="danger">{error}</Alert>}
                <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                    {variations.map((v) => {
                        const link = links[v.id];
                        return (
                            <li key={v.id} className="space-y-3 px-3 py-3" data-testid="preview-row">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="flex items-center gap-2 text-sm font-medium text-zinc-900">{v.name}{v.is_control && <Badge>Control</Badge>}</span>
                                    <div className="flex items-center gap-2">
                                        {link && <a href={link.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-700 hover:underline">Open preview</a>}
                                        <Button size="sm" variant="secondary" disabled={completed || busy === v.id} onClick={() => void create(v)} data-testid="create-preview">
                                            {link ? 'New link' : 'Create link'}
                                        </Button>
                                    </div>
                                </div>
                                {link && (
                                    <div>
                                        <CodeBlock code={link.url} label={`Preview link for ${v.name}`} />
                                        <p className="mt-1 text-xs text-zinc-500">Works until {new Date(link.expires_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.</p>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
                <p className="text-xs text-zinc-500">The snippet must be on the page. A bar at the bottom names the version shown and has an Exit preview button. Links to versions with their own URL go through the same redirect as visitors.</p>
            </CardBody>
        </Card>
    );
}
