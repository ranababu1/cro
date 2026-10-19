'use client';

import type { FunnelTrend as Trend } from '@/lib/funnels';

const COLORS = ['#2563eb', '#0d9488', '#d97706', '#db2777', '#7c3aed', '#16a34a', '#dc2626', '#0891b2'];
const W = 640, H = 180, PAD_L = 40, PAD_B = 22, PAD_T = 8, PAD_R = 8;
const label = (p: string, bucket: Trend['bucket']) => {
    const d = new Date(`${p}T00:00:00Z`);
    const s = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
    return bucket === 'week' ? `Week of ${s}` : s;
};

/** Completion rate of visitors who started the funnel in each period, one line per version. */
export function FunnelTrend({ trend, onBucket }: { trend: Trend; onBucket: (b: Trend['bucket']) => void }) {
    const n = trend.periods.length;
    const any = trend.variations.some((v) => v.points.some((p) => p.started > 0));
    const max = Math.max(0.05, ...trend.variations.flatMap((v) => v.points.map((p) => p.rate)));
    const top = Math.min(1, Math.ceil(max * 10) / 10);
    const x = (i: number) => PAD_L + (n <= 1 ? (W - PAD_L - PAD_R) / 2 : (i * (W - PAD_L - PAD_R)) / (n - 1));
    const y = (r: number) => PAD_T + (1 - r / top) * (H - PAD_T - PAD_B);
    const ticks = [0, top / 2, top];
    const every = Math.max(1, Math.ceil(n / 6));
    return (
        <div data-testid="funnel-trend">
            <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium text-zinc-900">Completion trend</span>
                <div className="inline-flex rounded-md border border-zinc-200 p-0.5" role="tablist" aria-label="Trend period">
                    {(['day', 'week'] as const).map((b) => (
                        <button key={b} type="button" onClick={() => onBucket(b)} className={`rounded px-2.5 py-1 text-xs font-medium ${trend.bucket === b ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}>{b === 'day' ? 'Daily' : 'Weekly'}</button>
                    ))}
                </div>
                <div className="flex flex-wrap gap-3">
                    {trend.variations.map((v, i) => (
                        <span key={v.variation_id} className="flex items-center gap-1.5 text-zinc-600"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{v.name}</span>
                    ))}
                </div>
            </div>
            {!any ? <p className="text-sm text-zinc-500">No visitor has started this funnel yet.</p> : (
                <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Funnel completion rate over time">
                    {ticks.map((t) => (
                        <g key={t}>
                            <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke="#a1a1aa" strokeOpacity="0.35" />
                            <text x={PAD_L - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#71717a">{Math.round(t * 100)}%</text>
                        </g>
                    ))}
                    {trend.periods.map((p, i) => ((i % every === 0 && n - 1 - i >= every / 2) || i === n - 1) && (
                        <text key={p} x={x(i)} y={H - 6} textAnchor={n > 1 && i === 0 ? 'start' : n > 1 && i === n - 1 ? 'end' : 'middle'} fontSize="10" fill="#71717a">{label(p, 'day')}</text>
                    ))}
                    {trend.variations.map((v, vi) => {
                        const color = COLORS[vi % COLORS.length];
                        // Periods with no starters are gaps, not zero.
                        const segs: string[] = [];
                        let cur = '';
                        v.points.forEach((pt, i) => {
                            if (pt.started === 0) { if (cur) segs.push(cur); cur = ''; return; }
                            cur += `${cur ? 'L' : 'M'}${x(i).toFixed(1)},${y(pt.rate).toFixed(1)}`;
                        });
                        if (cur) segs.push(cur);
                        return (
                            <g key={v.variation_id}>
                                {segs.map((d, si) => <path key={si} d={d} fill="none" stroke={color} strokeWidth="2" />)}
                                {v.points.map((pt, i) => pt.started > 0 && (
                                    <circle key={pt.period} cx={x(i)} cy={y(pt.rate)} r="3" fill={color}>
                                        <title>{`${v.name}, ${label(pt.period, trend.bucket)}: ${pt.completed} of ${pt.started} finished (${(pt.rate * 100).toFixed(1)}%)`}</title>
                                    </circle>
                                ))}
                            </g>
                        );
                    })}
                </svg>
            )}
            <p className="mt-1 text-xs text-zinc-500">Each point is visitors who started the funnel {trend.bucket === 'day' ? 'on that day' : 'in that week'}, and the share who finished every step. Recent points can still rise as visitors finish later.</p>
        </div>
    );
}
