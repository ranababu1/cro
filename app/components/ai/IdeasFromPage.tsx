'use client';

import { useState } from 'react';
import { Card, CardHeader, CardBody, Button, Input, Textarea, Field, Alert, Badge } from '@/app/components/ui';
import { AiHint, postAi, useAiAvailability } from './AiClient';

type Idea = { title: string; hypothesis: string; change: string; priority: 'low' | 'medium' | 'high' };
const TONE = { high: 'danger', medium: 'warning', low: 'neutral' } as const;

/** Test planner: test ideas for a public page and a business objective, from the organization's AI provider. */
export function IdeasFromPage({ onAdded }: { onAdded: () => void }) {
    const ai = useAiAvailability();
    const [url, setUrl] = useState('');
    const [objective, setObjective] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [ideas, setIdeas] = useState<(Idea & { added?: boolean })[]>([]);
    const [pageUrl, setPageUrl] = useState('');

    if (!ai || !ai.configured) return null;
    if (!ai.ready) return <Card><CardBody><p className="text-sm font-medium text-zinc-900">Test ideas from a page</p><AiHint ai={ai} /></CardBody></Card>;

    async function add(i: number) {
        const idea = ideas[i];
        const hypothesis = idea.change ? `${idea.hypothesis}\n\nChange: ${idea.change}` : idea.hypothesis;
        const r = await postAi('/api/ideas', { title: idea.title, hypothesis: hypothesis.slice(0, 2000), page_url: pageUrl || undefined, priority: idea.priority });
        if (!r.ok) { setError(r.error); return; }
        setIdeas((list) => list.map((x, j) => (j === i ? { ...x, added: true } : x)));
        onAdded();
    }

    return (
        <Card data-testid="ai-ideas">
            <CardHeader title="Test ideas from a page" description="Enter a public page and what you want visitors to do. Your AI provider reads the page and suggests tests you can add to the planner." />
            <CardBody>
                <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end" onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true); setError(''); setIdeas([]);
                    const r = await postAi<{ ideas: Idea[]; page: { url: string } }>('/api/ai/ideas', { url, objective });
                    setBusy(false);
                    if (!r.ok) { setError(r.error); return; }
                    setIdeas(r.data.ideas); setPageUrl(r.data.page.url);
                }}>
                    <Field label="Page URL">{(id) => <Input id={id} type="url" required placeholder="https://example.com/pricing" value={url} onChange={(e) => setUrl(e.target.value)} />}</Field>
                    <Field label="Business objective">{(id) => <Textarea id={id} rows={1} required placeholder="More free trial sign-ups" value={objective} onChange={(e) => setObjective(e.target.value)} />}</Field>
                    <Button type="submit" disabled={busy}>{busy ? 'Reading the page...' : 'Suggest ideas'}</Button>
                </form>
                {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
                {ideas.length > 0 && (
                    <ul className="mt-4 space-y-3">
                        {ideas.map((idea, i) => (
                            <li key={i} className="rounded-lg border border-zinc-200 p-3">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <p className="font-medium text-zinc-900">{idea.title} <Badge tone={TONE[idea.priority]} className="ml-1">{idea.priority}</Badge></p>
                                    <Button size="sm" variant="secondary" disabled={idea.added} onClick={() => add(i)}>{idea.added ? 'Added' : 'Add to planner'}</Button>
                                </div>
                                <p className="mt-1 text-sm text-zinc-700">{idea.hypothesis}</p>
                                {idea.change && <p className="mt-1 text-sm text-zinc-500">Change: {idea.change}</p>}
                            </li>
                        ))}
                    </ul>
                )}
            </CardBody>
        </Card>
    );
}
