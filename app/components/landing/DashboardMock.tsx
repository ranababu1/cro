import { LeafMark } from '../ui/Logo';

// Static illustration of the product. Numbers are example data and are labelled as such.
const variation = [2.6, 3.4, 3.1, 4.2, 4.0, 4.9, 4.6, 5.4, 5.9, 5.6, 6.3, 6.8, 6.6, 7.5];
const original = [2.4, 2.9, 2.7, 3.3, 3.1, 3.6, 3.4, 3.9, 4.1, 3.8, 4.3, 4.4, 4.2, 4.8];

function path(values: number[], w: number, h: number, max: number) {
    return values.map((v, i) => `${i === 0 ? 'M' : 'L'}${((i / (values.length - 1)) * w).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(' ');
}

function StatCard({ label, value, delta }: { label: string; value: string; delta: string }) {
    return (
        <div className="rounded-lg border border-zinc-200 bg-white p-2.5">
            <p className="text-[10px] text-zinc-500">{label}</p>
            <p className="mt-0.5 text-base font-semibold tracking-tight text-zinc-900 tabular-nums sm:text-lg">{value}</p>
            <p className="text-[10px] font-medium text-emerald-700">↑ {delta}</p>
        </div>
    );
}

function VariantCard({ letter, name, headline, rate, visitors, accent }: { letter: string; name: string; headline: string; rate: string; visitors: string; accent?: boolean }) {
    return (
        <div className="rounded-lg border border-zinc-200 bg-white p-2.5">
            <div className="mb-2 flex items-center gap-1.5">
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold ${accent ? 'bg-emerald-600 text-white' : 'bg-zinc-200 text-zinc-700'}`}>{letter}</span>
                <span className="text-[11px] font-semibold text-zinc-900">{name}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
                <div className="flex items-center gap-1.5 rounded-md bg-gradient-to-br from-sky-50 to-emerald-50 p-2">
                    <div className="min-w-0">
                        <p className="text-[9px] font-semibold leading-tight text-zinc-800">{headline}</p>
                        <span className="mt-1 inline-block rounded bg-zinc-900 px-1.5 py-0.5 text-[7px] text-white">Get started</span>
                    </div>
                    <svg viewBox="0 0 24 18" className="ml-auto h-6 w-8 shrink-0" aria-hidden>
                        <rect width="24" height="18" rx="2" fill="#bae6fd" />
                        <path d="M2 16l6-7 4 4 3-3 7 6z" fill={accent ? '#059669' : '#38bdf8'} />
                    </svg>
                </div>
                <div className="text-right">
                    <p className="text-[9px] text-zinc-500">Conversion rate</p>
                    <p className={`text-sm font-semibold tabular-nums ${accent ? 'text-emerald-700' : 'text-zinc-900'}`}>{rate}</p>
                    <p className="mt-1 text-[9px] text-zinc-500">Visitors</p>
                    <p className="text-[11px] font-semibold text-zinc-900 tabular-nums">{visitors}</p>
                </div>
            </div>
        </div>
    );
}

export function DashboardMock() {
    const W = 300;
    const H = 90;
    const max = 9;
    return (
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_24px_60px_-20px_rgb(15_23_42/0.25)]">
            <div className="flex items-center gap-1.5 border-b border-zinc-100 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-red-300" /><span className="h-2 w-2 rounded-full bg-amber-300" /><span className="h-2 w-2 rounded-full bg-emerald-300" />
                <span className="ml-auto rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500">Example data</span>
            </div>
            <div className="flex">
                <aside className="hidden w-28 shrink-0 border-r border-zinc-100 p-2.5 sm:block">
                    <div className="mb-3 flex items-center gap-1"><LeafMark className="h-3.5 w-3.5" /><span className="text-[10px] font-semibold">freeabtest.com</span></div>
                    {['Overview', 'Experiments', 'Audiences', 'Integrations', 'Settings'].map((n, i) => (
                        <div key={n} className={`mb-0.5 rounded px-1.5 py-1 text-[10px] ${i === 0 ? 'bg-emerald-50 font-medium text-emerald-800' : 'text-zinc-500'}`}>{n}</div>
                    ))}
                </aside>
                <div className="min-w-0 flex-1 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-semibold text-zinc-900">Homepage headline test</p>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 ring-1 ring-emerald-200"><span className="h-1 w-1 rounded-full bg-emerald-600" />Running</span>
                        <span className="ml-auto rounded border border-zinc-200 px-1.5 py-0.5 text-[9px] text-zinc-500">Last 30 days</span>
                    </div>
                    <div className="mt-2 flex gap-3 border-b border-zinc-100 text-[10px] text-zinc-500">
                        {['Overview', 'Results', 'Variations', 'Settings'].map((t, i) => (
                            <span key={t} className={`pb-1.5 ${i === 0 ? 'border-b-2 border-emerald-600 font-medium text-zinc-900' : ''}`}>{t}</span>
                        ))}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                        <StatCard label="Total visitors" value="24,530" delta="12.4%" />
                        <StatCard label="Conversions" value="1,842" delta="18.8%" />
                        <StatCard label="Conversion rate" value="7.5%" delta="22.1%" />
                    </div>
                    <div className="mt-2 rounded-lg border border-zinc-200 p-2.5">
                        <div className="mb-1 flex items-center text-[10px]">
                            <span className="font-medium text-zinc-800">Conversion rate over time</span>
                            <span className="ml-auto flex items-center gap-2 text-zinc-500">
                                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />Variation B</span>
                                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-sky-400" />Original A</span>
                            </span>
                        </div>
                        <svg viewBox={`0 0 ${W} ${H + 14}`} className="h-auto w-full" role="img" aria-label="Example chart: Variation B conversion rate rises above the original over 30 days">
                            {[0, 0.33, 0.66, 1].map((g) => <line key={g} x1="0" x2={W} y1={g * H} y2={g * H} stroke="#f4f4f5" />)}
                            <path d={`${path(variation, W, H, max)} L${W},${H} L0,${H} Z`} fill="#10b981" opacity=".08" />
                            <path d={path(original, W, H, max)} fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeLinejoin="round" />
                            <path d={path(variation, W, H, max)} fill="none" stroke="#059669" strokeWidth="2" strokeLinejoin="round" />
                            {['Oct 1', 'Oct 7', 'Oct 14', 'Oct 21', 'Oct 28'].map((d, i) => (
                                <text key={d} x={(i / 4) * W} y={H + 12} fontSize="8" fill="#a1a1aa" textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>{d}</text>
                            ))}
                        </svg>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <VariantCard letter="A" name="Original" headline="Smarter decisions for your business" rate="4.8%" visitors="12,340" />
                        <VariantCard letter="B" name="Variation" headline="Turn ideas into real growth" rate="7.5%" visitors="12,190" accent />
                    </div>
                </div>
            </div>
        </div>
    );
}
