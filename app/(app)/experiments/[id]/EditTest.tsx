'use client';

import { useState } from 'react';
import { Card, CardHeader, CardBody, Button, Input, Alert, Badge } from '@/app/components/ui';
import { TargetingFields } from '@/app/components/TargetingFields';
import { GOAL_TYPES, GOAL_TYPE_LABELS, MAX_GOALS, checkGoalSelector, describeGoal, type GoalType, type PageMatchType } from '@/lib/goals';
import { parseTargeting, type Targeting } from '@/lib/targeting';
import { evenWeights, redistributeWeights } from '@/lib/weights';
import type { Variation } from '@/lib/types';
import { AutoShiftCard } from './AutoShiftCard';

const selectClass = 'h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';
const PLACEHOLDER: Record<GoalType, string> = { click: '#headerCTA', form: 'form#signup', page: 'https://www.example.com/thank-you', event: 'signup' };

async function send(url: string, method: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

/** Safe edits for a draft, running or paused test: split, pausing variations, audience and new goals. */
type GoalRow = { id: string; name: string; type?: string; selector: string; match_type?: string | null; is_primary: boolean };

export function EditTest({ experimentId, variations, goals = [], targeting, autoShift = false, onSaved }: { experimentId: string; variations: Variation[]; goals?: GoalRow[]; targeting: string | null; autoShift?: boolean; onSaved: () => void }) {
    const [rows, setRows] = useState(variations.map((v) => ({ id: v.id, name: v.name, is_control: v.is_control, weight: v.weight, paused: !!v.paused })));
    const [aud, setAud] = useState<Targeting>(parseTargeting(targeting));
    const [goal, setGoal] = useState({ name: '', type: 'click' as GoalType, selector: '', match_type: 'equals' as PageMatchType, is_primary: false });
    const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [list, setList] = useState<GoalRow[]>(goals);
    const selectorProblem = (goal.type === 'click' || goal.type === 'form') && goal.selector.trim() ? checkGoalSelector(goal.selector) : null;

    async function goalsCall(method: string, body: unknown, done: string, query = '') {
        return run(async () => {
            const res = await send(`/api/experiments/${experimentId}/goals${query}`, method, body);
            if (res.ok && Array.isArray(res.data.goals)) setList(res.data.goals as GoalRow[]);
            return res;
        }, done);
    }
    function move(i: number, dir: -1 | 1) {
        const j = i + dir;
        if (j < 0 || j >= list.length) return;
        const next = [...list];
        [next[i], next[j]] = [next[j], next[i]];
        setList(next);
        void goalsCall('PATCH', { order: next.map((g) => g.id) }, 'Goal order saved.');
    }

    const active = rows.map((r, i) => ({ r, i })).filter((x) => !x.r.paused);
    const total = active.reduce((a, x) => a + x.r.weight, 0);

    function setWeight(i: number, raw: string) {
        const idx = active.findIndex((x) => x.i === i);
        const next = redistributeWeights(active.map((x) => x.r.weight), idx, raw === '' ? 0 : Number(raw));
        setRows((rs) => rs.map((r, j) => { const k = active.findIndex((x) => x.i === j); return k >= 0 ? { ...r, weight: next[k] } : r; }));
    }

    function togglePause(i: number) {
        setRows((rs) => {
            const toggled = rs.map((r, j) => (j === i ? { ...r, paused: !r.paused } : r));
            const live = toggled.map((r, j) => ({ r, j })).filter((x) => !x.r.paused);
            const w = evenWeights(live.length);
            return toggled.map((r, j) => { const k = live.findIndex((x) => x.j === j); return k >= 0 ? { ...r, weight: w[k] } : { ...r, weight: 0 }; });
        });
    }

    async function run(fn: () => Promise<{ ok: boolean; data: Record<string, unknown> }>, done: string) {
        setBusy(true); setMsg(null);
        const { ok, data } = await fn();
        setBusy(false);
        if (!ok) { setMsg({ tone: 'danger', text: String(data.error || 'Could not save') }); return false; }
        setMsg({ tone: 'success', text: done });
        onSaved();
        return true;
    }

    return (
        <div className="space-y-6">
            {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
            <AutoShiftCard experimentId={experimentId} onSaved={onSaved} />
            <Card>
                <CardHeader title="Traffic split" description={autoShift ? 'Auto-shift sets these weights. You can still pause or resume a variation.' : 'Changes apply to new visitors. Everyone already in the test keeps their version.'} />
                <CardBody className="space-y-3">
                    {rows.map((r, i) => (
                        <div key={r.id} className="grid items-center gap-3 rounded-xl border border-zinc-200 p-3 sm:grid-cols-[1fr_6rem_auto]">
                            <span className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                                {r.name}{r.is_control && <Badge>Control</Badge>}{r.paused && <Badge tone="warning">Paused</Badge>}
                            </span>
                            <Input aria-label={`Weight for ${r.name}`} type="number" min={0} max={100} value={r.weight} disabled={r.paused || autoShift} onChange={(e) => setWeight(i, e.target.value)} />
                            {r.is_control ? <span className="w-24 text-xs text-zinc-500">Always on</span> : (
                                <Button variant="ghost" size="sm" className="w-24" onClick={() => togglePause(i)}>{r.paused ? 'Resume' : 'Pause'}</Button>
                            )}
                        </div>
                    ))}
                    <div className="flex items-center justify-between">
                        <p className={`text-sm ${total === 100 ? 'text-zinc-500' : 'text-red-600'}`}>Active weights total {total}. Paused variations get no new visitors.</p>
                        <Button disabled={busy || total !== 100} onClick={() => run(() => send(`/api/experiments/${experimentId}/variations`, 'PATCH', { variations: rows.map(({ id, weight, paused }) => ({ id, weight, paused })) }), 'Traffic split saved.')}>Save split</Button>
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardBody className="space-y-4">
                    <TargetingFields value={aud} onChange={setAud} />
                    <div className="flex justify-end">
                        <Button disabled={busy} onClick={() => run(() => send(`/api/experiments/${experimentId}`, 'PATCH', { targeting: aud }), 'Audience saved.')}>Save audience</Button>
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader title="Goals" description={`${list.length} of ${MAX_GOALS} goals. Each goal has its own numbers in results.`} />
                <CardBody className="space-y-2">
                    {list.map((g, i) => (
                        <div key={g.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 p-3" data-testid="goal-row">
                            <span className="w-6 text-sm text-zinc-500">{i + 1}.</span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium text-zinc-900">{g.name}{g.is_primary && <Badge className="ml-2">Primary</Badge>}</span>
                                <span className="block truncate font-mono text-xs text-zinc-500">{GOAL_TYPE_LABELS[(g.type || 'click') as GoalType]}: {describeGoal(g)}</span>
                            </span>
                            <Button variant="ghost" size="sm" aria-label={`Move ${g.name} up`} disabled={busy || i === 0} onClick={() => move(i, -1)}>↑</Button>
                            <Button variant="ghost" size="sm" aria-label={`Move ${g.name} down`} disabled={busy || i === list.length - 1} onClick={() => move(i, 1)}>↓</Button>
                            {!g.is_primary && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void goalsCall('PATCH', { primary: g.id }, 'Primary goal changed.')}>Make primary</Button>}
                            <Button variant="ghost" size="sm" disabled={busy || list.length <= 1} onClick={() => { if (window.confirm(`Remove the goal "${g.name}"? Its numbers stop showing in results.`)) void goalsCall('DELETE', {}, 'Goal removed.', `?goal=${encodeURIComponent(g.id)}`); }}>Remove</Button>
                        </div>
                    ))}
                </CardBody>
            </Card>

            <Card>
                <CardHeader title="Add a goal" description="One name and one CSS selector per goal. New goals count from the moment you add them." />
                <CardBody className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_9rem_auto_1.4fr]">
                        <Input aria-label="Goal name" placeholder="Pricing click" value={goal.name} onChange={(e) => setGoal({ ...goal, name: e.target.value })} />
                        <select aria-label="Goal type" className={selectClass} value={goal.type} onChange={(e) => setGoal({ ...goal, type: e.target.value as GoalType })}>
                            {GOAL_TYPES.map((t) => <option key={t} value={t}>{GOAL_TYPE_LABELS[t]}</option>)}
                        </select>
                        {goal.type === 'page' ? (
                            <select aria-label="URL match" className={selectClass} value={goal.match_type} onChange={(e) => setGoal({ ...goal, match_type: e.target.value as PageMatchType })}>
                                <option value="equals">URL is</option>
                                <option value="contains">URL contains</option>
                                <option value="regex">URL matches regex</option>
                            </select>
                        ) : <span className="hidden sm:block" />}
                        <Input aria-label="Goal target" placeholder={PLACEHOLDER[goal.type]} value={goal.selector} onChange={(e) => setGoal({ ...goal, selector: e.target.value })} />
                    </div>
                    {selectorProblem && <p className="text-sm text-red-600">{selectorProblem}</p>}
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={goal.is_primary} onChange={(e) => setGoal({ ...goal, is_primary: e.target.checked })} /> Make this the primary goal</label>
                        <Button disabled={busy || !goal.name.trim() || !goal.selector.trim() || !!selectorProblem || list.length >= MAX_GOALS} onClick={async () => {
                            if (await goalsCall('POST', goal, 'Goal added.')) setGoal({ ...goal, name: '', selector: '', is_primary: false });
                        }}>Add goal</Button>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
