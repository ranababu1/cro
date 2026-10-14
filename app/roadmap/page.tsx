import type { Metadata } from 'next';
import { Badge } from '../components/ui';
import { SiteFooter, SiteHeader } from '../components/landing/SiteChrome';

export const metadata: Metadata = { title: 'Features and roadmap' };

const available = [
    { title: 'A/B and A/B/n tests', body: 'Compare a control with up to 25 variants. Set any traffic split, such as 50/50, 70/30 or 90/10.' },
    { title: 'Sticky assignment', body: 'Visitors are hashed into a variant, so they see the same version on every visit and every device that shares an ID.' },
    { title: 'Split URL tests', body: 'Send each variant to its own URL when the change is a whole page rather than an element.' },
    { title: 'Results you can defend', body: 'Conversion rate, lift and Wilson confidence intervals per variant, with a two-proportion z-test against the control.' },
    { title: 'Environments and keys', body: 'Separate dev, staging and production data. Public SDK keys for browsers, hashed secret keys for servers.' },
    { title: 'Audit log', body: 'Every change to an experiment, key or plan is recorded with who made it and when.' },
];

const planned = [
    { phase: 'Phase 1', items: ['Flicker-free snippet with local bucketing', 'URL, device, UTM and browser targeting', 'Click, form, revenue and custom goals', 'Sample ratio mismatch alerts', 'Sample size and duration calculator'] },
    { phase: 'Phase 2', items: ['Bayesian and sequential analysis', 'Feature flags and percentage rollouts', 'Server SDKs and React/Next.js', 'GA4, GTM, WordPress and webhooks', 'Roles, SSO and scheduled reports'] },
    { phase: 'Phase 3', items: ['Visual editor', 'Multi-armed bandits and CUPED', 'Edge delivery', 'Warehouse exports', 'AI-assisted test ideas and summaries'] },
];

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
                <h2 className="mt-20 text-[30px] font-bold tracking-tight text-[#0b1630]">What is coming next</h2>
                <p className="mt-2 text-zinc-600">The platform is built in three phases. This is the plan, not a list of shipped features.</p>
                <div className="mt-6 grid gap-5 md:grid-cols-3">
                    {planned.map((p) => (
                        <div key={p.phase} className="rounded-2xl border border-zinc-200 bg-white p-6">
                            <Badge tone={p.phase === 'Phase 1' ? 'brand' : 'neutral'}>{p.phase}</Badge>
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
