'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardBody, Button, Input, Alert, Badge } from '@/app/components/ui';
import { MAX_ALT_LEVELS, MAX_COMBINATIONS, MAX_FACTORS, MIN_FACTORS, parseMvt } from '@/lib/mvt';
import type { Variation } from '@/lib/types';

const selectClass = 'h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

/**
 * Multivariate tests (Growth+). On a draft, each visual variation becomes a version of one factor, and the test
 * runs every combination. Undo puts the variations back.
 */
export function MvtCard({ experimentId, status, mvt, variations, onSaved }: { experimentId: string; status: string; mvt: string | null; variations: Variation[]; onSaved: () => void }) {
    const config = parseMvt(mvt);
    const visual = variations.filter((v) => !v.is_control && !v.url && !v.combo && !!v.changes);
    const [factorOf, setFactorOf] = useState<Record<string, number>>(() => Object.fromEntries(visual.map((v, i) => [v.id, Math.min(i, MAX_FACTORS - 1)])));
    const [names, setNames] = useState<string[]>(['Factor 1', 'Factor 2', 'Factor 3']);
    const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [allowed, setAllowed] = useState(false);
    useEffect(() => {
        let live = true;
        fetch(`/api/experiments/${experimentId}/mvt`).then(async (res) => { if (live && res.ok) setAllowed(!!(await res.json()).allowed); }).catch(() => undefined);
        return () => { live = false; };
    }, [experimentId]);

    async function call(method: 'POST' | 'DELETE', body?: unknown) {
        setBusy(true); setMsg(null);
        const res = await fetch(`/api/experiments/${experimentId}/mvt`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
        const data = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) return setMsg({ tone: 'danger', text: String(data.error || 'Could not save') });
        onSaved();
    }

    if (config) {
        const combos = variations.filter((v) => v.combo).length;
        return (
            <Card data-testid="mvt">
                <CardHeader
                    title={<span className="flex items-center gap-2">Multivariate test <Badge tone="success">{combos} combinations</Badge></span>}
                    description="Every combination of the factors below is a version of this test, split evenly. Results show each combination and the effect of each factor."
                    actions={status === 'draft' ? <Button variant="secondary" size="sm" disabled={busy} onClick={() => { if (window.confirm('Undo the combinations? The levels go back to being separate variations.')) void call('DELETE'); }}>Undo combinations</Button> : undefined}
                />
                <CardBody className="space-y-2 text-sm">
                    {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
                    {config.factors.map((f) => (
                        <p key={f.name}><span className="font-medium text-zinc-900">{f.name}:</span> <span className="text-zinc-600">{f.levels.map((l) => l.name).join(', ')}</span></p>
                    ))}
                    {status === 'draft' && <p className="text-xs text-zinc-500">To change a level, undo the combinations, edit that variation, then build them again.</p>}
                </CardBody>
            </Card>
        );
    }
    if (status !== 'draft' || visual.length < MIN_FACTORS) return null;
    if (!allowed) return null;

    const groups = Array.from({ length: MAX_FACTORS }, (_, fi) => visual.filter((v) => factorOf[v.id] === fi));
    const used = groups.map((g, fi) => ({ fi, g })).filter((x) => x.g.length > 0);
    const combos = used.reduce((n, x) => n * (x.g.length + 1), 1);
    const problem = used.length < MIN_FACTORS ? `Put variations in at least ${MIN_FACTORS} factors`
        : used.some((x) => x.g.length > MAX_ALT_LEVELS) ? `A factor can have up to ${MAX_ALT_LEVELS} versions besides the original`
        : combos > MAX_COMBINATIONS ? `That makes ${combos} combinations. Keep it at ${MAX_COMBINATIONS} or fewer` : '';

    return (
        <Card data-testid="mvt">
            <CardHeader title="Make it multivariate" description="Test two or three changes at once. Put each visual variation in a factor (one factor per element you change). The test then runs every combination, so you see which mix works best and what each change adds on its own." />
            <CardBody className="space-y-3">
                {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
                <div className="grid gap-2 sm:grid-cols-3">
                    {names.map((n, fi) => <Input key={fi} aria-label={`Name of factor ${fi + 1}`} value={n} onChange={(e) => setNames(names.map((x, j) => (j === fi ? e.target.value : x)))} />)}
                </div>
                {visual.map((v) => (
                    <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 p-3" data-testid="mvt-variation">
                        <span className="text-sm font-medium text-zinc-900">{v.name}</span>
                        <select aria-label={`Factor for ${v.name}`} className={selectClass} value={factorOf[v.id] ?? -1} onChange={(e) => setFactorOf({ ...factorOf, [v.id]: Number(e.target.value) })}>
                            {names.map((n, fi) => <option key={fi} value={fi}>{n || `Factor ${fi + 1}`}</option>)}
                            <option value={-1}>Not used</option>
                        </select>
                    </div>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={`text-sm ${problem ? 'text-red-600' : 'text-zinc-600'}`}>{problem || `${combos} combinations, about ${Math.floor(100 / combos)}% of visitors each. Every combination needs enough visitors, so plan for more traffic than a simple A/B test.`}</p>
                    <Button size="sm" disabled={busy || !!problem || used.some((x) => !names[x.fi].trim())} onClick={() => void call('POST', { factors: used.map((x) => ({ name: names[x.fi].trim(), variation_ids: x.g.map((v) => v.id) })) })}>Build combinations</Button>
                </div>
                <p className="text-xs text-zinc-500">Only variations with visual changes are listed. The control stays the original page.</p>
            </CardBody>
        </Card>
    );
}
