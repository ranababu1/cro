'use client';

import { useState } from 'react';
import { Alert, Button, Card, CardBody, CardHeader, Select } from '@/app/components/ui';
import type { Experiment, Variation } from '@/lib/types';

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/**
 * Roll out the winner: one click sends every visitor to the chosen version, with nothing counted, until the
 * change is in the site's code. Rolling out a running or paused test ends it.
 */
export function RolloutCard({ experiment, variations, winnerId, onChanged }: { experiment: Experiment; variations: Variation[]; winnerId?: string; onChanged: () => void }) {
    const fallback = winnerId || variations.find((v) => !v.is_control)?.id || variations[0]?.id || '';
    const [choice, setChoice] = useState(fallback);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const rolled = experiment.status === 'completed' ? variations.find((v) => v.id === experiment.rollout_variation_id) : undefined;
    const winner = variations.find((v) => v.id === winnerId);

    const call = async (method: 'POST' | 'DELETE', body?: unknown) => {
        setBusy(true);
        setError('');
        try {
            const res = await fetch(`/api/experiments/${experiment.id}/rollout`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Request failed');
            onChanged();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    if (rolled) {
        return (
            <Alert tone="success" title={`${rolled.name} is rolled out to every visitor`}>
                <span data-testid="rollout-on">
                    Since {fmt(experiment.rollout_at)}, everyone in the test&apos;s audience gets {rolled.is_control ? 'the control' : rolled.name}. Nothing is counted while the rollout is on. Put the change in your site&apos;s code, then stop the rollout.
                </span>
                <span className="mt-3 flex items-center gap-3">
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => confirm('Stop the rollout? Visitors will see your original page again.') && call('DELETE')}>Stop rollout</Button>
                    {error && <span className="text-sm text-red-700">{error}</span>}
                </span>
            </Alert>
        );
    }

    const chosen = variations.find((v) => v.id === choice);
    const ends = experiment.status !== 'completed';
    return (
        <Card data-testid="rollout">
            <CardHeader
                title="Roll out a version"
                description={winner ? `${winner.name} is the winner on the primary goal. Send it to every visitor until the change is in your code.` : 'No variation has a significant win yet. You can still send one version to every visitor, for example to keep the control.'}
            />
            <CardBody>
                <div className="flex flex-wrap items-center gap-3">
                    <Select aria-label="Version to roll out" value={choice} onChange={(e) => setChoice(e.target.value)} className="w-56">
                        {variations.map((v) => <option key={v.id} value={v.id}>{v.name}{v.is_control ? ' (control)' : ''}{v.id === winnerId ? ' (winner)' : ''}</option>)}
                    </Select>
                    <Button
                        disabled={busy || !chosen}
                        onClick={() => chosen && confirm(`Roll out ${chosen.name} to every visitor?${ends ? ' This stops the test, and a stopped test cannot be restarted.' : ''}`) && call('POST', { variation_id: chosen.id })}
                    >
                        Roll out to all visitors
                    </Button>
                </div>
                <p className="mt-2 text-xs text-zinc-500">{ends ? 'Rolling out stops the test and keeps its results. ' : ''}Visitors are not counted and no events are recorded during a rollout. Targeting still applies.</p>
                {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
            </CardBody>
        </Card>
    );
}
