import Link from 'next/link';
import { pageMetadata } from '@/lib/site/meta';
import { WORKED_EXAMPLE, fmt } from '@/lib/site/home';
import { ANALYTICS_EXTRAS, FREE_LINE, VERDICTS } from '@/lib/site/product';
import { Breadcrumbs, CtaBand, PageHero, PlanBadge, ProductSubnav, SampleDataFrame, Section, SectionHeading, SitePage } from '../components/site';
import { DashboardPreview, exampleEarly, exampleResults } from '../components/site/Previews';

export const metadata = pageMetadata({
    path: '/experiment-analytics',
    title: 'Experiment analytics: conversion rates, intervals and significance',
    description: 'How FreeABTest reports an A/B test: conversion rate, lift, 95% Wilson intervals, chance to beat control, peeking-safe sequential significance, sample ratio checks, funnels, revenue and segments.',
});

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

const COLUMNS: [string, string][] = [
    ['Visitors', 'Unique visitors with at least one event for the version.'],
    ['Conversions', 'Unique visitors who completed the goal at least once.'],
    ['Conversion rate', 'Conversions divided by visitors.'],
    ['Lift vs control', 'The relative change against the control. +20% means the version converts 1.2 times as often.'],
    ['95% interval', 'The range the true conversion rate very likely falls in, given the data so far.'],
    ['Chance to beat control', 'How likely the version is truly better than the control. Shown once both have 100 visitors.'],
];

export default function ExperimentAnalyticsPage() {
    const r = exampleResults();
    const early = exampleEarly();
    const ex = WORKED_EXAMPLE;
    const lo = Math.min(r.control.ci.lower, r.variant.ci.lower) - 0.005;
    const hi = Math.max(r.control.ci.upper, r.variant.ci.upper) + 0.005;
    const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
    return (
        <SitePage>
            <PageHero eyebrow="Experiment analytics" title="Results you can read, and a verdict you can trust"
                lede="Every test reports conversion rates with intervals, the lift against the control, the chance to beat it, and a sequential significance test that stays valid however often you check."
                actions={[{ href: '/signin', label: 'Start for free' }, { href: '/docs/results', label: 'Read the results guide' }]}>
                <Breadcrumbs items={[{ href: '/product', label: 'Product' }, { href: '/experiment-analytics', label: 'Experiment analytics' }]} />
            </PageHero>
            <ProductSubnav current="/experiment-analytics" />

            <Section>
                <SectionHeading eyebrow="The Results tab" title="One screen per test" lede="An illustration of the experiments list and the results tab. The numbers are example data computed with the same statistics the app uses." />
                <SampleDataFrame className="mt-10"><DashboardPreview /></SampleDataFrame>
            </Section>

            <Section tone="surface" className="border-t border-line">
                <div className="grid gap-12 lg:grid-cols-2">
                    <div>
                        <SectionHeading eyebrow="The results table" title="What each column means" />
                        <dl className="mt-8 divide-y divide-line rounded-xl border border-line bg-white">
                            {COLUMNS.map(([k, v]) => (
                                <div key={k} className="grid gap-1 p-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
                                    <dt className="text-[15px] font-semibold text-navy-950">{k}</dt>
                                    <dd className="text-[15px] leading-[1.55] text-muted-strong">{v}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                    <div>
                        <SectionHeading eyebrow="The summary" title="Four verdicts, in plain words" />
                        <ul className="mt-8 grid gap-3">
                            {VERDICTS.map((v) => (
                                <li key={v.label} className="rounded-xl border border-line bg-white p-4">
                                    <p className="text-[15px] font-semibold text-navy-950">{v.label}</p>
                                    <p className="mt-1 text-[15px] leading-[1.55] text-muted-strong">{v.meaning}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </Section>

            <Section id="worked-example" labelledBy="worked-title">
                <SectionHeading id="worked-title" eyebrow="Worked example" title="Reading one test from start to finish"
                    lede={`A pricing page test with ${fmt(ex.control.visitors)} visitors in each version. Example numbers, computed with the statistics code the app uses.`} />
                <div className="mt-10 grid gap-6 lg:grid-cols-3">
                    <article className="rounded-xl border border-line p-6">
                        <h3 className="text-[17px] font-semibold text-navy-950">1. Rates and intervals</h3>
                        <p className="mt-2 text-[15px] leading-[1.6] text-muted-strong">Each rate gets a 95% Wilson score interval, which stays accurate for small samples and low rates.</p>
                        <div className="mt-5 grid gap-4" role="img" aria-label={`Control ${pct(r.control.conversion_rate)}, interval ${pct(r.control.ci.lower)} to ${pct(r.control.ci.upper)}. Variant B ${pct(r.variant.conversion_rate)}, interval ${pct(r.variant.ci.lower)} to ${pct(r.variant.ci.upper)}.`}>
                            {[{ n: 'Control', d: r.control, c: 'bg-slate-400' }, { n: 'Variant B', d: r.variant, c: 'bg-accent-600' }].map((row) => (
                                <div key={row.n}>
                                    <div className="flex justify-between text-[13px] tabular-nums text-muted-strong"><span>{row.n}</span><span>{pct(row.d.conversion_rate)}</span></div>
                                    <div className="relative mt-1.5 h-2.5 rounded-full bg-surface">
                                        <span className={`absolute inset-y-0 rounded-full ${row.c}`} style={{ left: x(row.d.ci.lower), width: `calc(${x(row.d.ci.upper)} - ${x(row.d.ci.lower)})` }} />
                                        <span className="absolute -top-1 h-4.5 w-0.5 bg-navy-950" style={{ left: x(row.d.conversion_rate) }} />
                                    </div>
                                    <p className="mt-1 text-[12px] tabular-nums text-muted">{pct(row.d.ci.lower)} to {pct(row.d.ci.upper)}</p>
                                </div>
                            ))}
                        </div>
                    </article>
                    <article className="rounded-xl border border-line p-6">
                        <h3 className="text-[17px] font-semibold text-navy-950">2. Sequential significance</h3>
                        <p className="mt-2 text-[15px] leading-[1.6] text-muted-strong">The p-value stays valid at every look, so you can stop when it drops below the bar of {r.seq.threshold}.</p>
                        <table className="mt-5 w-full text-left text-[14px] tabular-nums">
                            <thead><tr className="text-[12px] text-muted"><th className="pb-2 font-medium">Visitors each</th><th className="pb-2 font-medium">p-value</th><th className="pb-2 font-medium">Verdict</th></tr></thead>
                            <tbody className="divide-y divide-line">
                                <tr><td className="py-2">{fmt(ex.early.visitors)}</td><td>{early.seq.p_value.toFixed(3)}</td><td>Keep running</td></tr>
                                <tr><td className="py-2">{fmt(ex.control.visitors)}</td><td>{r.seq.p_value.toFixed(3)}</td><td className="font-semibold text-accent-700">Significant</td></tr>
                            </tbody>
                        </table>
                        <p className="mt-3 text-[13px] leading-[1.5] text-muted">Same conversion rates at both sizes. The extra visitors are what make the difference clear.</p>
                    </article>
                    <article className="rounded-xl border border-line p-6">
                        <h3 className="text-[17px] font-semibold text-navy-950">3. Lift and chance to beat</h3>
                        <p className="mt-2 text-[15px] leading-[1.6] text-muted-strong">Lift says how big the change is. Chance to beat control says how likely it is to be real.</p>
                        <dl className="mt-5 grid grid-cols-2 gap-3 tabular-nums">
                            <div className="rounded-lg bg-surface p-3"><dt className="text-[12px] text-muted">Lift</dt><dd className="mt-1 text-[20px] font-semibold text-accent-700">+{pct(r.lift, 0)}</dd>{r.liftCi && <dd className="text-[12px] text-muted">+{pct(r.liftCi.lower, 0)} to +{pct(r.liftCi.upper, 0)}</dd>}</div>
                            <div className="rounded-lg bg-surface p-3"><dt className="text-[12px] text-muted">Chance to beat</dt><dd className="mt-1 text-[20px] font-semibold text-navy-950">{pct(r.chance)}</dd></div>
                        </dl>
                    </article>
                </div>
                <div className="mt-8 grid gap-4 text-[15px] leading-[1.6] text-muted-strong md:grid-cols-2">
                    <p><strong className="text-navy-950">Sample ratio check.</strong> From 100 visitors, the results page warns you when the split is far from what you set and the chance of luck is under 0.1%. Fix the cause before you trust the numbers.</p>
                    <p><strong className="text-navy-950">Inconclusive is a result.</strong> Many tests end without a clear winner. The change did not matter much, so ship the simpler version and test a bolder idea.</p>
                </div>
                <p className="mt-6 text-[14px]"><Link href="/docs/results#significance" className="font-medium text-accent-700 hover:underline">How significance is calculated</Link></p>
            </Section>

            <Section tone="surface" className="border-t border-line">
                <SectionHeading eyebrow="Beyond the main goal" title="Reports that explain why a version wins" />
                <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {ANALYTICS_EXTRAS.map((a) => (
                        <li key={a.title} className="flex flex-col rounded-xl border border-line bg-white p-5">
                            <div className="flex items-start justify-between gap-2"><h3 className="text-[16px] font-semibold text-navy-950">{a.title}</h3></div>
                            <PlanBadge plan={a.plan} className="mt-2 self-start" />
                            <p className="mt-3 flex-1 text-[14px] leading-[1.55] text-muted-strong">{a.body}</p>
                            <Link href={a.href} className="mt-4 text-[14px] font-medium text-accent-700 hover:underline">Read more</Link>
                        </li>
                    ))}
                </ul>
                <p className="mt-6 text-[14px] text-muted">Funnels and segments help you find where a change works. They do not replace the significance test on the primary goal.</p>
            </Section>

            <CtaBand title="See your own numbers, not ours." body={FREE_LINE} href="/signin" label="Start for free" />
        </SitePage>
    );
}
