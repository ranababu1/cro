import { LeafMark } from '../ui/Logo';

// Static product illustration for the hero. All numbers are example data and labelled as such.
const variation = [3.1, 3.6, 3.3, 4.4, 4.2, 4.9, 4.6, 5.2, 5.6, 5.4, 6.0, 6.4, 6.2, 6.9, 7.1, 7.5];
const original = [2.2, 2.6, 2.5, 2.9, 2.8, 3.2, 3.0, 3.4, 3.6, 3.5, 3.9, 4.1, 4.0, 4.4, 4.6, 4.8];
const W = 520;
const H = 135;
const MAX = 12;
const y = (v: number) => H - (v / MAX) * H;
const line = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${((i / (vals.length - 1)) * W).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

function Icon({ d }: { d: string }) {
    return <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
}

const nav = [
    { label: 'Overview', d: 'M4 5h16v14H4zM4 10h16' },
    { label: 'Experiments', d: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3' },
    { label: 'Audiences', d: 'M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M20 19v-1a3 3 0 0 0-2-3M17 5a3 3 0 0 1 0 6' },
    { label: 'Integrations', d: 'M12 3 4 7.5v9L12 21l8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5' },
    { label: 'Settings', d: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.1V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1' },
];

function Stat({ label, value, delta }: { label: string; value: string; delta: string }) {
    return (
        <div className="min-w-0 rounded-xl border border-zinc-200/80 bg-white p-2.5 shadow-[0_1px_2px_rgb(15_23_42/0.04)] sm:p-4">
            <p className="truncate text-[11px] text-zinc-500 sm:text-[13px]">{label}</p>
            <p className="mt-1 text-[19px] font-semibold leading-tight sm:text-[28px] tracking-tight text-zinc-900 tabular-nums">{value}</p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">↑ {delta}</span>
        </div>
    );
}

function MiniPage({ headline, tone }: { headline: string; tone: 'blue' | 'teal' }) {
    return (
        <div className="flex items-center gap-3 rounded-lg bg-gradient-to-br from-slate-50 to-sky-50 p-3 ring-1 ring-zinc-100">
            <div className="min-w-0 flex-1">
                <div className="mb-2 flex gap-1"><span className="h-1 w-6 rounded bg-zinc-200" /><span className="h-1 w-4 rounded bg-zinc-200" /><span className="h-1 w-5 rounded bg-zinc-200" /></div>
                <p className="text-[13px] font-semibold leading-[1.25] text-zinc-900">{headline}</p>
                <span className={`mt-2 inline-block rounded px-2 py-0.5 text-[8px] font-medium text-white ${tone === 'blue' ? 'bg-blue-900' : 'bg-blue-900'}`}>Get started</span>
            </div>
            <svg viewBox="0 0 48 52" className="h-[62px] w-[56px] shrink-0" aria-hidden>
                <rect width="48" height="52" rx="5" fill={tone === 'blue' ? '#bfdbfe' : '#a5f3fc'} />
                <circle cx="35" cy="13" r="5" fill="#fff" opacity=".9" />
                <path d="M0 44 15 22l10 13 7-8 16 17v8H0z" fill={tone === 'blue' ? '#2563eb' : '#0f766e'} opacity=".85" />
                <path d="M0 52V46l12-9 12 9 10-6 14 8v4z" fill={tone === 'blue' ? '#1e40af' : '#115e59'} />
            </svg>
        </div>
    );
}

function VariantCard({ letter, name, headline, rate, visitors, accent }: { letter: string; name: string; headline: string; rate: string; visitors: string; accent?: boolean }) {
    return (
        <div className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
            <div className="mb-3 flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${accent ? 'bg-teal-600 text-white' : 'bg-zinc-200 text-zinc-700'}`}>{letter}</span>
                <span className="text-[14px] font-semibold text-zinc-900">{name}</span>
                <span className="ml-auto tracking-widest text-zinc-400">···</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                <MiniPage headline={headline} tone={accent ? 'teal' : 'blue'} />
                <div>
                    <p className="whitespace-nowrap text-[11px] text-zinc-500">Conversion rate</p>
                    <p className={`text-[22px] font-semibold tabular-nums ${accent ? 'text-teal-700' : 'text-zinc-900'}`}>{rate}</p>
                    <p className="mt-2 text-[11px] text-zinc-500">Visitors</p>
                    <p className="text-[19px] font-semibold text-zinc-900 tabular-nums">{visitors}</p>
                </div>
            </div>
        </div>
    );
}

export function DashboardMock() {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-[0_30px_80px_-24px_rgb(30_64_175/0.28),0_8px_24px_-12px_rgb(15_23_42/0.12)] ring-1 ring-zinc-200/70">
            <div className="flex items-center gap-1.5 px-4 pt-3.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff6159]" /><span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" /><span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex items-center border-b border-zinc-100 px-5 py-3">
                <span className="flex items-center gap-1.5 text-[15px] font-semibold"><LeafMark className="h-5 w-5" />freeabtest<span className="font-normal text-zinc-500">.com</span></span>
                <span className="ml-auto mr-3 hidden rounded bg-zinc-100 sm:inline px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">Example data</span>
                <span className="ml-auto text-[13px] text-zinc-700 sm:ml-0">My Project ⌄</span>
                <span className="ml-3 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-600">IH</span>
            </div>
            <div className="flex">
                <aside className="hidden w-[150px] shrink-0 border-r border-zinc-100 px-3 py-4 sm:block">
                    {nav.map((n, i) => (
                        <div key={n.label} className={`mb-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] ${i === 0 ? 'bg-blue-50 font-medium text-blue-800' : 'text-zinc-600'}`}>
                            <Icon d={n.d} />{n.label}
                        </div>
                    ))}
                </aside>
                <div className="min-w-0 flex-1 p-5">
                    <div className="flex flex-wrap items-center gap-3">
                        <p className="text-[21px] font-semibold tracking-tight text-zinc-900">Homepage Headline Test</p>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-medium text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />Running</span>
                        <span className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[12px] text-zinc-700 sm:ml-auto">Last 30 days ⌄</span>
                    </div>
                    <div className="mt-4 flex gap-6 border-b border-zinc-100 text-[13px] text-zinc-500">
                        {['Overview', 'Results', 'Variations', 'Audience', 'Settings'].map((t, i) => (
                            <span key={t} className={`pb-2.5 ${i === 0 ? '-mb-px border-b-2 border-blue-600 font-medium text-zinc-900' : ''}`}>{t}</span>
                        ))}
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                        <Stat label="Total visitors" value="24,530" delta="12.4%" />
                        <Stat label="Total conversions" value="1,842" delta="18.8%" />
                        <Stat label="Conversion rate" value="7.5%" delta="22.1%" />
                    </div>
                    <div className="mt-3 rounded-xl border border-zinc-200/80 bg-white p-4">
                        <div className="flex items-center text-[12px]">
                            <span className="font-medium text-zinc-900">Conversion rate over time</span>
                            <span className="ml-auto flex items-center gap-4 text-zinc-600">
                                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal-600" />Variation B</span>
                                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-400" />Original A</span>
                            </span>
                        </div>
                        <svg viewBox={`-30 -8 ${W + 90} ${H + 30}`} className="mt-2 h-auto w-full" role="img" aria-label="Example chart: Variation B conversion rate climbs to 7.5%, above the original at 4.8%">
                            {[0, 4, 8, 12].map((g) => (
                                <g key={g}>
                                    <line x1="0" x2={W} y1={y(g)} y2={y(g)} stroke="#f1f5f9" />
                                    <text x="-8" y={y(g) + 4} fontSize="10" fill="#94a3b8" textAnchor="end">{g}%</text>
                                </g>
                            ))}
                            <path d={line(original)} fill="none" stroke="#60a5fa" strokeWidth="2.2" strokeLinejoin="round" />
                            <path d={line(variation)} fill="none" stroke="#0d9488" strokeWidth="2.4" strokeLinejoin="round" />
                            <g transform={`translate(${W + 6},${y(7.5) - 11})`}><rect width="44" height="22" rx="5" fill="#0f766e" /><text x="22" y="15" fontSize="11" fontWeight="600" fill="#fff" textAnchor="middle">7.5%</text></g>
                            <g transform={`translate(${W + 6},${y(4.8) - 11})`}><rect width="44" height="22" rx="5" fill="#dbeafe" /><text x="22" y="15" fontSize="11" fontWeight="600" fill="#1e40af" textAnchor="middle">4.8%</text></g>
                            {['Oct 1', 'Oct 7', 'Oct 14', 'Oct 21', 'Oct 28'].map((d, i) => (
                                <text key={d} x={(i / 4) * W} y={H + 18} fontSize="10" fill="#94a3b8" textAnchor="middle">{d}</text>
                            ))}
                        </svg>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <VariantCard letter="A" name="Original" headline="Smarter decisions for your business" rate="4.8%" visitors="12,340" />
                        <VariantCard letter="B" name="Variation" headline="Turn ideas into real growth" rate="7.5%" visitors="12,190" accent />
                    </div>
                </div>
            </div>
        </div>
    );
}
