import { calculateConfidenceInterval } from '@/lib/statistics';
import { chanceToBeatControl, sequentialTest } from '@/lib/sequential';
import { upliftInterval } from '@/lib/liveStats';
import { WORKED_EXAMPLE, fmt } from '@/lib/site/home';

/**
 * Illustrative product previews for marketing pages. The numbers are example data, computed with the same
 * statistics code the app uses, and every preview is wrapped in SampleDataFrame by the caller.
 */
const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

export function exampleResults() {
    const { control: c, variant: v } = WORKED_EXAMPLE;
    const ctl = { total_users: c.visitors, conversions: c.conversions, conversion_rate: c.conversions / c.visitors };
    const vr = { total_users: v.visitors, conversions: v.conversions, conversion_rate: v.conversions / v.visitors };
    return {
        control: { ...ctl, ci: calculateConfidenceInterval(c.conversions, c.visitors) },
        variant: { ...vr, ci: calculateConfidenceInterval(v.conversions, v.visitors) },
        lift: vr.conversion_rate / ctl.conversion_rate - 1,
        liftCi: upliftInterval(c.conversions, c.visitors, v.conversions, v.visitors),
        chance: chanceToBeatControl(ctl, vr),
        seq: sequentialTest(ctl, vr, 1),
    };
}

export function exampleEarly() {
    const e = WORKED_EXAMPLE.early;
    const ctl = { total_users: e.visitors, conversions: e.controlConversions, conversion_rate: e.controlConversions / e.visitors };
    const vr = { total_users: e.visitors, conversions: e.variantConversions, conversion_rate: e.variantConversions / e.visitors };
    return { seq: sequentialTest(ctl, vr, 1), chance: chanceToBeatControl(ctl, vr) };
}

function StatusPill({ tone, children }: { tone: 'running' | 'paused' | 'done'; children: React.ReactNode }) {
    const cls = tone === 'running' ? 'bg-accent-50 text-accent-700 ring-accent-100' : tone === 'paused' ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-slate-100 text-muted-strong ring-line';
    return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium ring-1 ring-inset ${cls}`}>{tone === 'running' && <span className="h-1.5 w-1.5 rounded-full bg-accent-600" />}{children}</span>;
}

/** Compact experiment card for the hero. */
export function HeroPreview() {
    const r = exampleResults();
    const rows = [
        { name: 'Control', rate: r.control.conversion_rate, n: r.control.total_users, conv: r.control.conversions, ci: r.control.ci },
        { name: 'Variant B', rate: r.variant.conversion_rate, n: r.variant.total_users, conv: r.variant.conversions, ci: r.variant.ci, best: true },
    ];
    return (
        <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 pr-24">
                <p className="text-[15px] font-semibold text-navy-950">Pricing page headline</p>
                <StatusPill tone="running">Running</StatusPill>
            </div>
            <p className="mt-1 text-[13px] text-muted">Goal: Start trial button click</p>
            <div className="mt-5 space-y-3">
                {rows.map((row) => (
                    <div key={row.name} className={`rounded-xl border p-4 ${row.best ? 'border-accent-600/40 bg-accent-50/50' : 'border-line bg-white'}`}>
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="text-[14px] font-medium text-navy-950">{row.name}</span>
                            <span className="text-[24px] font-semibold tabular-nums tracking-tight text-navy-950">{pct(row.rate)}</span>
                        </div>
                        <div className="mt-1 flex justify-between text-[12px] tabular-nums text-muted">
                            <span>{fmt(row.conv)} of {fmt(row.n)} visitors</span>
                            <span>95% interval {pct(row.ci.lower)} to {pct(row.ci.upper)}</span>
                        </div>
                    </div>
                ))}
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-[13px]">
                <div className="rounded-lg bg-surface p-3"><dt className="text-muted">Lift vs control</dt><dd className="mt-0.5 text-[17px] font-semibold tabular-nums text-accent-700">+{pct(r.lift, 0)}</dd></div>
                <div className="rounded-lg bg-surface p-3"><dt className="text-muted">Chance to beat control</dt><dd className="mt-0.5 text-[17px] font-semibold tabular-nums text-navy-950">{pct(r.chance)}</dd></div>
            </dl>
            <p className="mt-4 rounded-lg border border-accent-600/30 bg-white px-3 py-2.5 text-[13px] font-medium text-accent-700">Variant B is outperforming the control</p>
        </div>
    );
}

/** Experiments list plus a results table with interval bars, for the product preview section. */
export function DashboardPreview() {
    const r = exampleResults();
    const tests = [
        { name: 'Pricing page headline', status: 'running' as const, label: 'Running', visitors: 9600, result: 'Variant B ahead' },
        { name: 'Signup form length', status: 'running' as const, label: 'Running', visitors: 3120, result: 'Collecting data' },
        { name: 'Homepage hero layout', status: 'paused' as const, label: 'Paused', visitors: 1480, result: 'No significant difference yet' },
        { name: 'Checkout button copy', status: 'done' as const, label: 'Completed', visitors: 12840, result: 'Control kept' },
    ];
    const lo = 0.035, hi = 0.08;
    const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
    const arms = [
        { name: 'Control', d: r.control, color: 'bg-slate-400' },
        { name: 'Variant B', d: r.variant, color: 'bg-accent-600' },
    ];
    return (
        <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="border-b border-line p-5 lg:border-b-0 lg:border-r">
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">Experiments</p>
                <ul className="mt-3 divide-y divide-line">
                    {tests.map((t, i) => (
                        <li key={t.name} className={`flex items-center justify-between gap-3 py-3 ${i === 0 ? 'rounded-lg bg-surface px-3' : 'px-3'}`}>
                            <div className="min-w-0">
                                <p className="truncate text-[14px] font-medium text-navy-950">{t.name}</p>
                                <p className="text-[12px] text-muted">{fmt(t.visitors)} visitors · {t.result}</p>
                            </div>
                            <StatusPill tone={t.status}>{t.label}</StatusPill>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="p-5 pt-12 sm:pt-5">
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">Pricing page headline · Results</p>
                <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left text-[13px]">
                        <thead className="text-muted"><tr><th className="py-2 font-medium">Version</th><th className="py-2 font-medium">Visitors</th><th className="py-2 font-medium">Conversions</th><th className="py-2 font-medium">Rate</th><th className="py-2 font-medium">Chance to beat</th></tr></thead>
                        <tbody className="divide-y divide-line tabular-nums text-navy-950">
                            {arms.map((a) => (
                                <tr key={a.name}>
                                    <td className="py-2.5 font-medium">{a.name}</td>
                                    <td className="py-2.5">{fmt(a.d.total_users)}</td>
                                    <td className="py-2.5">{fmt(a.d.conversions)}</td>
                                    <td className="py-2.5">{pct(a.d.conversion_rate)}</td>
                                    <td className="py-2.5">{a.name === 'Control' ? '-' : pct(r.chance)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="mt-5 text-[13px] font-medium text-navy-950">Conversion rate with 95% Wilson interval</p>
                <div className="mt-3 space-y-4" role="img" aria-label={`Control ${pct(r.control.conversion_rate)}, interval ${pct(r.control.ci.lower)} to ${pct(r.control.ci.upper)}. Variant B ${pct(r.variant.conversion_rate)}, interval ${pct(r.variant.ci.lower)} to ${pct(r.variant.ci.upper)}.`}>
                    {arms.map((a) => (
                        <div key={a.name} className="grid grid-cols-[76px_1fr] items-center gap-3">
                            <span className="text-[12px] text-muted-strong">{a.name}</span>
                            <div className="relative h-5 rounded bg-surface">
                                <span className={`absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full ${a.color}`} style={{ left: x(a.d.ci.lower), width: `calc(${x(a.d.ci.upper)} - ${x(a.d.ci.lower)})` }} />
                                <span className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 bg-navy-950" style={{ left: x(a.d.conversion_rate) }} />
                            </div>
                        </div>
                    ))}
                    <div className="grid grid-cols-[76px_1fr] gap-3 text-[11px] tabular-nums text-muted"><span /><div className="flex justify-between"><span>3.5%</span><span>8.0%</span></div></div>
                </div>
                <p className="mt-4 text-[13px] text-muted-strong">Sequential p-value {r.seq.p_value.toFixed(3)} against a bar of {r.seq.threshold}. Lift +{pct(r.lift, 0)}{r.liftCi && <> (interval +{pct(r.liftCi.lower, 0)} to +{pct(r.liftCi.upper, 0)})</>}.</p>
            </div>
        </div>
    );
}
