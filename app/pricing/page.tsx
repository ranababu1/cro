import Link from 'next/link';
import { Breadcrumbs, SiteFooter, SiteHeader } from '../components/site';
import { ldJson } from '@/lib/blog';
import { pageMetadata } from '@/lib/site/meta';
import { BillingCards } from './BillingCards';
import { canSessionCheckout } from '@/lib/billing/access';

export const dynamic = 'force-dynamic';

export const metadata = pageMetadata({
    path: '/pricing',
    title: 'Pricing',
    description: 'Start free with 10,000 tested visitors a month. Starter $20/mo, Growth $50/mo, Enterprise custom. No per-seat fees, no surprise bills.',
});

const plans = ['Free', 'Starter', 'Growth', 'Enterprise'];

const limits: [string, string, string, string, string][] = [
    ['Who it\'s for', 'Trying it out and side projects', 'One growing site', 'Teams testing every week', 'High traffic and compliance needs'],
    ['Tested visitors a month', '10,000', '250,000', '1,000,000', 'Custom'],
    ['Tested visitors a day', '300', 'No daily limit', 'No daily limit', 'No daily limit'],
    ['Running experiments at a time', '1', '20', 'Unlimited', 'Unlimited'],
    ['New experiments per month', '1 (resets on the 1st, UTC)', 'No monthly limit', 'No monthly limit', 'No monthly limit'],
    ['Page URLs per experiment', '1', '1', 'Several (multi-page tests)', 'Several (multi-page tests)'],
    ['Goals per experiment', '1 (a click on a CSS selector)', 'Up to 50: click, form submit, page visit and custom event', 'Up to 50: click, form submit, page visit and custom event', 'Up to 50: click, form submit, page visit and custom event'],
    ['Variations per experiment', 'A/B only (control plus 1 variation)', 'Control plus up to 50', 'Control plus up to 50', 'Control plus up to 50'],
    ['Projects', '1', '3', '10', 'Custom'],
    ['Domains', '1', 'No limit', 'No limit', 'No limit'],
    ['Environments per project', '3 (dev, staging, production)', '3', '3', '3'],
    ['Team seats', '1', '5', '15', 'Unlimited'],
    ['Survey answers kept', 'Not included (paid plans only)', '12 months', '24 months', '24 months'],
    ['Individual heatmap clicks kept', 'Not included (paid plans only)', '30 days (daily totals stay)', '30 days (daily totals stay)', '30 days (daily totals stay)'],
    ['WordPress plugin', 'Not included (paid plans only)', 'Included', 'Included', 'Included'],
    ['Funnels', 'Not included (paid plans only)', 'Included', 'Included', 'Included'],
    ['Revenue goals', 'Not included (paid plans only)', 'Included', 'Included', 'Included'],
    ['Results by segment', 'Not included (paid plans only)', 'Included', 'Included', 'Included'],
    ['Webhooks', 'Not included (paid plans only)', 'Included', 'Included', 'Included'],
    ['Auto-shift traffic to the winner', 'Not included (Growth and above)', 'Not included (Growth and above)', 'Included', 'Included'],
    ['AI suggestions with your own key (OpenAI, Gemini, DeepSeek or Claude)', 'Not included (Growth and above)', 'Not included (Growth and above)', 'Included', 'Included'],
    ['Traffic overview', 'Not included (paid plans only)', 'Included', 'Included', 'Included'],
    ['Popups and calls to action', 'Not included (paid plans only)', 'Included', 'Included', 'Included'],
    ['Surveys', 'Not included (paid plans only)', 'Included', 'Included', 'Included'],
    ['REST API', 'Included', 'Included', 'Included', 'Included'],
    ['Audit log', 'Not included (paid plans only)', '90 days', '1 year', '2 years'],
    ['Support', 'Docs and email', 'Email', 'Priority email', 'Named contact with an SLA'],
];

// tier: lowest plan that includes it (0 Free, 1 Starter, 2 Growth). Paid items show a dash on lower plans.
const availableToday: { name: string; tier: number }[] = [
    { name: 'A/B and split URL tests', tier: 0 },
    { name: 'Flicker-free snippet', tier: 0 },
    { name: 'Sticky assignment', tier: 0 },
    { name: 'Targeting by device, UTM, referrer and new or returning visitors', tier: 0 },
    { name: 'Click goals on a CSS selector', tier: 0 },
    { name: 'Form submit, page visit and custom event goals, and several goals per test, on paid plans', tier: 1 },
    { name: 'Peeking-safe significance and chance to beat control, with Wilson intervals', tier: 0 },
    { name: 'Sample ratio mismatch warning', tier: 0 },
    { name: 'Edit running tests safely', tier: 0 },
    { name: 'Preview links to check every version before and during a test, never counted in results', tier: 0 },
    { name: 'Shareable results links', tier: 0 },
    { name: 'Results download as CSV, per day, version and goal', tier: 0 },
    { name: 'Roll out the winner to every visitor with one click while you update your code', tier: 0 },
    { name: 'Scheduled start and stop, with a gradual traffic ramp', tier: 0 },
    { name: 'Test planner with hypotheses and a duration estimate', tier: 0 },
    { name: 'Server-side assignment from your backend with a secret key (conversions sent from your code need a paid plan)', tier: 0 },
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
    { name: 'Multi-page and multivariate tests on Growth and above', tier: 2 },
    { name: 'AI suggestions on Growth and above, with your own OpenAI, Gemini, DeepSeek or Claude key: test ideas from a page, hypotheses, headline and button copy in the visual editor, plain-words result summaries and follow-up tests', tier: 2 },
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
const comingSoon: { name: string; tier: number }[] = [
    { name: 'Session recordings', tier: 1 },
];

// Billing and plan questions only. Product questions live on /faq (lib/site/faq.ts); tests/resourcesPages.test.ts keeps them apart.
const faqs = [
    { q: 'Is the free plan actually free?', a: 'Yes. Free forever, no card and no time limit. You get 10,000 tested visitors a month (up to 300 a day), 1 running test at a time, 1 new test a month, 1 page URL per test, 1 goal per test (a click on a CSS selector), 1 project, 1 domain, and A/B tests with a control plus 1 variation, for as long as you use it.' },
    { q: 'What counts as a tested visitor?', a: 'A unique visitor ID that gets assigned to at least one running experiment in a calendar month. Pages without a running test don\'t count. One visitor in three tests counts once.' },
    { q: 'What happens when I hit a limit?', a: 'We never upgrade you or bill you automatically, and your running test keeps running. On the free plan: past 10,000 tested visitors in a month or 300 in a day, new visitors see your original page and aren\'t counted or added to results until the count resets (the daily count at midnight UTC, the monthly count on the 1st). Visitors already in a test keep their version, and visitors already counted that month can still join. Once you have created this month\'s test, creating another is refused with a message that gives the date it comes back, the 1st of next month (UTC); deleting a test doesn\'t give it back. Starting a second test while one is running is refused until you pause or complete it. A second goal, a goal that isn\'t a click, a second variation, a second project or a second domain can\'t be added, and the app shows what upgrading adds. Conversions sent from your code (custom events and revenue) are refused on Free, while clicks on your goal\'s selector still count. Overview shows your usage against each limit.' },
    { q: 'Are the coming soon features included in my price?', a: 'When a feature ships, it\'s included in the plan listed for it at no extra cost. Until then it\'s marked coming soon. Don\'t buy a plan for a feature that isn\'t built yet.' },
    { q: 'Can I change or cancel my plan?', a: 'Yes, anytime. Upgrades apply right away. Downgrades and cancellations take effect at the end of the billing period. Your tests and results are kept. Survey answers follow the retention of the plan you are on, and on the free plan answers older than 6 months are deleted. Audit log entries also follow your current plan, so moving to a plan with a shorter period deletes older entries.' },
    { q: 'What data do you delete, and when?', a: 'Survey answers are deleted after 12 months on Starter and 24 months on Growth and Enterprise. Individual heatmap clicks are deleted after 30 days; heatmaps keep their daily totals. Audit log entries are deleted after 90 days on Starter, 1 year on Growth and 2 years on Enterprise (30 days on Free). Tests, visitor assignments, conversions, results and daily totals are kept while your account is active.' },
    { q: 'Is there an annual discount?', a: 'Yes. Pay yearly and get 2 months free.' },
    { q: 'How many tests can I run on the free plan?', a: 'One running test at a time, and you can create 1 new test each calendar month (UTC). The allowance comes back on the 1st of the month, and deleting a test doesn\'t give it back. It is counted per account and per website domain, so several free accounts on one domain share it. Each test covers 1 page URL, compares a control with 1 variation and has 1 goal: a click on a CSS selector. Paid plans have no monthly test limit, allow up to 50 variations and add form submit, page visit and custom event goals.' },
    { q: 'Do you charge per seat?', a: 'No. Each plan includes a set number of seats and projects at no extra cost: 1 of each on Free, 5 seats and 3 projects on Starter, 15 seats and 10 projects on Growth, and unlimited seats with a custom number of projects on Enterprise. Invite people with a link from Team and projects. After a downgrade, existing members and projects stay, but you cannot add more above the plan.' },
    { q: 'Who should talk to you about Enterprise?', a: 'Sites over 1 million tested visitors a month, or teams that need a contract and DPA.' },
];

const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
};

const Check = () => <span className="font-semibold text-accent-700" aria-label="Included">✓</span>;
const NotIncluded = () => <span className="text-[12px] text-muted">Not included</span>;
const PaidBadge = ({ tier }: { tier: number }) => <span className={`ml-2 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tier >= 2 ? 'bg-soft-blue text-navy-900 ring-blue-200' : 'bg-surface text-muted-strong ring-line'}`}>{tier >= 2 ? 'Growth and above' : 'Paid plans only'}</span>;
const Soon = () => <span className="inline-block rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-strong ring-1 ring-inset ring-line">Coming soon</span>;
const Dash = () => <span className="text-muted">-</span>;

export default async function PricingPage() {
    const checkout = await canSessionCheckout();
    return (
        <div className="min-h-screen bg-white text-navy-950">
            <SiteHeader />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(JSON.stringify(faqJsonLd)) }} />
            <main>
                <header className="border-b border-line bg-surface">
                    <div className="mx-auto max-w-[1200px] px-5 pb-14 pt-10 sm:px-8 sm:pt-12">
                        <Breadcrumbs items={[{ href: '/pricing', label: 'Pricing' }]} />
                        <p className="mt-8 text-[13px] font-semibold uppercase tracking-[0.08em] text-accent-700">Pricing</p>
                        <h1 className="mt-3 max-w-[760px] text-[36px] font-semibold leading-[1.1] tracking-[-0.02em] text-navy-950 sm:text-[48px]">Simple plans. A free tier you can actually use.</h1>
                        <p className="mt-4 max-w-[640px] text-[18px] leading-[1.6] text-muted-strong">Start free with 10,000 tested visitors a month. Upgrade when your traffic grows. No per-seat fees, no surprise bills.</p>
                        <BillingCards checkout={checkout} />
                    </div>
                </header>

                <section id="compare" className="scroll-mt-24 bg-white">
                    <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8 sm:py-20">
                        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent-700">Compare</p>
                        <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.02em] text-navy-950 sm:text-[36px]">Compare plans</h2>
                        <p className="mt-3 max-w-[720px] text-[16px] leading-[1.6] text-muted-strong">Every limit of every plan, in plain numbers. Not included means the feature is only on the paid plans shown.</p>
                        <p className="mt-2 text-[13px] text-muted lg:hidden">Scroll the table sideways to see every plan.</p>
                        <div className="mt-8 overflow-x-auto rounded-xl border border-line bg-white" tabIndex={0} role="region" aria-label="Plan comparison">
                            <table className="w-full min-w-[760px] table-fixed text-left text-[14px]">
                                <thead className="border-b border-line bg-surface text-navy-950">
                                    <tr><th className="sticky left-0 z-10 w-[170px] bg-surface p-4 font-semibold sm:w-[240px] lg:w-[320px]">Limits</th>{plans.map((p) => <th key={p} className="p-4 font-semibold">{p}</th>)}</tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {limits.map(([label, ...vals]) => (
                                        <tr key={label}><td className="sticky left-0 z-10 bg-white p-4 font-medium text-navy-950">{label}</td>{vals.map((v, i) => <td key={i} className="p-4 text-muted-strong">{v}</td>)}</tr>
                                    ))}
                                    <tr className="bg-surface"><td colSpan={5} className="p-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Available today</td></tr>
                                    {availableToday.map((f) => (
                                        <tr key={f.name}><td className="sticky left-0 z-10 bg-white p-4 text-navy-950">{f.name}{f.tier > 0 && <PaidBadge tier={f.tier} />}</td>{plans.map((p, i) => <td key={p} className="p-4">{i >= f.tier ? <Check /> : <NotIncluded />}</td>)}</tr>
                                    ))}
                                    <tr className="bg-surface"><td colSpan={5} className="p-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Coming soon</td></tr>
                                    {comingSoon.map((f) => (
                                        <tr key={f.name}><td className="sticky left-0 z-10 bg-white p-4 text-navy-950">{f.name}</td>{plans.map((p, i) => <td key={p} className="p-4">{i >= f.tier ? <Soon /> : <Dash />}</td>)}</tr>
                                    ))}
                                    <tr><td className="sticky left-0 z-10 bg-white p-4 text-navy-950">Custom contract and DPA</td><td className="p-4"><Dash /></td><td className="p-4"><Dash /></td><td className="p-4"><Dash /></td><td className="p-4 text-muted-strong">Enterprise</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-4 max-w-[860px] text-[14px] leading-[1.6] text-muted-strong">Heatmaps (live) and session recordings (coming soon) are on paid plans only (Starter and up). Coming soon means planned, not shipped. When a feature ships, it&apos;s included in the plans listed at no extra cost.</p>
                    </div>
                </section>

                <section aria-labelledby="annual-title" className="border-y border-line bg-surface">
                    <div className="mx-auto max-w-[1200px] px-5 py-14 sm:px-8">
                        <h2 id="annual-title" className="text-[22px] font-semibold tracking-[-0.01em] text-navy-950">Annual billing and overages</h2>
                        <ul className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                            {['Pay yearly and get 2 months free: Starter $200/yr (about $16.67/mo), Growth $500/yr.', 'You\'re never billed or upgraded automatically. Once you\'re over your limit, new visitors see the control and aren\'t counted.', 'Your usage and limits are always shown on the Overview page.'].map((t) => (
                                <li key={t} className="rounded-xl border border-line bg-white p-5 text-[15px] leading-[1.6] text-muted-strong shadow-xs">{t}</li>
                            ))}
                        </ul>
                    </div>
                </section>

                <section id="faq" className="scroll-mt-24 bg-white">
                    <div className="mx-auto max-w-[820px] px-5 py-16 sm:px-8 sm:py-20">
                        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent-700">FAQ</p>
                        <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.02em] text-navy-950 sm:text-[36px]">Common questions</h2>
                        <p className="mt-3 text-[16px] leading-[1.6] text-muted-strong">Plans and billing. For setup, tests, results and privacy, see the <Link href="/faq" className="font-medium text-accent-700 hover:underline">FAQ</Link>.</p>
                        <div className="mt-8 divide-y divide-line rounded-xl border border-line bg-white">
                            {faqs.map((f) => (
                                <details key={f.q} className="group p-5">
                                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[16px] font-semibold text-navy-950">
                                        <span>{f.q}</span>
                                        <span className="mt-0.5 shrink-0 text-muted transition-transform group-open:rotate-45" aria-hidden>+</span>
                                    </summary>
                                    <p className="mt-3 text-[15px] leading-[1.65] text-muted-strong">{f.a}</p>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="bg-navy-950 text-white">
                    <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-6 px-5 py-14 sm:px-8 md:flex-row md:items-center md:justify-between md:py-16">
                        <div className="max-w-[640px]">
                            <h2 className="text-[26px] font-semibold tracking-[-0.02em] sm:text-[30px]">Run your first test in about 15 minutes.</h2>
                            <p className="mt-2 text-[16px] text-white/75">Free plan, no card needed. Add the snippet, create a test, read real results.</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Link href="/signin" className="inline-flex h-11 items-center rounded-lg bg-white px-5 text-[15px] font-semibold text-navy-950 hover:bg-surface">Start for free</Link>
                            <Link href="/docs/quick-start" className="inline-flex h-11 items-center rounded-lg border border-white/40 px-5 text-[15px] font-semibold text-white hover:bg-white/10">Read the quick start</Link>
                        </div>
                    </div>
                </section>
            </main>
            <SiteFooter />
        </div>
    );
}
