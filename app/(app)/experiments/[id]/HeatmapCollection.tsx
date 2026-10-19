'use client';

import { useEffect, useState } from 'react';
import { Button, Field, Input } from '@/app/components/ui';

export type Collection = {
    sample_percent: number; custom_sample: boolean; default_percent: number;
    stop_days: number | null; stop_views: number | null;
    views: number; since: string; ends_at: string | null;
    collecting: boolean; stopped_by: 'days' | 'views' | null;
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const num = (n: number) => n.toLocaleString();

export function collectionSummary(c: Collection): string {
    const rules = [c.stop_days ? `${c.stop_days} days` : '', c.stop_views ? `${num(c.stop_views)} page views` : ''].filter(Boolean).join(' or ');
    if (!c.collecting) {
        return `Collection stopped after ${c.stopped_by === 'views' ? `${num(c.stop_views ?? 0)} page views` : `${c.stop_days} days`}. The data below is kept.`;
    }
    return `Collecting from ${c.sample_percent}% of visitors. ${num(c.views)} page views captured since ${fmtDate(c.since)}.${rules ? ` Stops after ${rules}.` : ' No stop rule.'}`;
}

/** Sample rate and stop rules for a test's or a page's heatmap (paid plans; the server enforces the same rule). */
export function HeatmapCollection({ url, page = false }: { url: string; page?: boolean }) {
    const [c, setC] = useState<Collection | null>(null);
    const [open, setOpen] = useState(false);
    const [sample, setSample] = useState('');
    const [days, setDays] = useState('');
    const [views, setViews] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const fill = (j: Collection) => {
        setC(j);
        setSample(j.custom_sample ? String(j.sample_percent) : '');
        setDays(j.stop_days ? String(j.stop_days) : '');
        setViews(j.stop_views ? String(j.stop_views) : '');
    };
    useEffect(() => {
        let live = true;
        fetch(url).then(async (r) => (r.ok ? r.json() : null)).then((j) => { if (live && j) fill(j); }).catch(() => {});
        return () => { live = false; };
    }, [url]);

    const send = async (body: Record<string, unknown>) => {
        setBusy(true); setError('');
        try {
            const r = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || 'Could not save');
            fill(j); setOpen(false);
        } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };
    const save = () => {
        const n = (v: string) => (v.trim() === '' ? null : Math.round(Number(v)));
        void send({ sample_percent: n(sample), stop_days: n(days), stop_views: n(views) });
    };

    if (!c) return null;
    return (
        <div className={`mb-4 rounded-md border px-3 py-2 text-sm ${c.collecting ? 'border-zinc-200 bg-zinc-50 text-zinc-700' : 'border-amber-200 bg-amber-50 text-amber-900'}`} data-testid="heat-collection">
            <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1">{collectionSummary(c)}</span>
                {!c.collecting && <Button size="sm" variant="secondary" disabled={busy} onClick={() => void send({ restart: true })}>Start a new collection period</Button>}
                <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Sampling and stop rules'}</Button>
            </div>
            {open && (
                <div className="mt-3 grid gap-3 sm:grid-cols-3" data-testid="heat-rules">
                    <Field label="Sample (% of visitors)" hint={`Empty uses the default of ${c.default_percent}%.`}>
                        {(id) => <Input id={id} type="number" min={1} max={100} value={sample} onChange={(e) => setSample(e.target.value)} placeholder="Default" />}
                    </Field>
                    <Field label="Stop after (days)" hint={`Counted from ${page ? 'when the heatmap was created' : 'the test start'} or the last new period. Empty means no limit.`}>
                        {(id) => <Input id={id} type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} placeholder="No limit" />}
                    </Field>
                    <Field label="Stop after (page views)" hint="Page views captured for this heatmap. At least 100.">
                        {(id) => <Input id={id} type="number" min={100} value={views} onChange={(e) => setViews(e.target.value)} placeholder="No limit" />}
                    </Field>
                    <div className="flex items-center gap-3 sm:col-span-3">
                        <Button size="sm" disabled={busy} onClick={save}>Save</Button>
                        {error && <p className="text-sm text-red-600">{error}</p>}
                    </div>
                </div>
            )}
        </div>
    );
}
