import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '../components/landing/SiteChrome';
import { BillingCards } from './BillingCards';

export const metadata: Metadata = {
    title: 'Pricing',
    description: 'Start free with 10,000 tested visitors a month. Starter $10/mo, Growth $50/mo, Enterprise custom. No per-seat fees, no surprise bills.',
};

const plans = ['Free', 'Starter', 'Growth', 'Enterprise'];

const limits: [string, string, string, string, string][] = [
    ['Who it\'s for', 'Trying it out and side projects', 'One growing site', 'Teams testing every week', 'High traffic and compliance needs'],
    ['Monthly tested visitors', '10,000 (up to 300 a day)', '250,000', '1,000,000', 'Custom'],
    ['Running experiments at a time', '1', '20', 'Unlimited', 'Unlimited'],
    ['Total experiments', '10 over the life of the account', 'Unlimited', 'Unlimited', 'Unlimited'],
    ['Variations per experiment', 'Control plus 1 (A/B only)', 'Control plus up to 50', 'Control plus up to 50', 'Control plus up to 50'],
    ['Projects', '1', '3', '10', 'Custom'],
    ['Environments per project', '3 (dev, staging, production)', '3', '3', 'Custom'],
    ['Team seats', '1', '5', '15', 'Unlimited'],
    ['Data retention', '6 months', '12 months', '24 months', 'Custom'],
    ['REST API', 'Included', 'Included', 'Included', 'Included'],
    ['Audit log', '30 days', '90 days', '1 year', 'Custom'],
    ['Support', 'Docs and email', 'Email', 'Priority email', 'Named contact with an SLA'],
];

const availableToday = [
    'A/B and split URL tests', 'Flicker-free snippet', 'Sticky assignment', 'Targeting by device, UTM, referrer and new or returning visitors',
    'Click, form submit, page visit and custom event goals', 'Wilson intervals with a z-test against the control', 'Sample ratio mismatch warning',
    'Edit running tests safely', 'Shareable results links', 'Google Tag Manager and WordPress install guides',
    'Separate environments', 'Public and secret keys', 'REST API', 'Audit log',
];

// tier: index of the lowest plan that includes the feature (0 Free, 1 Starter, 2 Growth, 3 Enterprise).
// p must match the phase that lists the item on the public /roadmap.
const comingSoon: { name: string; p: number; tier: number }[] = [
    { name: 'Heatmaps (click, scroll, confetti, overlay)', p: 3, tier: 1 },
    { name: 'Rage and dead click detection', p: 3, tier: 1 },
    { name: 'Session recordings', p: 4, tier: 1 },
    { name: 'Funnels', p: 4, tier: 1 },
    { name: 'Revenue goals', p: 4, tier: 1 },
    { name: 'Visual editor', p: 4, tier: 2 },
    { name: 'Auto-shift traffic to the winner', p: 4, tier: 2 },
    { name: 'WordPress plugin', p: 5, tier: 0 },
];

const faqs = [
    { q: 'Is the free plan actually free?', a: 'Yes. No card, no trial clock. You get 10,000 tested visitors a month (up to 300 a day), 1 running test at a time, 10 tests in total, 1 project on 1 domain, and A/B tests with a control plus 1 variation, for as long as you use it.' },
    { q: 'What counts as a tested visitor?', a: 'A unique visitor ID that gets assigned to at least one running experiment in a calendar month. Pages without a running test don\'t count. One visitor in three tests counts once.' },
    { q: 'What happens if I go over my limit?', a: 'New visitors see your original page and aren\'t counted or added to results. Visitors already in a test keep their variant. On the free plan this applies past 10,000 tested visitors in a month or 300 in a day. We never upgrade you or bill you automatically.' },
    { q: 'How are visitors assigned to a variant?', a: 'The SDK sends a visitor ID, and we hash it together with the experiment ID. The same visitor always lands in the same variant. Raising traffic allocation doesn\'t move people who are already in the test.' },
    { q: 'Which statistics do you use?', a: 'Today: a two-proportion z-test of each variant against the control, and Wilson score intervals for each conversion rate. Significance is only tested once every variant has at least 100 visitors.' },
    { q: 'Are the coming soon features included in my price?', a: 'When a feature ships, it\'s included in the plan listed for it at no extra cost. Until then it\'s marked coming soon. Don\'t buy a plan for a feature that isn\'t built yet.' },
    { q: 'Can I change or cancel my plan?', a: 'Yes, anytime. Upgrades apply right away. Downgrades and cancellations take effect at the end of the billing period. Your data is kept for your plan\'s retention period.' },
    { q: 'What happens to my data after the retention period?', a: 'Raw events older than your retention window are deleted. Experiment summaries (final results and the winner you chose) are kept while your account is active.' },
    { q: 'Is there an annual discount?', a: 'Yes. Pay yearly and get 2 months free.' },
    { q: 'How many tests can I run on the free plan?', a: 'One running test at a time and 10 tests over the life of the account. A test counts once you start it, and deleting it does not give it back. Each test compares a control with 1 variation. Paid plans remove these limits and allow up to 50 variations.' },
    { q: 'Do you charge per seat?', a: 'No. Each plan includes a set number of seats. Enterprise has unlimited seats.' },
    { q: 'What do I need to install?', a: 'A small JavaScript snippet, about 14 KB gzipped. It works on any site, including through Google Tag Manager or WordPress. A WordPress plugin is planned.' },
    { q: 'Who should talk to you about Enterprise?', a: 'Sites over 1 million tested visitors a month, or teams that need custom retention, a contract and DPA.' },
];

const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
};

const Check = () => <span className="font-bold text-teal-600" aria-label="Included">✓</span>;
const Soon = ({ p }: { p: number }) => <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Coming soon, Phase {p}</span>;

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-[#f8faff] text-zinc-950">
            <SiteHeader />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
            <main className="mx-auto max-w-[1200px] px-5 pb-20 pt-10 sm:px-8">
                <p className="text-[13px] font-semibold tracking-[0.2em] text-blue-600">PRICING</p>
                <h1 className="mt-4 max-w-3xl text-[40px] font-bold leading-tight tracking-[-0.03em] text-[#0b1630] sm:text-[52px]">Simple plans. A free tier you can actually use.</h1>
                <p className="mt-4 max-w-2xl text-lg text-zinc-600">Start free with 10,000 tested visitors a month. Upgrade when your traffic grows. No per-seat fees, no surprise bills.</p>

                <BillingCards />

                <section className="mt-20">
                    <h2 className="text-[30px] font-bold tracking-tight text-[#0b1630]">Compare plans</h2>
                    <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                        <table className="w-full min-w-[760px] text-left text-sm">
                            <thead className="bg-zinc-50 text-zinc-900">
                                <tr><th className="p-4 font-semibold">Limits</th>{plans.map((p) => <th key={p} className="p-4 font-semibold">{p}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {limits.map(([label, ...vals]) => (
                                    <tr key={label}><td className="p-4 font-medium text-zinc-900">{label}</td>{vals.map((v, i) => <td key={i} className="p-4 text-zinc-600">{v}</td>)}</tr>
                                ))}
                                <tr className="bg-zinc-50"><td colSpan={5} className="p-4 font-semibold text-zinc-900">Available today on all plans</td></tr>
                                {availableToday.map((f) => (
                                    <tr key={f}><td className="p-4 text-zinc-900">{f}</td>{plans.map((p) => <td key={p} className="p-4"><Check /></td>)}</tr>
                                ))}
                                <tr className="bg-zinc-50"><td colSpan={5} className="p-4 font-semibold text-zinc-900">Coming soon</td></tr>
                                {comingSoon.map((f) => (
                                    <tr key={f.name}><td className="p-4 text-zinc-900">{f.name}</td>{plans.map((p, i) => <td key={p} className="p-4">{i >= f.tier ? <Soon p={f.p} /> : <span className="text-zinc-300">-</span>}</td>)}</tr>
                                ))}
                                <tr><td className="p-4 text-zinc-900">Custom contract and DPA</td><td className="p-4 text-zinc-300">-</td><td className="p-4 text-zinc-300">-</td><td className="p-4 text-zinc-300">-</td><td className="p-4 text-zinc-600">Enterprise</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-4 text-sm text-zinc-600">Heatmaps and session recordings are on paid plans only (Starter and up). Coming soon means planned, not shipped. See the <Link href="/roadmap" className="font-medium text-blue-600 hover:underline">roadmap</Link> for details. When a feature ships, it&apos;s included in the plans listed at no extra cost.</p>
                </section>

                <section className="mt-16 rounded-2xl border border-teal-200 bg-teal-50/60 p-7">
                    <h2 className="text-xl font-semibold text-[#0b1630]">Annual billing and overages</h2>
                    <ul className="mt-4 space-y-2 text-sm text-zinc-700">
                        <li>Pay yearly and get 2 months free: Starter $100/yr (about $8.33/mo), Growth $500/yr.</li>
                        <li>You&apos;re never billed or upgraded automatically. Once you&apos;re over your limit, new visitors see the control and aren&apos;t counted.</li>
                        <li>Your usage and limits are always shown on the Overview page.</li>
                    </ul>
                </section>

                <section id="faq" className="mt-20 scroll-mt-6">
                    <h2 className="text-[30px] font-bold tracking-tight text-[#0b1630]">Common questions</h2>
                    <div className="mt-6 divide-y divide-zinc-200 border-y border-zinc-200">
                        {faqs.map((f) => (
                            <details key={f.q} className="group py-5">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-zinc-900">
                                    {f.q}
                                    <span className="text-zinc-400 transition-transform group-open:rotate-45" aria-hidden>+</span>
                                </summary>
                                <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">{f.a}</p>
                            </details>
                        ))}
                    </div>
                </section>

                <section className="mt-20 rounded-3xl bg-gradient-to-r from-[#2563eb] to-[#14b8a6] px-8 py-12 text-center text-white">
                    <h2 className="text-[30px] font-bold tracking-tight">Run your first test in about 15 minutes.</h2>
                    <p className="mx-auto mt-3 max-w-xl text-white/90">Free plan, no card needed. Add the snippet, create a test, read real results.</p>
                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                        <Link href="/signin" className="inline-flex h-11 items-center rounded-lg bg-white px-6 text-sm font-semibold text-blue-700 hover:bg-blue-50">Start for free</Link>
                        <Link href="/docs" className="inline-flex h-11 items-center rounded-lg border border-white/70 px-6 text-sm font-semibold text-white hover:bg-white/10">Read the quick start</Link>
                    </div>
                </section>
            </main>
            <SiteFooter />
        </div>
    );
}
