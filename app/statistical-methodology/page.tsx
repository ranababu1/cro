import Link from 'next/link';
import { pageMetadata } from '@/lib/site/meta';
import { fmt } from '@/lib/site/home';
import { FREE_LINE, VERDICTS } from '@/lib/site/product';
import { CONSTANTS as K, SUMMARY, REVENUE_EXAMPLE, SRM_EXAMPLES, methodologyExamples } from '@/lib/site/methodology';
import { Diagram } from '../docs/_components/Diagrams';
import { Breadcrumbs, CtaBand, PageHero, PlanBadge, SampleDataFrame, Section, SectionHeading, SitePage } from '../components/site';

export const metadata = pageMetadata({
    path: '/statistical-methodology',
    title: 'Statistical methodology: how A/B test results are calculated',
    description: 'The exact methods behind FreeABTest results: Wilson intervals, the mSPRT sequential test with a Bonferroni split, chance to beat control, Newcombe lift intervals, the sample ratio check and Welch\'s test for revenue, with formulas and worked examples.',
});

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const pv = (p: number) => (p < 0.001 ? 'below 0.001' : p.toFixed(3));

function Formula({ label, lines }: { label: string; lines: string[] }) {
    return (
        <figure className="min-w-0 rounded-xl border border-line bg-surface">
            <figcaption className="border-b border-line px-4 py-2 text-[12px] font-medium text-muted">{label}</figcaption>
            <pre className="overflow-x-auto px-4 py-4 font-mono text-[13.5px] leading-[1.8] text-navy-950">{lines.join('\n')}</pre>
        </figure>
    );
}

function Prose({ children }: { children: React.ReactNode }) {
    return <div className="space-y-4 text-[16px] leading-[1.65] text-muted-strong">{children}</div>;
}

const CONTENTS: [string, string][] = [
    ['summary', 'At a glance'], ['rates', 'Rates and intervals'], ['sequential', 'Sequential significance'], ['chance', 'Chance to beat control'],
    ['lift', 'Lift interval'], ['srm', 'Sample ratio check'], ['revenue', 'Revenue'], ['sample-size', 'Visitors needed'],
    ['fixed', 'The fixed-sample z-test'], ['auto-shift', 'Auto-shift'], ['reading', 'Reading a result'], ['numerics', 'Numerical details'],
];

export default function StatisticalMethodologyPage() {
    const m = methodologyExamples();
    const ex = m.ex;
    return (
        <SitePage>
            <PageHero eyebrow="Statistical methodology" title="How every result is calculated"
                lede="The methods behind each number on the results page, with the formulas and worked examples. The examples are computed by the same code the app runs."
                actions={[{ href: '/signin', label: 'Start for free' }, { href: '/docs/results', label: 'Read the results guide' }]}>
                <Breadcrumbs items={[{ href: '/experiment-analytics', label: 'Experiment analytics' }, { href: '/statistical-methodology', label: 'Statistical methodology' }]} />
            </PageHero>

            <nav aria-label="On this page" className="border-b border-line bg-white">
                <ul className="mx-auto flex max-w-[1200px] gap-x-5 gap-y-2 overflow-x-auto px-5 py-3 text-[14px] text-muted-strong sm:px-8 lg:flex-wrap">
                    {CONTENTS.map(([id, label]) => <li key={id} className="shrink-0"><a href={`#${id}`} className="hover:text-navy-950">{label}</a></li>)}
                </ul>
            </nav>

            <Section id="summary" labelledBy="summary-title">
                <SectionHeading id="summary-title" eyebrow="At a glance" title="Which method produces which number"
                    lede={`Every test, whether it runs in the browser or on your server, goes through the same calculations. No verdict is given until each version has ${K.minVisitors} visitors.`} />
                <ul className="mt-10 divide-y divide-line rounded-xl border border-line bg-white md:hidden">
                    {SUMMARY.map((s) => (
                        <li key={s.number} className="p-4"><a href={`#${s.anchor}`} className="font-semibold text-navy-950 hover:underline">{s.number}</a><p className="mt-1 text-[14px] text-muted-strong">{s.method}</p><p className="mt-1 text-[12px] text-muted">Shown: {s.when}</p></li>
                    ))}
                </ul>
                <div className="mt-10 hidden overflow-x-auto rounded-xl border border-line md:block">
                    <table className="[&_td]:pr-3 [&_th]:pr-3 w-full text-left text-[14px]">
                        <thead className="border-b border-line bg-surface text-[12px] uppercase tracking-[0.06em] text-muted">
                            <tr><th className="px-4 py-3 font-semibold">Number</th><th className="px-4 py-3 font-semibold">Method</th><th className="px-4 py-3 font-semibold">Shown when</th></tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {SUMMARY.map((s) => (
                                <tr key={s.number}><td className="px-4 py-3 font-medium"><a href={`#${s.anchor}`} className="text-navy-950 hover:underline">{s.number}</a></td><td className="px-4 py-3 text-muted-strong">{s.method}</td><td className="px-4 py-3 text-muted-strong">{s.when}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="mt-4 text-[14px] text-muted">The worked examples use one pricing page test: {fmt(ex.control.visitors)} visitors per version, {fmt(ex.control.conversions)} conversions on the control and {fmt(ex.variant.conversions)} on the variant. Example numbers.</p>
            </Section>

            <Section id="rates" tone="surface" className="border-t border-line" labelledBy="rates-title">
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                    <div>
                        <SectionHeading id="rates-title" eyebrow="Rates and intervals" title="Conversion rate with a Wilson interval" />
                        <div className="mt-6"><Prose>
                            <p>A version&apos;s visitors are the unique visitors with at least one event in it. Its conversions are the unique visitors who completed the goal at least once. The conversion rate is conversions divided by visitors.</p>
                            <p>Each rate gets a 95% Wilson score interval. Unlike the simple normal interval, it stays inside 0% to 100% and keeps its coverage for small samples and rates near zero, which is where most conversion rates sit.</p>
                        </Prose></div>
                    </div>
                    <div className="grid gap-4">
                        <Formula label="Wilson score interval, z = 1.96" lines={['p = x / n', 'center = (p + z²/2n) / (1 + z²/n)', 'margin = z / (1 + z²/n) × √( p(1 − p)/n + z²/4n² )', 'interval = center ± margin']} />
                        <SampleDataFrame>
                            <dl className="grid gap-3 p-5 text-[14px] tabular-nums sm:grid-cols-2">
                                <div><dt className="text-muted">Control, {fmt(ex.control.conversions)} / {fmt(ex.control.visitors)}</dt><dd className="mt-1 text-[18px] font-semibold text-navy-950">{pct(m.control.conversion_rate)}</dd><dd className="text-muted-strong">{pct(m.control.ci.lower, 2)} to {pct(m.control.ci.upper, 2)}</dd></div>
                                <div><dt className="text-muted">Variant, {fmt(ex.variant.conversions)} / {fmt(ex.variant.visitors)}</dt><dd className="mt-1 text-[18px] font-semibold text-accent-700">{pct(m.variant.conversion_rate)}</dd><dd className="text-muted-strong">{pct(m.variant.ci.lower, 2)} to {pct(m.variant.ci.upper, 2)}</dd></div>
                            </dl>
                        </SampleDataFrame>
                        <figure className="rounded-xl border border-line bg-white p-4"><Diagram name="interval" /><figcaption className="mt-3 text-center text-[12px] text-muted">Illustration. Separated intervals point to a real difference. Overlap does not prove there is none; the significance test decides.</figcaption></figure>
                    </div>
                </div>
            </Section>

            <Section id="sequential" labelledBy="seq-title">
                <SectionHeading id="seq-title" eyebrow="Sequential significance" title="A verdict that stays valid however often you look"
                    lede="Each variant is compared with the control by a mixture sequential probability ratio test (mSPRT). Its p-value is always valid: checking every hour and stopping at the first significant result keeps the chance of a false winner at or below 5%." />
                <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2">
                    <div className="grid gap-4">
                        <Formula label="mSPRT on the difference of two rates" lines={[
                            'd  = p₂ − p₁                (variant minus control)',
                            'p̄  = pooled rate of both versions',
                            'V  = max(p₁(1 − p₁), p̄(1 − p̄)) / n₁',
                            '   + max(p₂(1 − p₂), p̄(1 − p̄)) / n₂',
                            `τ  = max(${K.tauFloor}, ${K.tauRelative} × p̄)`,
                            'Λ  = √( V / (V + τ²) ) × exp( τ²d² / (2V(V + τ²)) )',
                            'p  = min(1, 1 / Λ)',
                        ]} />
                        <Prose>
                            <p>Λ is the likelihood ratio of &quot;there is a difference&quot; against &quot;there is none&quot;, averaged over a normal prior N(0, τ²) on the true difference. τ is the effect size the test is tuned for: {K.tauRelative * 100}% of the pooled rate, never below {K.tauFloor}. Using the larger of each version&apos;s variance and the pooled variance keeps V above zero when a version has 0% or 100%.</p>
                            <p>A variant is significant when p is below {K.alpha} divided by the number of variants compared with the control (a Bonferroni split). With three variants the bar is {(K.alpha / 3).toFixed(4)}. The winner is the best-converting variant that is significant and above the control. The control is ahead only when every variant is significantly worse.</p>
                        </Prose>
                    </div>
                    <div className="grid content-start gap-4">
                        <SampleDataFrame>
                            <div className="p-5 pt-10">
                                <table className="[&_td]:pr-3 [&_th]:pr-3 w-full text-left text-[14px] tabular-nums">
                                    <thead><tr className="text-[12px] text-muted"><th className="pb-2 font-medium">Visitors</th><th className="pb-2 font-medium">Variants</th><th className="pb-2 font-medium">p</th><th className="pb-2 font-medium">Bar</th><th className="pb-2 font-medium">Verdict</th></tr></thead>
                                    <tbody className="divide-y divide-line">
                                        <tr><td className="py-2">{fmt(ex.early.visitors)}</td><td>1</td><td>{m.early.seq.p_value.toFixed(3)}</td><td>{m.early.seq.threshold}</td><td>Keep running</td></tr>
                                        <tr><td className="py-2">{fmt(ex.control.visitors)}</td><td>1</td><td>{m.seq.p_value.toFixed(3)}</td><td>{m.seq.threshold}</td><td className="font-semibold text-accent-700">Significant</td></tr>
                                        <tr><td className="py-2">{fmt(ex.control.visitors)}</td><td>3</td><td>{m.seqThree.p_value.toFixed(3)}</td><td>{m.seqThree.threshold.toFixed(4)}</td><td>Keep running</td></tr>
                                    </tbody>
                                </table>
                                <p className="mt-3 text-[13px] leading-[1.5] text-muted">Same rates in every row: 5.0% against 6.5%. At {fmt(ex.control.visitors)} each, τ = {m.tau.toFixed(4)} from a pooled rate of {pct(m.pooled, 2)}.</p>
                            </div>
                        </SampleDataFrame>
                        <div className="rounded-xl border border-line p-5">
                            <h3 className="text-[16px] font-semibold text-navy-950">The price of looking freely</h3>
                            <p className="mt-2 text-[14px] leading-[1.6] text-muted-strong">For the same observed lift, the sequential test needs about 2 to 3 times the visitors of a test you look at once. Visitors per version before the lift first clears 0.05:</p>
                            <table className="[&_td]:pr-3 [&_th]:pr-3 mt-3 w-full text-left text-[14px] tabular-nums">
                                <thead><tr className="text-[12px] text-muted"><th className="pb-2 font-medium">Baseline</th><th className="pb-2 font-medium">Lift</th><th className="pb-2 font-medium">Single look</th><th className="pb-2 font-medium">Sequential</th></tr></thead>
                                <tbody className="divide-y divide-line">
                                    {m.cost.map((c) => <tr key={`${c.baseline}-${c.lift}`}><td className="py-2">{pct(c.baseline, 0)}</td><td>{pct(c.lift, 0)}</td><td>{fmt(c.fixed)}</td><td>{fmt(c.sequential)}</td></tr>)}
                                </tbody>
                            </table>
                            <p className="mt-3 text-[13px] text-muted">Computed by stepping the visitor count in 50s with the observed rates held fixed.</p>
                        </div>
                    </div>
                </div>
            </Section>

            <Section id="chance" tone="surface" className="border-t border-line" labelledBy="chance-title">
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                    <div>
                        <SectionHeading id="chance-title" eyebrow="Chance to beat control" title="How likely the variant is truly better" />
                        <div className="mt-6"><Prose>
                            <p>Each rate starts from a flat Beta(1, 1) prior, so the result reflects only your data. After x conversions from n visitors the rate follows Beta(1 + x, 1 + n − x). The chance to beat control is the probability that the variant&apos;s rate is higher, using a normal approximation to the difference of the two posteriors.</p>
                            <p>It is shown once both versions have {K.minVisitors} visitors. It moves quickly on small samples: in the early example it is already {m.earlyChanceLabel} while the sequential test says keep running. Decide on the significance verdict.</p>
                        </Prose></div>
                    </div>
                    <div className="grid content-start gap-4">
                        <Formula label="Chance to beat control" lines={['a = 1 + x,   b = 1 + n − x', 'mean = a / (a + b)', 'var  = ab / ((a + b)² (a + b + 1))', 'P = Φ( (mean_B − mean_A) / √(var_A + var_B) )']} />
                        <SampleDataFrame>
                            <dl className="grid grid-cols-2 gap-3 p-5 tabular-nums">
                                <div><dt className="text-[12px] text-muted">{fmt(ex.early.visitors)} visitors each</dt><dd className="mt-1 text-[20px] font-semibold text-navy-950">{m.earlyChanceLabel}</dd></div>
                                <div><dt className="text-[12px] text-muted">{fmt(ex.control.visitors)} visitors each</dt><dd className="mt-1 text-[20px] font-semibold text-accent-700">{m.chanceLabel}</dd></div>
                            </dl>
                        </SampleDataFrame>
                    </div>
                </div>
            </Section>

            <Section id="lift" labelledBy="lift-title">
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                    <div>
                        <SectionHeading id="lift-title" eyebrow="Lift interval" title="How big the change is, with its range" />
                        <div className="mt-6"><Prose>
                            <p>Lift is the relative change against the control: (p₂ − p₁) / p₁. In live stats it comes with a 95% interval built with Newcombe&apos;s hybrid score method, which combines the two Wilson intervals into an interval on the difference and then divides it by the control rate.</p>
                            <p>It needs at least one conversion on the control. The interval tells you the plausible size of the effect; it does not replace the sequential verdict.</p>
                        </Prose></div>
                    </div>
                    <div className="grid content-start gap-4">
                        <Formula label="Newcombe hybrid score interval, relative to the control" lines={['[l₁, u₁], [l₂, u₂] = Wilson intervals of p₁, p₂', 'd = p₂ − p₁', 'lower = d − √( (p₂ − l₂)² + (u₁ − p₁)² )', 'upper = d + √( (u₂ − p₂)² + (p₁ − l₁)² )', 'lift interval = [lower / p₁, upper / p₁]']} />
                        <SampleDataFrame>
                            <div className="p-5 tabular-nums"><p className="text-[12px] text-muted">Worked example</p><p className="mt-1 text-[20px] font-semibold text-accent-700">+{pct(m.lift, 0)}</p><p className="text-[14px] text-muted-strong">95% interval +{pct(m.liftCi.lower, 0)} to +{pct(m.liftCi.upper, 0)}</p></div>
                        </SampleDataFrame>
                    </div>
                </div>
            </Section>

            <Section id="srm" tone="surface" className="border-t border-line" labelledBy="srm-title">
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                    <div>
                        <SectionHeading id="srm-title" eyebrow="Sample ratio check" title="A warning when visitors are not split as set" />
                        <div className="mt-6"><Prose>
                            <p>The visitors assigned to each active version are compared with the share its weight should give, using a chi-square goodness of fit test. The results page warns you when p is below {K.srmP} and the test has at least {K.srmMin} visitors.</p>
                            <p>A mismatch this unlikely is almost always a fault: a redirect that drops visitors, a broken variation page, or the snippet missing on one page. Tests that use auto-shift skip the check, because they move the split on purpose.</p>
                        </Prose></div>
                    </div>
                    <div className="grid content-start gap-4">
                        <Formula label="Chi-square goodness of fit" lines={['Eᵢ = total visitors × weightᵢ / Σ weights', 'χ² = Σ (Oᵢ − Eᵢ)² / Eᵢ', 'degrees of freedom = versions − 1', `warn when p < ${K.srmP} and total ≥ ${K.srmMin}`]} />
                        <SampleDataFrame>
                            <table className="[&_td]:pr-3 [&_th]:pr-3 mx-5 mb-5 mt-10 w-[calc(100%-2.5rem)] text-left text-[14px] tabular-nums">
                                <thead><tr className="text-[12px] text-muted"><th className="pb-2 font-medium">50/50 test</th><th className="pb-2 font-medium">χ²</th><th className="pb-2 font-medium">p</th><th className="pb-2 font-medium">Result</th></tr></thead>
                                <tbody className="divide-y divide-line">
                                    <tr><td className="py-2">{fmt(SRM_EXAMPLES.fine[0])} / {fmt(SRM_EXAMPLES.fine[1])}</td><td>{m.srmFine.chi_square.toFixed(2)}</td><td>{pv(m.srmFine.p_value)}</td><td>No warning</td></tr>
                                    <tr><td className="py-2">{fmt(SRM_EXAMPLES.bad[0])} / {fmt(SRM_EXAMPLES.bad[1])}</td><td>{m.srmBad.chi_square.toFixed(0)}</td><td>{pv(m.srmBad.p_value)}</td><td className="font-semibold text-navy-950">Warning</td></tr>
                                </tbody>
                            </table>
                        </SampleDataFrame>
                    </div>
                </div>
            </Section>

            <Section id="revenue" labelledBy="revenue-title">
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                    <div>
                        <div className="flex flex-wrap items-center gap-3"><SectionHeading id="revenue-title" eyebrow="Revenue" title="Revenue per visitor with Welch's test" /></div>
                        <PlanBadge plan="Paid plans" className="mt-4" />
                        <div className="mt-6"><Prose>
                            <p>Revenue per visitor divides a version&apos;s revenue by all of its visitors, buyers or not, so it rewards both more buyers and bigger orders. The best variant by revenue per visitor is compared with the control using Welch&apos;s t-test, which allows the two versions to have different spreads, with a normal approximation that is accurate at these sample sizes.</p>
                            <p>The verdict appears once both versions have {K.revenueMin} visitors. It uses a fixed 5% bar rather than the sequential test, so plan the sample size before you start and read revenue alongside the conversion verdict. A few large orders can move the average, so revenue needs more visitors than a conversion rate.</p>
                        </Prose></div>
                    </div>
                    <div className="grid content-start gap-4">
                        <Formula label="Welch's test, normal approximation" lines={['mean = revenue / visitors      (non-buyers count as 0)', 's² = sample variance of revenue per visitor', 'z = |mean_B − mean_A| / √( s²_A/n_A + s²_B/n_B )', 'p = 2 × (1 − Φ(z)),  significant when p < 0.05']} />
                        <SampleDataFrame>
                            <div className="p-5 text-[14px] tabular-nums">
                                <p className="pr-28 text-muted-strong">Control ${REVENUE_EXAMPLE.control.mean.toFixed(2)} per visitor (standard deviation ${REVENUE_EXAMPLE.control.sd}), variant ${REVENUE_EXAMPLE.variant.mean.toFixed(2)} (${REVENUE_EXAMPLE.variant.sd}).</p>
                                <table className="[&_td]:pr-3 [&_th]:pr-3 mt-3 w-full text-left">
                                    <thead><tr className="text-[12px] text-muted"><th className="pb-2 font-medium">Visitors each</th><th className="pb-2 font-medium">p</th><th className="pb-2 font-medium">Verdict</th></tr></thead>
                                    <tbody className="divide-y divide-line">
                                        <tr><td className="py-2">{fmt(REVENUE_EXAMPLE.small)}</td><td>{m.revenueSmall.toFixed(3)}</td><td>Not significant</td></tr>
                                        <tr><td className="py-2">{fmt(REVENUE_EXAMPLE.large)}</td><td>{m.revenueLarge.toFixed(3)}</td><td className="font-semibold text-accent-700">Significant</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </SampleDataFrame>
                    </div>
                </div>
            </Section>

            <Section id="sample-size" tone="surface" className="border-t border-line" labelledBy="ss-title">
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                    <div>
                        <SectionHeading id="ss-title" eyebrow="Visitors needed" title="Planning a test's sample size" />
                        <div className="mt-6"><Prose>
                            <p>The test planner estimates visitors per version with the standard fixed-sample formula at 95% confidence and 80% power. With more than two versions it splits the 5% across the comparisons with the control, as the results do.</p>
                            <p>To detect a 20% lift on a 5% baseline you need {fmt(m.sampleSize)} visitors per version for a single planned look. Plan for about 2 to 3 times that for the sequential test to call the same lift, or less if the real lift turns out bigger. Run for at least one full week either way.</p>
                        </Prose></div>
                    </div>
                    <Formula label="Visitors per version" lines={['p₁ = baseline,  p₂ = baseline × (1 + lift)', 'δ = p₂ − p₁,   p̄ = (p₁ + p₂) / 2', 'n = 2 p̄(1 − p̄) (z₁₋α/₂ + z₁₋β)² / δ²', 'z₁₋α/₂ = 1.96 (α = 0.05),  z₁₋β = 0.84 (80% power)']} />
                </div>
            </Section>

            <Section id="fixed" labelledBy="fixed-title">
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                    <div>
                        <SectionHeading id="fixed-title" eyebrow="The fixed-sample z-test" title="Why it does not pick the winner" />
                        <div className="mt-6"><Prose>
                            <p>A two-proportion z-test is valid only if you look once, at a sample size chosen in advance. Stopping the first time it dips below 0.05 pushes the real false winner rate far above 5%.</p>
                            <p>It is still calculated for the best variant and returned by the REST API as <code className="rounded bg-surface px-1 font-mono text-[14px]">statistical_significance</code>, for teams who plan a single look. The dashboard verdict always comes from the sequential test.</p>
                        </Prose></div>
                    </div>
                    <SampleDataFrame>
                        <div className="p-5 text-[14px] tabular-nums">
                            <p className="pr-28 text-muted-strong">The early example: {fmt(ex.early.visitors)} visitors each, 5.0% against 6.5%.</p>
                            <dl className="mt-4 grid grid-cols-2 gap-3">
                                <div className="rounded-lg bg-surface p-3"><dt className="text-[12px] text-muted">z-test p</dt><dd className="mt-1 text-[20px] font-semibold text-navy-950">{m.early.fixed.p_value.toFixed(3)}</dd><dd className="text-[12px] text-muted">Looks significant</dd></div>
                                <div className="rounded-lg bg-surface p-3"><dt className="text-[12px] text-muted">Sequential p</dt><dd className="mt-1 text-[20px] font-semibold text-navy-950">{m.early.seq.p_value.toFixed(3)}</dd><dd className="text-[12px] text-muted">Keep running</dd></div>
                            </dl>
                            <p className="mt-3 text-[13px] text-muted">If you had been checking daily, the z-test result would not hold up. The sequential one does.</p>
                        </div>
                    </SampleDataFrame>
                </div>
            </Section>

            <Section id="auto-shift" tone="surface" className="border-t border-line" labelledBy="shift-title">
                <SectionHeading id="shift-title" eyebrow="Auto-shift" title="Moving traffic toward the leader" />
                <PlanBadge plan="Growth and above" className="mt-4" />
                <div className="mt-6 max-w-[720px]"><Prose>
                    <p>With auto-shift on, the split is recomputed about every {K.shiftHours === 1 ? 'hour' : `${K.shiftHours} hours`} once every active version has {K.shiftMin} visitors. Each version&apos;s chance of being the best is estimated by drawing from its Beta(1 + conversions, 1 + non-conversions) posterior (Thompson sampling), and new visitors are split in proportion. Every version keeps at least {K.shiftFloor}% of new visitors, or less with more than {50 / K.shiftFloor} versions, so each one keeps collecting data. Visitors already in the test keep their version.</p>
                    <p>Because the split moves, the sample ratio check is off for these tests. For the clearest answer to which version is better, keep a fixed split.</p>
                </Prose></div>
            </Section>

            <Section id="reading" labelledBy="reading-title">
                <SectionHeading id="reading-title" eyebrow="Reading a result" title="What each verdict means and what to do" />
                <ul className="mt-10 grid gap-4 md:grid-cols-2">
                    {VERDICTS.map((v) => (
                        <li key={v.label} className="rounded-xl border border-line p-5"><h3 className="text-[16px] font-semibold text-navy-950">{v.label}</h3><p className="mt-2 text-[14px] leading-[1.6] text-muted-strong">{v.meaning}</p></li>
                    ))}
                </ul>
                <ul className="mt-8 grid gap-4 text-[15px] leading-[1.6] text-muted-strong md:grid-cols-3">
                    <li><strong className="text-navy-950">Pick the primary goal first.</strong> The winner is decided on it. Checking many goals raises the chance one looks significant by luck.</li>
                    <li><strong className="text-navy-950">Run a full week.</strong> The sequential verdict holds whenever you stop, but weekday and weekend visitors often behave differently.</li>
                    <li><strong className="text-navy-950">Inconclusive is a result.</strong> The change did not matter much. Ship the simpler version and test a bolder idea.</li>
                </ul>
                <p className="mt-6 text-[14px] text-muted-strong">Segments split the 5% across every comparison in the view, so a segment is marked only when it clears that stricter bar. Treat a standout segment as a lead for a follow-up test.</p>
            </Section>

            <Section id="numerics" tone="surface" className="border-t border-line" labelledBy="num-title">
                <SectionHeading id="num-title" eyebrow="Numerical details" title="How the distributions are computed" />
                <ul className="mt-8 grid gap-4 md:grid-cols-2">
                    <li className="rounded-xl border border-line bg-white p-5 text-[14px] leading-[1.6] text-muted-strong"><strong className="text-navy-950">Normal distribution.</strong> Φ uses the Abramowitz and Stegun polynomial approximation (formula 26.2.17). Its inverse, used for z values such as 1.96, uses Acklam&apos;s rational approximation, with relative error below 1.2 × 10⁻⁹.</li>
                    <li className="rounded-xl border border-line bg-white p-5 text-[14px] leading-[1.6] text-muted-strong"><strong className="text-navy-950">Chi-square p-values.</strong> From the regularized upper incomplete gamma function, with a series or continued fraction depending on the value, and the Lanczos approximation of the log-gamma function.</li>
                    <li className="rounded-xl border border-line bg-white p-5 text-[14px] leading-[1.6] text-muted-strong"><strong className="text-navy-950">Beta draws for auto-shift.</strong> 4,000 draws per update from Gamma samples (Marsaglia and Tsang), with a seeded generator so an update can be reproduced.</li>
                    <li className="rounded-xl border border-line bg-white p-5 text-[14px] leading-[1.6] text-muted-strong"><strong className="text-navy-950">Where to read more.</strong> The <Link href="/docs/results" className="font-medium text-accent-700 hover:underline">results guide</Link> explains each screen, <Link href="/experiment-analytics" className="font-medium text-accent-700 hover:underline">experiment analytics</Link> shows the reports, and the <Link href="/docs/rest-api" className="font-medium text-accent-700 hover:underline">REST API</Link> returns the results of each test.</li>
                </ul>
            </Section>

            <CtaBand title="Run a test and read it with confidence." body={FREE_LINE} href="/signin" label="Start for free" />
        </SitePage>
    );
}
