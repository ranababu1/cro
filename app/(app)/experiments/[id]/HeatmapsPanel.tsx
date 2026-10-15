'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardBody, CardHeader, Spinner, Select } from '@/app/components/ui';
import { UpgradeNote } from '@/app/components/UpgradeNote';

type Report = {
    variation: { id: string; name: string; url: string | null };
    variations: { id: string; name: string; url: string | null; is_control: boolean }[];
    devices: Record<'desktop' | 'tablet' | 'mobile', { clicks: number; sessions: number }>;
    grid: { gx: number; gy: number; clicks: number }[];
    list: { selector: string; clicks: number; rage: number; dead: number }[];
    scroll: { depth: number; reach: number }[];
    confetti: { x: number; y: number; rage: boolean; dead: boolean }[];
    totals: { clicks: number; rage: number; dead: number; sessions: number };
    cols: number; rowPx: number;
};
type View = 'click' | 'scroll' | 'confetti' | 'overlay' | 'list';
type DeviceOpt = 'all' | 'desktop' | 'tablet' | 'mobile';
const WIDTH: Record<DeviceOpt, number> = { all: 1280, desktop: 1280, tablet: 820, mobile: 390 };
const VIEWS: { id: View; label: string }[] = [
    { id: 'click', label: 'Click map' }, { id: 'scroll', label: 'Scroll map' }, { id: 'confetti', label: 'Confetti' }, { id: 'overlay', label: 'Overlay' }, { id: 'list', label: 'Element list' },
];

function heatColor(t: number): string {
    // teal to amber to red
    const h = 180 - 180 * Math.min(1, t);
    return `hsla(${h}, 85%, 50%, ${0.15 + 0.7 * Math.min(1, t)})`;
}

/** Heatmaps tab. Free plans see an upgrade note; the server enforces the same rule. */
export function HeatmapsPanel({ experimentId }: { experimentId: string }) {
    const [allowed, setAllowed] = useState<boolean | null>(null);
    const [variation, setVariation] = useState('');
    const [device, setDevice] = useState<DeviceOpt>('all');
    const [view, setView] = useState<View>('click');
    const [data, setData] = useState<Report | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let live = true;
        fetch('/api/plan').then((r) => r.json()).then((p) => { if (live) setAllowed(!!p.features?.heatmaps); }).catch(() => live && setAllowed(false));
        return () => { live = false; };
    }, []);

    useEffect(() => {
        if (!allowed) return;
        let live = true;
        const q = new URLSearchParams({ device });
        if (variation) q.set('variation', variation);
        fetch(`/api/experiments/${experimentId}/heatmaps?${q}`)
            .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Could not load heatmaps'); return j as Report; })
            .then((j) => { if (live) { setData(j); setError(''); } })
            .catch((e: Error) => live && setError(e.message));
        return () => { live = false; };
    }, [allowed, experimentId, variation, device]);

    return (
        <Card>
            <CardHeader title="Heatmaps" description="Where visitors click and how far they scroll, for each version. Collected automatically from a sample of visitors." />
            <CardBody>
                {allowed === null && <Spinner />}
                {allowed === false && <UpgradeNote>Heatmaps are part of the paid plans. Upgrade to Starter or above to see them for this test.</UpgradeNote>}
                {allowed && error && <p className="text-sm text-red-600">{error}</p>}
                {allowed && !data && !error && <Spinner />}
                {allowed && data && (
                    <div data-testid="heatmaps">
                        <div className="mb-4 flex flex-wrap items-center gap-3">
                            <Select aria-label="Variation" value={data.variation.id} onChange={(e) => setVariation(e.target.value)} className="w-auto">
                                {data.variations.map((v) => <option key={v.id} value={v.id}>{v.name}{v.is_control ? ' (control)' : ''}</option>)}
                            </Select>
                            <div className="inline-flex rounded-md border border-zinc-200 p-0.5" role="tablist" aria-label="Device">
                                {(['all', 'desktop', 'tablet', 'mobile'] as DeviceOpt[]).map((d) => (
                                    <button key={d} type="button" onClick={() => setDevice(d)} className={`rounded px-2.5 py-1 text-xs font-medium capitalize ${device === d ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}>
                                        {d === 'all' ? 'All devices' : `${d} (${data.devices[d].clicks})`}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
                            {[['Clicks', data.totals.clicks], ['Rage clicks', data.totals.rage], ['Dead clicks', data.totals.dead], ['Sessions with scroll data', data.totals.sessions]].map(([k, v]) => (
                                <div key={k} className="rounded-lg border border-zinc-200 px-3 py-2"><div className="text-zinc-500">{k}</div><div className="text-lg font-semibold text-zinc-900">{v}</div></div>
                            ))}
                        </div>
                        <div className="mb-4 flex flex-wrap gap-2">
                            {VIEWS.map((v) => (
                                <button key={v.id} type="button" onClick={() => setView(v.id)} className={`rounded-md px-3 py-1.5 text-sm ${view === v.id ? 'bg-blue-50 font-medium text-blue-700' : 'text-zinc-600 hover:bg-zinc-100'}`}>{v.label}</button>
                            ))}
                        </div>
                        {data.totals.clicks === 0 && data.totals.sessions === 0
                            ? <p className="text-sm text-zinc-500">No heatmap data yet for this version and device. Data appears a few seconds after sampled visitors leave the page.</p>
                            : <HeatView data={data} view={view} width={WIDTH[device]} />}
                    </div>
                )}
            </CardBody>
        </Card>
    );
}

function HeatView({ data, view, width }: { data: Report; view: View; width: number }) {
    const max = useMemo(() => Math.max(1, ...data.grid.map((g) => g.clicks)), [data.grid]);
    const rows = Math.min(200, Math.max(24, ...data.grid.map((g) => g.gy + 1), ...data.confetti.map((p) => Math.floor(p.y / data.rowPx) + 1)));
    const height = rows * data.rowPx;
    const scale = Math.min(1, 760 / width);
    const cellW = width / data.cols;

    if (view === 'list') {
        return (
            <table className="w-full text-sm" data-testid="heat-list">
                <thead><tr className="text-left text-zinc-500"><th className="py-2">Element</th><th className="text-right">Clicks</th><th className="text-right">Rage</th><th className="text-right">Dead</th></tr></thead>
                <tbody>{data.list.map((r) => (
                    <tr key={r.selector} className="border-t border-zinc-100"><td className="py-1.5 font-mono text-xs text-zinc-800">{r.selector}</td><td className="text-right">{r.clicks}</td><td className="text-right">{r.rage}</td><td className="text-right">{r.dead}</td></tr>
                ))}</tbody>
            </table>
        );
    }
    if (view === 'scroll') {
        return (
            <div className="space-y-1.5" data-testid="heat-scroll">
                {data.scroll.map((s) => (
                    <div key={s.depth} className="flex items-center gap-3 text-sm">
                        <span className="w-24 text-zinc-500">{s.depth}% down</span>
                        <div className="h-4 flex-1 rounded bg-zinc-100"><div className="h-4 rounded bg-gradient-to-r from-teal-500 to-blue-600" style={{ width: `${s.reach}%` }} /></div>
                        <span className="w-14 text-right text-zinc-800">{s.reach}%</span>
                    </div>
                ))}
                <p className="pt-2 text-xs text-zinc-500">Share of sessions that scrolled at least this far.</p>
            </div>
        );
    }
    const layer = (
        <div className="absolute inset-0">
            {view === 'confetti'
                ? data.confetti.map((p, i) => (
                    <span key={i} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${p.x / 10}%`, top: p.y, background: p.rage ? '#dc2626' : p.dead ? '#71717a' : '#2563eb', opacity: 0.75 }} />
                ))
                : data.grid.map((g) => (
                    <span key={`${g.gx}-${g.gy}`} className="absolute rounded-sm" style={{ left: g.gx * cellW, top: g.gy * data.rowPx, width: cellW, height: data.rowPx, background: heatColor(g.clicks / max) }} title={`${g.clicks} clicks`} />
                ))}
        </div>
    );
    const url = data.variation.url;
    return (
        <div>
            <div className="overflow-auto rounded-lg border border-zinc-200 bg-zinc-50" style={{ maxHeight: 640 }}>
                <div style={{ width: width * scale, height: height * scale }}>
                    <div className="relative origin-top-left" style={{ width, height, transform: `scale(${scale})` }} data-testid={`heat-${view}`}>
                        {view === 'overlay' && url
                            ? <iframe src={url} title="Page preview" className="pointer-events-none absolute inset-0 h-full w-full bg-white" sandbox="" loading="lazy" />
                            : <div className="absolute inset-0 bg-[linear-gradient(var(--color-zinc-200)_1px,transparent_1px)] bg-[size:100%_100px]" />}
                        {layer}
                    </div>
                </div>
            </div>
            {view === 'overlay' && <p className="mt-2 text-xs text-zinc-500">The page is shown in a sandboxed preview. If it stays blank, the site does not allow being shown in a frame; use the click map instead.</p>}
            {view === 'confetti' && <p className="mt-2 text-xs text-zinc-500">Each dot is a click from the last 30 days. Red: rage click. Grey: dead click (on something that is not a link or button).</p>}
        </div>
    );
}
