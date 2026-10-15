import type { Metadata } from 'next';
import { Badge } from '../components/ui';
import { SiteFooter, SiteHeader } from '../components/landing/SiteChrome';

export const metadata: Metadata = { title: 'Features and roadmap' };

const available = [
    { title: 'A/B and split URL tests', body: 'Compare a control page with one variation on the free plan, or up to 50 on paid plans. Set any traffic split, such as 50/50, 70/30 or 90/10.' },
    { title: 'Sticky assignment', body: 'Visitors are hashed into a variation, so they see the same version on every visit.' },
    { title: 'Goals', body: 'Count clicks, form submits, page visits and custom events, once per visitor.' },
    { title: 'Targeting', body: 'Choose who can enter by device, UTM, referrer and new or returning visitors.' },
    { title: 'Edit running tests', body: 'Change the split, pause a variation or add goals without resetting results.' },
    { title: 'Sample ratio mismatch warning', body: 'Get a plain warning when traffic does not split the way you set it.' },
    { title: 'Shareable results', body: 'Send a read-only results link to anyone, and turn it off at any time.' },
    { title: 'Results you can defend', body: 'Conversion rate, lift and 95% confidence intervals per variation, with a significance test against the control.' },
    { title: 'Live stats', body: 'Visitors, redirects and goal clicks update while the test runs, with a plain answer on who is ahead.' },
    { title: 'Environments and keys', body: 'Separate development and production data, with the install snippet filled in for you.' },
];

type PhaseStatus = 'Done' | 'In progress' | 'Planned';

const phases: { phase: string; name: string; status: PhaseStatus; items: string[] }[] = [
    { phase: 'Phase 1', name: 'A/B testing core', status: 'Done', items: ['Split URL tests with sticky assignment', 'Click goals by CSS selector', 'Significance and confidence intervals', 'Live stats while a test runs', 'One-line install'] },
    { phase: 'Phase 2', name: 'More goals and targeting', status: 'Done', items: ['Page visit, form submit and custom event goals', 'Targeting by device, UTM, referrer and new or returning visitors', 'Edit running tests safely', 'Sample ratio mismatch warning', 'Shareable results links', 'Google Tag Manager and WordPress guides'] },
    { phase: 'Phase 3', name: 'Heatmaps', status: 'In progress', items: ['Click, scroll and confetti heatmaps', 'Heatmaps per variation', 'Rage and dead click detection', 'Traffic overview'] },
    { phase: 'Phase 4', name: 'Recordings, funnels and visual editor', status: 'Planned', items: ['Session recordings with privacy masking', 'Funnels built from your goals', 'Revenue goals', 'Visual editor', 'Auto-shift traffic to the winner'] },
    { phase: 'Phase 5', name: 'Engagement extras', status: 'Planned', items: ['Popups and calls to action', 'Simple surveys', 'Error tracking', 'WordPress plugin'] },
];

const tone: Record<PhaseStatus, 'success' | 'brand' | 'neutral'> = { Done: 'success', 'In progress': 'brand', Planned: 'neutral' };

export default function RoadmapPage() {
    return (
        <div className="min-h-screen bg-[#f8faff] text-zinc-950">
            <SiteHeader />
            <main className="mx-auto max-w-[1100px] px-5 pb-20 pt-10 sm:px-8">
                <p className="text-[13px] font-semibold tracking-[0.2em] text-blue-600">PRODUCT</p>
                <h1 className="mt-4 text-[40px] font-bold tracking-[-0.03em] text-[#0b1630] sm:text-[52px]">Available today</h1>
                <p className="mt-3 max-w-2xl text-lg text-zinc-600">Assignment, data separation and statistics come first. Everything here works in the current release.</p>
                <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-3">
                    {available.map((f) => (
                        <div key={f.title} className="bg-white p-6">
                            <h2 className="text-sm font-semibold text-zinc-900">{f.title}</h2>
                            <p className="mt-2 text-sm leading-6 text-zinc-600">{f.body}</p>
                        </div>
                    ))}
                </div>
                <h2 className="mt-20 text-[30px] font-bold tracking-tight text-[#0b1630]">Roadmap</h2>
                <p className="mt-2 text-zinc-600">The product grows in five phases. Planned items are not available yet.</p>
                <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {phases.map((p) => (
                        <div key={p.phase} className="rounded-2xl border border-zinc-200 bg-white p-6">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[13px] font-semibold text-blue-600">{p.phase}</span>
                                <Badge tone={tone[p.status]}>{p.status}</Badge>
                            </div>
                            <h3 className="mt-2 text-lg font-semibold text-[#0b1630]">{p.name}</h3>
                            <ul className="mt-4 space-y-2.5 text-sm text-zinc-600">
                                {p.items.map((i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />{i}</li>)}
                            </ul>
                        </div>
                    ))}
                </div>
            </main>
            <SiteFooter />
        </div>
    );
}
