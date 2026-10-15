import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { buildExperimentResults } from '@/lib/results';
import { Logo } from '@/app/components/ui/Logo';
import { SrmWarning } from '@/app/components/SrmWarning';
import { publicResultsView } from '@/lib/shareView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Test results', robots: { index: false, follow: false } };

const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

export default async function SharedResults({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const experiment = await db.getSharedExperiment(token);
    if (!experiment) notFound();
    const view = publicResultsView(await buildExperimentResults(experiment));

    return (
        <div className="min-h-screen bg-[#f8faff] text-zinc-950">
            <header className="border-b border-zinc-200 bg-white">
                <div className="mx-auto flex max-w-[1000px] items-center justify-between px-5 py-4">
                    <Logo />
                    <span className="text-xs font-medium text-zinc-500">Read-only results</span>
                </div>
            </header>
            <main className="mx-auto max-w-[1000px] space-y-6 px-5 py-10">
                <div>
                    <p className="text-[13px] font-semibold tracking-[0.2em] text-blue-600">A/B TEST</p>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0b1630]">{view.name}</h1>
                    <p className="mt-2 text-sm text-zinc-600">{view.statusLabel} · {view.visitors.toLocaleString()} visitors</p>
                </div>
                <div className={`rounded-xl border px-5 py-4 text-sm ${view.headline.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}>
                    <p className="font-semibold">{view.headline.title}</p>
                    <p className="mt-1">{view.headline.text}</p>
                </div>
                <SrmWarning srm={view.srm} />
                {view.goals.map((g) => (
                    <section key={g.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
                            <h2 className="font-semibold text-zinc-900">{g.name}</h2>
                            {g.primary && <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">Primary goal</span>}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                                    <tr><th className="px-5 py-2">Version</th><th className="px-5 py-2 text-right">Visitors</th><th className="px-5 py-2 text-right">Conversions</th><th className="px-5 py-2 text-right">Rate</th><th className="px-5 py-2 text-right">Lift vs control</th><th className="px-5 py-2 text-right">95% interval</th></tr>
                                </thead>
                                <tbody>
                                    {g.rows.map((r) => (
                                        <tr key={r.name} className="border-t border-zinc-100">
                                            <td className="px-5 py-2.5 font-medium text-zinc-900">{r.name}{r.control && <span className="ml-2 text-xs text-zinc-500">Control</span>}{r.winner && <span className="ml-2 rounded bg-emerald-50 px-1.5 text-xs font-medium text-emerald-700">Winner</span>}</td>
                                            <td className="px-5 py-2.5 text-right tabular-nums">{r.visitors.toLocaleString()}</td>
                                            <td className="px-5 py-2.5 text-right tabular-nums">{r.conversions.toLocaleString()}</td>
                                            <td className="px-5 py-2.5 text-right tabular-nums">{pct(r.rate)}</td>
                                            <td className={`px-5 py-2.5 text-right tabular-nums ${r.lift === null ? 'text-zinc-400' : r.lift >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{r.lift === null ? '–' : `${r.lift >= 0 ? '+' : ''}${(r.lift * 100).toFixed(1)}%`}</td>
                                            <td className="px-5 py-2.5 text-right tabular-nums text-zinc-600">{pct(r.ci[0])} to {pct(r.ci[1])}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                ))}
                <p className="text-xs text-zinc-500">Significance is tested once every version has at least 100 visitors, at 95% confidence. Made with <a href="https://www.freeabtest.com" className="text-blue-700 hover:underline">freeabtest.com</a>.</p>
            </main>
        </div>
    );
}
