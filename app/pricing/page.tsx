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
    ['Environments per project', '3 (dev, staging, production)', '3', '3', '3'],
    ['Team seats', '1', '5', '15', 'Unlimited'],
    ['Survey answers kept', 'Not included', '12 months', '24 months', '24 months'],
    ['Individual heatmap clicks kept', 'Not included', '30 days (daily totals stay)', '30 days (daily totals stay)', '30 days (daily totals stay)'],
    ['WordPress plugin', 'Not included', 'Included', 'Included', 'Included'],
    ['Funnels', 'Not included', 'Included', 'Included', 'Included'],
    ['Revenue goals', 'Not included', 'Included', 'Included', 'Included'],
    ['Results by segment', 'Not included', 'Included', 'Included', 'Included'],
    ['Webhooks', 'Not included', 'Included', 'Included', 'Included'],
    ['Auto-shift traffic to the winner', 'Not included', 'Not included', 'Included', 'Included'],
    ['Traffic overview', 'Not included', 'Included', 'Included', 'Included'],
    ['Popups and calls to action', 'Not included', 'Included', 'Included', 'Included'],
    ['Surveys', 'Not included', 'Included', 'Included', 'Included'],
    ['REST API', 'Included', 'Included', 'Included', 'Included'],
    ['Audit log', 'Not included', '90 days', '1 year', '2 years'],
    ['Support', 'Docs and email', 'Email', 'Priority email', 'Named contact with an SLA'],
];

// tier: lowest plan that includes it (0 Free, 1 Starter, 2 Growth). Paid items show a dash on lower plans.
const availableToday: { name: string; tier: number }[] = [
    { name: 'A/B and split URL tests', tier: 0 },
    { name: 'Flicker-free snippet', tier: 0 },
    { name: 'Sticky assignment', tier: 0 },
    { name: 'Targeting by device, UTM, referrer and new or returning visitors', tier: 0 },
    { name: 'Click, form submit, page visit and custom event goals', tier: 0 },
    { name: 'Peeking-safe significance and chance to beat control, with Wilson intervals', tier: 0 },
    { name: 'Sample ratio mismatch warning', tier: 0 },
    { name: 'Edit running tests safely', tier: 0 },
    { name: 'Preview links to check every version before and during a test, never counted in results', tier: 0 },
    { name: 'Shareable results links', tier: 0 },
    { name: 'Roll out the winner to every visitor with one click while you update your code', tier: 0 },
    { name: 'Scheduled start and stop, with a gradual traffic ramp', tier: 0 },
    { name: 'Test planner with hypotheses and a duration estimate', tier: 0 },
    { name: 'Google Tag Manager and WordPress install guides', tier: 0 },
    { name: 'Google Analytics 4 events for every test', tier: 0 },
    { name: 'WordPress plugin on paid plans', tier: 1 },
    { name: 'Webhooks for winners, finished tests, sample ratio warnings and plan limits, on paid plans', tier: 1 },
    { name: 'Heatmaps on paid plans: click, scroll, confetti and overlay, with rage and dead clicks and filters by traffic source and conversion', tier: 1 },
    { name: 'Heatmaps for pages without a test, on paid plans', tier: 1 },
    { name: 'Funnels on paid plans, built from your goals, with a completion trend', tier: 1 },
    { name: 'Revenue goals on paid plans: revenue per visitor and average order value', tier: 1 },
    { name: 'Results by segment on paid plans: device, traffic source and new or returning visitors', tier: 1 },
    { name: 'Auto-shift traffic to the winner on Growth and above', tier: 2 },
    { name: 'Visual editor on Growth and above: change text, colors, links and images, move or hide elements, or add page CSS, with mobile and tablet preview', tier: 2 },
    { name: 'Traffic overview on paid plans: page views, top pages, sources, devices and countries', tier: 1 },
    { name: 'JavaScript error tracking on paid plans: errors per test version', tier: 1 },
    { name: 'Popups and calls to action on paid plans: center, corner or bar, with views and clicks', tier: 1 },
    { name: 'Surveys on paid plans: one question with choices, a 1 to 5 rating, NPS or a written answer, with templates and CSV export', tier: 1 },
    { name: 'Separate environments', tier: 0 },
    { name: 'Public and secret keys', tier: 0 },
    { name: 'REST API', tier: 0 },
    { name: 'Audit log on paid plans: who changed what, kept 90 days to 2 years by plan', tier: 1 },
    { name: 'Invite teammates with a link, as owners or members, and add projects on paid plans', tier: 1 },
];

// tier: index of the lowest plan that includes the feature (0 Free, 1 Starter, 2 Growth, 3 Enterprise).
// p must match the phase that lists the item on the public /roadmap.
const comingSoon: { name: string; p: number; tier: number }[] = [
    { name: 'Session recordings', p: 7, tier: 1 },
];

const faqs = [
    { q: 'Is the free plan actually free?', a: 'Yes. No card, no trial clock. You get 10,000 tested visitors a month (up to 300 a day), 1 running test at a time, 10 tests in total, 1 project on 1 domain, and A/B tests with a control plus 1 variation, for as long as you use it.' },
    { q: 'What counts as a tested visitor?', a: 'A unique visitor ID that gets assigned to at least one running experiment in a calendar month. Pages without a running test don\'t count. One visitor in three tests counts once.' },
    { q: 'What happens if I go over my limit?', a: 'New visitors see your original page and aren\'t counted or added to results. Visitors already in a test keep their variant. On the free plan this applies past 10,000 tested visitors in a month or 300 in a day. We never upgrade you or bill you automatically.' },
    { q: 'How are visitors assigned to a variant?', a: 'The SDK sends a visitor ID, and we hash it together with the experiment ID. The same visitor always lands in the same variant. Raising traffic allocation doesn\'t move people who are already in the test.' },
    { q: 'Which statistics do you use?', a: 'A sequential test of each variant against the control, at 95% confidence split across the variants, so the verdict stays valid however often you check. Each variant also shows its chance to beat the control, and each conversion rate a Wilson score interval. Significance is only tested once every variation has at least 100 visitors.' },
    { q: 'Are the coming soon features included in my price?', a: 'When a feature ships, it\'s included in the plan listed for it at no extra cost. Until then it\'s marked coming soon. Don\'t buy a plan for a feature that isn\'t built yet.' },
    { q: 'Can I change or cancel my plan?', a: 'Yes, anytime. Upgrades apply right away. Downgrades and cancellations take effect at the end of the billing period. Your tests and results are kept. Survey answers follow the retention of the plan you are on, and on the free plan answers older than 6 months are deleted. Audit log entries also follow your current plan, so moving to a plan with a shorter period deletes older entries.' },
    { q: 'What data do you delete, and when?', a: 'Survey answers are deleted after 12 months on Starter and 24 months on Growth and Enterprise. Individual heatmap clicks are deleted after 30 days; heatmaps keep their daily totals. Audit log entries are deleted after 90 days on Starter, 1 year on Growth and 2 years on Enterprise (30 days on Free). Tests, visitor assignments, conversions, results and daily totals are kept while your account is active.' },
    { q: 'Is there an annual discount?', a: 'Yes. Pay yearly and get 2 months free.' },
    { q: 'How many tests can I run on the free plan?', a: 'One running test at a time and 10 tests over the life of the account. A test counts once you start it, and deleting it does not give it back. Each test compares a control with 1 variation. Paid plans remove these limits and allow up to 50 variations.' },
    { q: 'Do you charge per seat?', a: 'No. Each plan includes a set number of seats and projects at no extra cost: 1 of each on Free, 5 seats and 3 projects on Starter, 15 seats and 10 projects on Growth, and unlimited seats with a custom number of projects on Enterprise. Invite people with a link from Team and projects. After a downgrade, existing members and projects stay, but you cannot add more above the plan.' },
    { q: 'What do I need to install?', a: 'A small JavaScript snippet, under 30 KB gzipped. It works on any site, including through Google Tag Manager or WordPress. Paid plans also get a WordPress plugin that adds it for you.' },
    { q: 'Who should talk to you about Enterprise?', a: 'Sites over 1 million tested visitors a month, or teams that need a contract and DPA.' },
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
                    <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200 bg-white" tabIndex={0}>
                        <table className="w-full min-w-[760px] text-left text-sm">
                            <thead className="bg-zinc-50 text-zinc-900">
                                <tr><th className="p-4 font-semibold">Limits</th>{plans.map((p) => <th key={p} className="p-4 font-semibold">{p}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {limits.map(([label, ...vals]) => (
                                    <tr key={label}><td className="p-4 font-medium text-zinc-900">{label}</td>{vals.map((v, i) => <td key={i} className="p-4 text-zinc-600">{v}</td>)}</tr>
                                ))}
                                <tr className="bg-zinc-50"><td colSpan={5} className="p-4 font-semibold text-zinc-900">Available today</td></tr>
                                {availableToday.map((f) => (
                                    <tr key={f.name}><td className="p-4 text-zinc-900">{f.name}</td>{plans.map((p, i) => <td key={p} className="p-4">{i >= f.tier ? <Check /> : <span className="text-zinc-300">-</span>}</td>)}</tr>
                                ))}
                                <tr className="bg-zinc-50"><td colSpan={5} className="p-4 font-semibold text-zinc-900">Coming soon</td></tr>
                                {comingSoon.map((f) => (
                                    <tr key={f.name}><td className="p-4 text-zinc-900">{f.name}</td>{plans.map((p, i) => <td key={p} className="p-4">{i >= f.tier ? <Soon p={f.p} /> : <span className="text-zinc-300">-</span>}</td>)}</tr>
                                ))}
                                <tr><td className="p-4 text-zinc-900">Custom contract and DPA</td><td className="p-4 text-zinc-300">-</td><td className="p-4 text-zinc-300">-</td><td className="p-4 text-zinc-300">-</td><td className="p-4 text-zinc-600">Enterprise</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-4 text-sm text-zinc-600">Heatmaps (live) and session recordings (coming soon) are on paid plans only (Starter and up). Coming soon means planned, not shipped. See the <Link href="/roadmap" className="font-medium text-blue-600 hover:underline">roadmap</Link> for details. When a feature ships, it&apos;s included in the plans listed at no extra cost.</p>
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
