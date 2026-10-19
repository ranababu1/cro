'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardBody, CardHeader, Spinner, Select } from '@/app/components/ui';
import { UpgradeNote } from '@/app/components/UpgradeNote';
import { HeatmapCollection } from './HeatmapCollection';

export type Report = {
    variation: { id: string; name: string; url: string | null };
    variations: { id: string; name: string; url: string | null; is_control: boolean }[];
    devices: Record<'desktop' | 'tablet' | 'mobile', { clicks: number; sessions: number }>;
    grid: { gx: number; gy: number; clicks: number }[];
    list: { selector: string; clicks: number; rage: number; dead: number }[];
    scroll: { depth: number; reach: number }[];
    confetti: { x: number; y: number; rage: boolean; dead: boolean }[];
    totals: { clicks: number; rage: number; dead: number; sessions: number };
    cols: number; rowPx: number;
    days?: number;
    filters?: { source?: string; converted?: 'yes' | 'no' };
    sources?: { source: string; clicks: number }[];
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
    // Side-by-side comparison: a second version on the same device.
    const [compare, setCompare] = useState(false);
    const [variationB, setVariationB] = useState('');
    const [dataB, setDataB] = useState<Report | null>(null);
    // Range and filters. Filters read individual clicks, which are kept for 30 days.
    const [days, setDays] = useState('30');
    const [source, setSource] = useState('');
    const [converted, setConverted] = useState('');
    const filterQuery = useMemo(() => {
        const q: Record<string, string> = { device, days };
        if (source) q.source = source;
        if (converted) q.converted = converted;
        return q;
    }, [device, days, source, converted]);
    const filtered = !!(source || converted);

    useEffect(() => {
        let live = true;
        fetch('/api/plan').then((r) => r.json()).then((p) => { if (live) setAllowed(!!p.features?.heatmaps); }).catch(() => live && setAllowed(false));
        return () => { live = false; };
    }, []);

    useEffect(() => {
        if (!allowed) return;
        let live = true;
        const q = new URLSearchParams(filterQuery);
        if (variation) q.set('variation', variation);
        fetch(`/api/experiments/${experimentId}/heatmaps?${q}`)
            .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Could not load heatmaps'); return j as Report; })
            .then((j) => { if (live) { setData(j); setError(''); } })
            .catch((e: Error) => live && setError(e.message));
        return () => { live = false; };
    }, [allowed, experimentId, variation, filterQuery]);

    const otherId = data ? (variationB && variationB !== data.variation.id ? variationB : data.variations.find((v) => v.id !== data.variation.id)?.id ?? '') : '';
    useEffect(() => {
        if (!allowed || !compare || !otherId) return;
        let live = true;
        fetch(`/api/experiments/${experimentId}/heatmaps?${new URLSearchParams({ ...filterQuery, variation: otherId })}`)
            .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Could not load heatmaps'); return j as Report; })
            .then((j) => { if (live) setDataB(j); })
            .catch((e: Error) => live && setError(e.message));
        return () => { live = false; };
    }, [allowed, compare, experimentId, otherId, filterQuery]);
    const b = compare && dataB && dataB.variation.id === otherId ? dataB : null;

    return (
        <Card>
            <CardHeader title="Heatmaps" description="Where visitors click and how far they scroll, for each version. Collected automatically from a sample of visitors." />
            <CardBody>
                {allowed === null && <Spinner />}
                {allowed === false && <UpgradeNote>Heatmaps are part of the paid plans. Upgrade to Starter or above to see them for this test.</UpgradeNote>}
                {allowed && <HeatmapCollection experimentId={experimentId} />}
                {allowed && error && <p className="text-sm text-red-600">{error}</p>}
                {allowed && !data && !error && <Spinner />}
                {allowed && data && (
                    <div data-testid="heatmaps">
                        <div className="mb-4 flex flex-wrap items-center gap-3">
                            <Select aria-label="Variation" value={data.variation.id} onChange={(e) => setVariation(e.target.value)} className="w-auto">
                                {data.variations.map((v) => <option key={v.id} value={v.id}>{v.name}{v.is_control ? ' (control)' : ''}</option>)}
                            </Select>
                            {data.variations.length > 1 && (
                                <label className="flex items-center gap-2 text-sm text-zinc-700">
                                    <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Compare with
                                </label>
                            )}
                            {compare && (
                                <Select aria-label="Compare with" value={otherId} onChange={(e) => setVariationB(e.target.value)} className="w-auto">
                                    {data.variations.filter((v) => v.id !== data.variation.id).map((v) => <option key={v.id} value={v.id}>{v.name}{v.is_control ? ' (control)' : ''}</option>)}
                                </Select>
                            )}
                            <div className="inline-flex rounded-md border border-zinc-200 p-0.5" role="tablist" aria-label="Device">
                                {(['all', 'desktop', 'tablet', 'mobile'] as DeviceOpt[]).map((d) => (
                                    <button key={d} type="button" onClick={() => setDevice(d)} className={`rounded px-2.5 py-1 text-xs font-medium capitalize ${device === d ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}>
                                        {d === 'all' ? 'All devices' : `${d} (${data.devices[d].clicks})`}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="mb-4 flex flex-wrap items-center gap-3" data-testid="heat-filters">
                            <div className="w-40">
                                <Select aria-label="Date range" value={days} onChange={(e) => setDays(e.target.value)}>
                                    <option value="7">Last 7 days</option>
                                    <option value="30">Last 30 days</option>
                                    <option value="90">Last 90 days</option>
                                </Select>
                            </div>
                            <div className="w-48">
                                <Select aria-label="Traffic source" value={source} onChange={(e) => setSource(e.target.value)}>
                                    <option value="">All sources</option>
                                    {source && !(data.sources ?? []).some((x) => x.source === source) && <option value={source}>{source}</option>}
                                    {(data.sources ?? []).map((x) => <option key={x.source} value={x.source}>{x.source} ({x.clicks})</option>)}
                                </Select>
                            </div>
                            <div className="w-64">
                                <Select aria-label="Visitors" value={converted} onChange={(e) => setConverted(e.target.value)}>
                                    <option value="">All visitors</option>
                                    <option value="yes">Visitors who converted</option>
                                    <option value="no">Visitors who did not convert</option>
                                </Select>
                            </div>
                            {filtered && <p className="text-xs text-zinc-500" data-testid="heat-filter-note">Filtered views use individual clicks, which are kept for 30 days{days === '90' ? ', so this shows the last 30 days' : ''}.</p>}
                        </div>
                        {!compare && <Totals data={data} />}
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                            <a href={`/api/experiments/${experimentId}/heatmaps/export?${new URLSearchParams(filterQuery)}`} download className="order-last ml-auto rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100" data-testid="heat-export">Download JSON</a>
                            {VIEWS.map((v) => (
                                <button key={v.id} type="button" onClick={() => setView(v.id)} className={`rounded-md px-3 py-1.5 text-sm ${view === v.id ? 'bg-blue-50 font-medium text-blue-700' : 'text-zinc-600 hover:bg-zinc-100'}`}>{v.label}</button>
                            ))}
                        </div>
                        {compare ? (
                            b ? <CompareView a={data} b={b} view={view} width={WIDTH[device]} /> : <Spinner />
                        ) : data.totals.clicks === 0 && data.totals.sessions === 0
                            ? <p className="text-sm text-zinc-500">{filtered ? 'No clicks match these filters in this range.' : 'No heatmap data yet for this version and device.'} Data appears a few seconds after sampled visitors leave the page.</p>
                            : <HeatView data={data} view={view} width={WIDTH[device]} />}
                    </div>
                )}
            </CardBody>
        </Card>
    );
}

function Totals({ data, compact = false }: { data: Report; compact?: boolean }) {
    return (
        <div className={`mb-4 grid gap-3 text-sm ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
            {[['Clicks', data.totals.clicks], ['Rage clicks', data.totals.rage], ['Dead clicks', data.totals.dead], ['Sessions with scroll data', data.totals.sessions]].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-zinc-200 px-3 py-2"><div className="text-zinc-500">{k}</div><div className="text-lg font-semibold text-zinc-900">{v}</div></div>
            ))}
        </div>
    );
}

const rowsFor = (d: Report) => Math.min(200, Math.max(24, ...d.grid.map((g) => g.gy + 1), ...d.confetti.map((p) => Math.floor(p.y / d.rowPx) + 1)));
const maxFor = (d: Report) => Math.max(1, ...d.grid.map((g) => g.clicks));

/** Two versions side by side on one scale: the same colour means the same number of clicks on both sides. */
export function CompareView({ a, b, view, width }: { a: Report; b: Report; view: View; width: number }) {
    const max = Math.max(maxFor(a), maxFor(b));
    const rows = Math.max(rowsFor(a), rowsFor(b));
    if (view === 'list') {
        const keys = [...new Set([...a.list, ...b.list].map((r) => r.selector))];
        const pick = (d: Report, k: string) => d.list.find((r) => r.selector === k);
        const share = (n: number, d: Report) => (d.totals.clicks ? `${((n / d.totals.clicks) * 100).toFixed(1)}%` : '-');
        const rowsL = keys.map((k) => ({ k, a: pick(a, k)?.clicks ?? 0, b: pick(b, k)?.clicks ?? 0 })).sort((x, y) => (y.a + y.b) - (x.a + x.b));
        return (
            <table className="w-full text-sm" data-testid="heat-compare-list">
                <thead><tr className="text-left text-zinc-500"><th className="py-2">Element</th><th className="text-right">{a.variation.name}</th><th className="text-right">Share</th><th className="text-right">{b.variation.name}</th><th className="text-right">Share</th></tr></thead>
                <tbody>{rowsL.map((r) => (
                    <tr key={r.k} className="border-t border-zinc-100"><td className="py-1.5 font-mono text-xs text-zinc-800">{r.k}</td><td className="text-right">{r.a}</td><td className="text-right text-zinc-500">{share(r.a, a)}</td><td className="text-right">{r.b}</td><td className="text-right text-zinc-500">{share(r.b, b)}</td></tr>
                ))}</tbody>
            </table>
        );
    }
    return (
        <div data-testid="heat-compare">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {[a, b].map((d) => (
                    <div key={d.variation.id}>
                        <p className="mb-2 text-sm font-medium text-zinc-900">{d.variation.name}{d.variations.find((v) => v.id === d.variation.id)?.is_control ? ' (control)' : ''}</p>
                        <Totals data={d} compact />
                        {d.totals.clicks === 0 && d.totals.sessions === 0
                            ? <p className="text-sm text-zinc-500">No heatmap data yet for this version and device.</p>
                            : <HeatView data={d} view={view} width={width} max={max} rows={rows} previewWidth={370} />}
                    </div>
                ))}
            </div>
            {(view === 'click' || view === 'overlay') && <p className="mt-2 text-xs text-zinc-500">Both sides use the same colour scale, so the same colour means the same number of clicks.</p>}
        </div>
    );
}

function HeatView({ data, view, width, max: sharedMax, rows: sharedRows, previewWidth = 760 }: { data: Report; view: View; width: number; max?: number; rows?: number; previewWidth?: number }) {
    const ownMax = useMemo(() => maxFor(data), [data]);
    const max = sharedMax ?? ownMax;
    const rows = sharedRows ?? rowsFor(data);
    const height = rows * data.rowPx;
    const scale = Math.min(1, previewWidth / width);
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
