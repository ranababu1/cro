'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader, Card, CardHeader, CardBody, Button, Input, Textarea, Select, Field, Alert, Badge, EmptyState } from '@/app/components/ui';
import { planEstimate, estimateText, IDEA_STATUSES, type IdeaJson } from '@/lib/planner';

type Status = (typeof IDEA_STATUSES)[number];
const COLUMNS: Record<Status, { title: string; hint: string }> = {
    idea: { title: 'Ideas', hint: 'Worth a look' },
    planned: { title: 'Planned', hint: 'Next up' },
    started: { title: 'Started', hint: 'A test was created' },
    dropped: { title: 'Dropped', hint: 'Not worth testing' },
};
const PRIORITY_TONE = { high: 'danger', medium: 'warning', low: 'neutral' } as const;

interface Draft {
    id: string | null; title: string; hypothesis: string; page_url: string; baseline_rate: string; expected_lift: string;
    daily_visitors: string; variations: string; priority: 'low' | 'medium' | 'high';
}
const BLANK: Draft = { id: null, title: '', hypothesis: '', page_url: '', baseline_rate: '', expected_lift: '10', daily_visitors: '', variations: '2', priority: 'medium' };
const toNum = (v: string) => (v.trim() === '' ? null : Number(v));

/** Test planner: ideas, hypotheses and duration estimates, on every plan. */
export default function PlannerPage() {
    const [state, setState] = useState<{ status: 'loading' | 'ok' | 'error'; ideas?: IdeaJson[]; max?: number }>({ status: 'loading' });
    const [editing, setEditing] = useState<Draft | null>(null);
    const [tick, setTick] = useState(0);
    const reload = useCallback(() => setTick((t) => t + 1), []);

    useEffect(() => {
        let live = true;
        fetch('/api/ideas').then(async (res) => {
            if (!live) return;
            if (!res.ok) return setState({ status: 'error' });
            const j = await res.json();
            setState({ status: 'ok', ideas: j.ideas, max: j.max });
        }).catch(() => live && setState({ status: 'error' }));
        return () => { live = false; };
    }, [tick]);

    const patch = async (id: string, body: object) => {
        await fetch(`/api/ideas/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        reload();
    };
    const remove = async (i: IdeaJson) => {
        if (!window.confirm(`Delete "${i.title}"?`)) return;
        await fetch(`/api/ideas/${i.id}`, { method: 'DELETE' });
        reload();
    };
    const edit = (i: IdeaJson) => setEditing({
        id: i.id, title: i.title, hypothesis: i.hypothesis, page_url: i.page_url ?? '', baseline_rate: i.baseline_rate?.toString() ?? '',
        expected_lift: i.expected_lift?.toString() ?? '', daily_visitors: i.daily_visitors?.toString() ?? '', variations: String(i.variations), priority: i.priority,
    });

    const ideas = state.ideas ?? [];
    const order = { high: 0, medium: 1, low: 2 };
    return (
        <div className="space-y-6">
            <PageHeader
                title="Test planner"
                description="Collect test ideas with a hypothesis, see how long each would take to run, and turn the best ones into tests."
                actions={state.status === 'ok' && !editing ? <Button onClick={() => setEditing({ ...BLANK })} disabled={ideas.length >= (state.max ?? 0)}>New idea</Button> : undefined}
            />
            {state.status === 'error' && <p className="text-sm text-red-600">Could not load the test planner. Try again in a moment.</p>}
            {editing && <Editor initial={editing} onDone={() => { setEditing(null); reload(); }} />}
            {state.status === 'ok' && !editing && (ideas.length === 0 ? (
                <Card><EmptyState title="No ideas yet" description="Write down what you want to change, why you think it helps, and the lift you hope for. The planner tells you how long the test needs." /></Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="planner-board">
                    {IDEA_STATUSES.map((st) => {
                        const col = ideas.filter((i) => i.status === st).sort((a, b) => order[a.priority] - order[b.priority]);
                        return (
                            <section key={st} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3" aria-label={COLUMNS[st].title}>
                                <h2 className="text-sm font-semibold text-zinc-900">{COLUMNS[st].title} <span className="font-normal text-zinc-500">({col.length})</span></h2>
                                <p className="mb-3 text-xs text-zinc-500">{COLUMNS[st].hint}</p>
                                <div className="space-y-3">
                                    {col.map((i) => (
                                        <article key={i.id} className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm" data-testid="idea-card">
                                            <div className="mb-1 flex items-start justify-between gap-2">
                                                <h3 className="break-words text-sm font-medium text-zinc-900">{i.title}</h3>
                                                <Badge tone={PRIORITY_TONE[i.priority]}>{i.priority}</Badge>
                                            </div>
                                            {i.hypothesis && <p className="mb-2 line-clamp-3 whitespace-pre-line text-sm text-zinc-600">{i.hypothesis}</p>}
                                            <p className="mb-3 text-xs text-zinc-500" data-testid="idea-estimate">{estimateText(i.estimate)}</p>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Select aria-label="Column" value={i.status} onChange={(e) => patch(i.id, { status: e.target.value })} className="h-8 w-auto text-xs">
                                                    {IDEA_STATUSES.map((s) => <option key={s} value={s}>{COLUMNS[s].title}</option>)}
                                                </Select>
                                                {i.experiment_id
                                                    ? <Link href={`/experiments/${i.experiment_id}`} className="text-sm font-medium text-blue-600 hover:underline">Open test</Link>
                                                    : <Link href={`/experiments/new?idea=${i.id}`} className="text-sm font-medium text-blue-600 hover:underline">Create test</Link>}
                                                <Button size="sm" variant="ghost" onClick={() => edit(i)}>Edit</Button>
                                                <Button size="sm" variant="ghost" onClick={() => remove(i)}>Delete</Button>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

function Editor({ initial, onDone }: { initial: Draft; onDone: () => void }) {
    const [d, setD] = useState<Draft>(initial);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
    const estimate = useMemo(() => planEstimate({ baseline_rate: toNum(d.baseline_rate), expected_lift: toNum(d.expected_lift), daily_visitors: toNum(d.daily_visitors), variations: Number(d.variations) || 2 }), [d]);

    const save = async () => {
        setSaving(true); setError('');
        const body = {
            title: d.title, hypothesis: d.hypothesis, page_url: d.page_url.trim() || null, baseline_rate: toNum(d.baseline_rate), expected_lift: toNum(d.expected_lift),
            daily_visitors: toNum(d.daily_visitors), variations: Number(d.variations) || 2, priority: d.priority,
        };
        const res = await fetch(d.id ? `/api/ideas/${d.id}` : '/api/ideas', { method: d.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
        setSaving(false);
        if (!res || !res.ok) return setError((await res?.json().catch(() => null))?.error ?? 'Could not save the idea.');
        onDone();
    };

    return (
        <Card>
            <CardHeader title={d.id ? 'Edit idea' : 'New idea'} description="Only the title is required. Fill in the numbers to see how long the test would run." />
            <CardBody className="space-y-4">
                <Field label="Title">{(id) => <Input id={id} value={d.title} maxLength={120} onChange={(e) => set('title', e.target.value)} placeholder="Shorter signup form" />}</Field>
                <Field label="Hypothesis" hint="If we change this, then that will happen, because of this reason.">{(id) => <Textarea id={id} rows={3} maxLength={2000} value={d.hypothesis} onChange={(e) => set('hypothesis', e.target.value)} placeholder="If we remove the phone field, more visitors will finish signing up, because fewer people drop off at that step." />}</Field>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Page" hint="Optional. Used as the control page when you create the test.">{(id) => <Input id={id} value={d.page_url} maxLength={2000} onChange={(e) => set('page_url', e.target.value)} placeholder="https://example.com/signup" />}</Field>
                    <Field label="Priority">{(id) => <Select id={id} value={d.priority} onChange={(e) => set('priority', e.target.value as Draft['priority'])}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></Select>}</Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-4">
                    <Field label="Conversion rate now (%)">{(id) => <Input id={id} type="number" min={0.01} max={99.99} step="any" value={d.baseline_rate} onChange={(e) => set('baseline_rate', e.target.value)} placeholder="3" />}</Field>
                    <Field label="Lift to detect (%)" hint="Relative, so 10 means 3% becomes 3.3%.">{(id) => <Input id={id} type="number" min={1} max={1000} step="any" value={d.expected_lift} onChange={(e) => set('expected_lift', e.target.value)} />}</Field>
                    <Field label="Visitors per day" hint="Who would enter the test.">{(id) => <Input id={id} type="number" min={1} value={d.daily_visitors} onChange={(e) => set('daily_visitors', e.target.value)} placeholder="1000" />}</Field>
                    <Field label="Versions" hint="Including the control.">{(id) => <Input id={id} type="number" min={2} max={51} value={d.variations} onChange={(e) => set('variations', e.target.value)} />}</Field>
                </div>
                <Alert tone="info"><span data-testid="editor-estimate">{estimateText(estimate)}</span></Alert>
                <p className="text-xs text-zinc-500">95% confidence and 80% power. With more than two versions, the 5% is split across the comparisons with the control, as in the results. Small lifts need far more visitors.</p>
                {error && <Alert tone="danger">{error}</Alert>}
                <div className="flex gap-2">
                    <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save idea'}</Button>
                    <Button variant="secondary" onClick={onDone}>Cancel</Button>
                </div>
            </CardBody>
        </Card>
    );
}
