'use client';

import { useState } from 'react';
import { Card, CardHeader, CardBody, Button, Alert, Badge } from '@/app/components/ui';
import { AiHint, postAi, useAiAvailability } from './AiClient';

type Summary = { verdict: { title: string }; summary: string; next_steps: string[] };
type Idea = { title: string; hypothesis: string; priority: 'low' | 'medium' | 'high'; added?: boolean };

/** Results page: a plain-words summary that follows the statistical verdict, and follow-up ideas for a stopped test. */
export function AiResults({ experimentId, completed }: { experimentId: string; completed: boolean }) {
    const ai = useAiAvailability();
    const [busy, setBusy] = useState<'summary' | 'followups' | null>(null);
    const [error, setError] = useState('');
    const [summary, setSummary] = useState<Summary | null>(null);
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [pageUrl, setPageUrl] = useState<string | null>(null);
    if (!ai || !ai.configured) return null;
    if (!ai.ready) return <AiHint ai={ai} />;

    async function run(kind: 'summary' | 'followups') {
        setBusy(kind); setError('');
        const r = await postAi<Summary & { ideas: Idea[]; page_url: string | null }>(`/api/experiments/${experimentId}/ai`, { kind });
        setBusy(null);
        if (!r.ok) { setError(r.error); return; }
        if (kind === 'summary') setSummary(r.data); else { setIdeas(r.data.ideas); setPageUrl(r.data.page_url); }
    }
    async function add(i: number) {
        const idea = ideas[i];
        const r = await postAi('/api/ideas', { title: idea.title, hypothesis: idea.hypothesis, page_url: pageUrl || undefined, priority: idea.priority });
        if (!r.ok) { setError(r.error); return; }
        setIdeas((l) => l.map((x, j) => (j === i ? { ...x, added: true } : x)));
    }

    return (
        <Card data-testid="ai-results">
            <CardHeader title="AI summary" description="Your AI provider explains the result in plain words. The verdict above comes from the statistics and is never changed." actions={
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => run('summary')}>{busy === 'summary' ? 'Writing...' : summary ? 'Explain again' : 'Explain these results'}</Button>
                    {completed && <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => run('followups')}>{busy === 'followups' ? 'Thinking...' : 'Suggest follow-up tests'}</Button>}
                </div>
            } />
            {(error || summary || ideas.length > 0) && (
                <CardBody className="space-y-4">
                    {error && <Alert tone="danger">{error}</Alert>}
                    {summary && (
                        <div className="space-y-2 text-sm text-zinc-800">
                            <p className="font-medium">{summary.verdict.title}</p>
                            <p>{summary.summary}</p>
                            {summary.next_steps.length > 0 && <ul className="list-disc space-y-1 pl-5">{summary.next_steps.map((s, i) => <li key={i}>{s}</li>)}</ul>}
                        </div>
                    )}
                    {ideas.length > 0 && (
                        <ul className="space-y-3">
                            {ideas.map((idea, i) => (
                                <li key={i} className="rounded-lg border border-zinc-200 p-3">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <p className="font-medium text-zinc-900">{idea.title} <Badge className="ml-1">{idea.priority}</Badge></p>
                                        <Button size="sm" variant="secondary" disabled={idea.added} onClick={() => add(i)}>{idea.added ? 'Added' : 'Add to planner'}</Button>
                                    </div>
                                    <p className="mt-1 text-sm text-zinc-700">{idea.hypothesis}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardBody>
            )}
        </Card>
    );
}
