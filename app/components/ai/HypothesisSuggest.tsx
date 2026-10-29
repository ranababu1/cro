'use client';

import { useState } from 'react';
import { Button, Alert } from '@/app/components/ui';
import { AiHint, postAi, useAiAvailability } from './AiClient';

type Suggestion = { hypothesis: string; expected_outcome: string };

/** New test wizard: hypotheses with an expected outcome, from the test name, page and goals. */
export function HypothesisSuggest({ name, pageUrl, goals, onPick }: { name: string; pageUrl: string; goals: string[]; onPick: (s: Suggestion) => void }) {
    const ai = useAiAvailability();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [list, setList] = useState<Suggestion[]>([]);
    if (!ai || !ai.configured) return null;
    if (!ai.ready) return <AiHint ai={ai} />;
    return (
        <div className="space-y-2" data-testid="ai-hypothesis">
            <Button size="sm" variant="secondary" disabled={busy || (!name.trim() && !pageUrl.trim())} onClick={async () => {
                setBusy(true); setError('');
                const r = await postAi<{ suggestions: Suggestion[] }>('/api/ai/hypothesis', { name, page_url: pageUrl, change: name, goals: goals.filter(Boolean) });
                setBusy(false);
                if (!r.ok) setError(r.error); else setList(r.data.suggestions);
            }}>{busy ? 'Thinking...' : 'Suggest a hypothesis'}</Button>
            {error && <Alert tone="danger">{error}</Alert>}
            {list.length > 0 && (
                <ul className="space-y-2">
                    {list.map((s, i) => (
                        <li key={i} className="rounded-lg border border-zinc-200 p-3 text-sm">
                            <p className="text-zinc-800">{s.hypothesis}</p>
                            {s.expected_outcome && <p className="mt-1 text-zinc-500">Expected: {s.expected_outcome}</p>}
                            <Button size="sm" variant="ghost" className="mt-1" onClick={() => { onPick(s); setList([]); }}>Use this</Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
