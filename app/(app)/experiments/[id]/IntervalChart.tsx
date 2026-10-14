import type { VariationMetrics } from '@/lib/types';

/**
 * Conversion rate with 95% confidence interval per variation, on a shared axis.
 * Plain SVG-free markup so it scales with the container and prints cleanly.
 */
export function IntervalChart({ rows, winner }: { rows: VariationMetrics[]; winner?: string }) {
    const withData = rows.filter((r) => r.total_users > 0 && r.confidence_interval);
    if (withData.length === 0) return null;
    const lo = Math.min(...withData.map((r) => r.confidence_interval!.lower));
    const hi = Math.max(...withData.map((r) => r.confidence_interval!.upper));
    const pad = (hi - lo) * 0.1 || 0.01;
    const min = Math.max(0, lo - pad);
    const max = Math.min(1, hi + pad);
    const pos = (v: number) => `${((v - min) / (max - min)) * 100}%`;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + (max - min) * t);
    const control = rows.find((r) => r.is_control);

    return (
        <div>
            <div className="space-y-3">
                {rows.map((r) => {
                    const ci = r.confidence_interval;
                    const isWinner = r.variation_id === winner;
                    return (
                        <div key={r.variation_id} className="grid grid-cols-[7rem_1fr] items-center gap-3 sm:grid-cols-[10rem_1fr]">
                            <div className="truncate text-sm text-zinc-700" title={r.variation_name}>{r.variation_name}</div>
                            <div className="relative h-7 rounded bg-zinc-50">
                                {control?.confidence_interval && control.total_users > 0 && (
                                    <div className="absolute inset-y-0 w-px bg-zinc-300" style={{ left: pos(control.conversion_rate) }} aria-hidden />
                                )}
                                {ci && r.total_users > 0 && (
                                    <>
                                        <div
                                            className={`absolute top-1/2 h-2 -translate-y-1/2 rounded-full ${isWinner ? 'bg-emerald-200' : r.is_control ? 'bg-zinc-300' : 'bg-brand-200'}`}
                                            style={{ left: pos(ci.lower), width: `calc(${pos(ci.upper)} - ${pos(ci.lower)})` }}
                                        />
                                        <div
                                            className={`absolute top-1/2 h-3.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-sm ${isWinner ? 'bg-emerald-600' : r.is_control ? 'bg-zinc-600' : 'bg-brand-600'}`}
                                            style={{ left: pos(r.conversion_rate) }}
                                            title={`${(r.conversion_rate * 100).toFixed(2)}%`}
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="mt-2 grid grid-cols-[7rem_1fr] gap-3 sm:grid-cols-[10rem_1fr]">
                <div />
                <div className="relative h-4 text-[11px] text-zinc-400 tabular-nums">
                    {ticks.map((t, i) => (
                        <span key={i} className={`absolute ${i === 0 ? '' : i === 4 ? '-translate-x-full' : '-translate-x-1/2'}`} style={{ left: `${i * 25}%` }}>{(t * 100).toFixed(1)}%</span>
                    ))}
                </div>
            </div>
            <p className="mt-3 text-xs text-zinc-500">Bars show the 95% confidence interval. The marker is the observed rate. The vertical line is the control rate.</p>
        </div>
    );
}
