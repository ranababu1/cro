'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardHeader, CardBody, Button, Input, Alert, Badge } from '@/app/components/ui';
import { UpgradeNote } from '@/app/components/UpgradeNote';
import { MAX_FUNNEL_STEPS, MIN_FUNNEL_STEPS, type FunnelVariation, type FunnelTrend as Trend, type TrendBucket } from '@/lib/funnels';
import { FunnelTrend } from './FunnelTrend';

type Funnel = { id: string; name: string; steps: { id: string; name: string }[]; removed_steps: number; variations: FunnelVariation[]; trend?: Trend | null };
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const selectClass = 'h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

/** Funnels built from the test's goals: how many visitors reach each step, in order, per variation. Paid only. */
export function FunnelsPanel({ experimentId, goals }: { experimentId: string; goals: { goal_id: string; goal_name: string }[] }) {
    const [state, setState] = useState<{ allowed: boolean | null; funnels: Funnel[]; max: number }>({ allowed: null, funnels: [], max: 10 });
    const [name, setName] = useState('');
    const [steps, setSteps] = useState<string[]>([]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    // Trend period: automatic (days, or weeks past 60 days of data) until the user picks one.
    const [bucket, setBucket] = useState<TrendBucket | ''>('');
    const url = `/api/experiments/${experimentId}/funnels${bucket ? `?trend=${bucket}` : ''}`;

    const load = useCallback(async () => {
        const res = await fetch(url);
        if (res.status === 403) return setState({ allowed: false, funnels: [], max: 10 });
        const d = await res.json().catch(() => ({}));
        setState({ allowed: res.ok, funnels: d.funnels ?? [], max: d.max ?? 10 });
    }, [url]);
    useEffect(() => {
        let live = true;
        fetch(url).then(async (res) => {
            if (!live) return;
            if (res.status === 403) return setState({ allowed: false, funnels: [], max: 10 });
            const d = await res.json().catch(() => ({}));
            setState({ allowed: res.ok, funnels: d.funnels ?? [], max: d.max ?? 10 });
        }).catch(() => undefined);
        return () => { live = false; };
    }, [url]);

    async function create() {
        setBusy(true); setError('');
        const res = await fetch(`/api/experiments/${experimentId}/funnels`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, steps }) });
        setBusy(false);
        if (!res.ok) { setError(String((await res.json().catch(() => ({}))).error || 'Could not save the funnel')); return; }
        setName(''); setSteps([]);
        void load();
    }
    async function remove(id: string) {
        if (!window.confirm('Remove this funnel? Your goals and their numbers stay.')) return;
        await fetch(`/api/experiments/${experimentId}/funnels?funnel=${encodeURIComponent(id)}`, { method: 'DELETE' });
        void load();
    }

    if (state.allowed === null) return null;
    if (!state.allowed) return <UpgradeNote>Funnels are part of the paid plans. Upgrade to Starter or above to see how visitors move through your goals, step by step.</UpgradeNote>;

    const unused = goals.filter((g) => !steps.includes(g.goal_id));
    return (
        <div className="space-y-6" data-testid="funnels">
            <h2 className="pt-2 text-base font-semibold text-zinc-900">Funnels</h2>
            {state.funnels.map((f) => <FunnelCard key={f.id} funnel={f} onRemove={() => void remove(f.id)} onBucket={setBucket} />)}
            {goals.length < MIN_FUNNEL_STEPS ? (
                <p className="text-sm text-zinc-500">Add at least {MIN_FUNNEL_STEPS} goals to this test to build a funnel.</p>
            ) : state.funnels.length < state.max && (
                <Card>
                    <CardHeader title="New funnel" description={`Pick ${MIN_FUNNEL_STEPS} to ${MAX_FUNNEL_STEPS} goals in the order visitors complete them. A visitor counts for a step once they complete it after the step before.`} />
                    <CardBody className="space-y-3">
                        {error && <Alert tone="danger">{error}</Alert>}
                        <Input aria-label="Funnel name" placeholder="Signup funnel" value={name} onChange={(e) => setName(e.target.value)} />
                        <ol className="space-y-2">
                            {steps.map((id, i) => (
                                <li key={id} className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                                    <span className="w-6 text-zinc-500">{i + 1}.</span>
                                    <span className="flex-1 font-medium text-zinc-900">{goals.find((g) => g.goal_id === id)?.goal_name}</span>
                                    <Button variant="ghost" size="sm" onClick={() => setSteps(steps.filter((x) => x !== id))}>Remove</Button>
                                </li>
                            ))}
                        </ol>
                        {unused.length > 0 && steps.length < MAX_FUNNEL_STEPS && (
                            <select aria-label="Add a step" className={selectClass} value="" onChange={(e) => e.target.value && setSteps([...steps, e.target.value])}>
                                <option value="">Add step {steps.length + 1}...</option>
                                {unused.map((g) => <option key={g.goal_id} value={g.goal_id}>{g.goal_name}</option>)}
                            </select>
                        )}
                        <div className="flex justify-end">
                            <Button disabled={busy || !name.trim() || steps.length < MIN_FUNNEL_STEPS} onClick={() => void create()}>Save funnel</Button>
                        </div>
                    </CardBody>
                </Card>
            )}
        </div>
    );
}

function FunnelCard({ funnel, onRemove, onBucket }: { funnel: Funnel; onRemove: () => void; onBucket: (b: TrendBucket) => void }) {
    const control = funnel.variations.find((v) => v.is_control);
    return (
        <Card>
            <CardHeader
                title={funnel.name}
                description={funnel.steps.map((s) => s.name).join(' then ')}
                actions={<Button variant="ghost" size="sm" onClick={onRemove}>Remove</Button>}
            />
            <CardBody className="space-y-5">
                {funnel.removed_steps > 0 && <p className="text-sm text-amber-800">{funnel.removed_steps === 1 ? 'One step was' : `${funnel.removed_steps} steps were`} removed because the goal no longer exists.</p>}
                {funnel.variations.length === 0 ? <p className="text-sm text-zinc-500">This funnel needs at least 2 goals that still exist.</p> : funnel.variations.map((v) => (
                    <div key={v.variation_id}>
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-medium text-zinc-900">{v.name}</span>
                            {v.is_control && <Badge>Control</Badge>}
                            <span className="text-zinc-500">{v.visitors.toLocaleString()} visitors, {pct(v.completion)} completed every step</span>
                            {!v.is_control && control && control.completion > 0 && (
                                <span className={v.completion >= control.completion ? 'text-emerald-700' : 'text-red-700'}>
                                    {`${v.completion >= control.completion ? '+' : ''}${(((v.completion - control.completion) / control.completion) * 100).toFixed(1)}% vs control`}
                                </span>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            {v.steps.map((s, i) => (
                                <div key={s.goal_id} className="grid grid-cols-[8rem_1fr_11rem] items-center gap-3 text-sm sm:grid-cols-[13rem_1fr_16rem]">
                                    <span className="truncate text-zinc-700">{i + 1}. {s.name}</span>
                                    <span className="h-5 overflow-hidden rounded bg-zinc-100" aria-hidden>
                                        <span className="block h-full rounded bg-gradient-to-r from-blue-600 to-teal-500" style={{ width: `${Math.max(s.of_visitors * 100, s.users > 0 ? 1 : 0)}%` }} />
                                    </span>
                                    <span className="text-right tabular-nums text-zinc-700">
                                        {s.users.toLocaleString()} <span className="text-zinc-500">({pct(s.of_visitors)}{i > 0 ? `, ${pct(s.of_previous)} of step ${i}` : ''})</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                {funnel.trend && funnel.variations.length > 0 && <FunnelTrend trend={funnel.trend} onBucket={onBucket} />}
            </CardBody>
        </Card>
    );
}
