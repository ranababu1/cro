import type { Metadata } from 'next';
import Link from 'next/link';
import { aiConfigured } from '@/lib/ai/crypto';
import { SITE_URL, ldJson } from '@/lib/blog';
import { FREE_MONTHLY_VISITORS } from '@/lib/plans';
import { CAPABILITIES, HOME_FAQ, MARKETER_USE_CASES, PLAN_SUMMARY, STEPS, WORKED_EXAMPLE, fmt } from '@/lib/site/home';
import { ArrowIcon, Container, CtaBand, SampleDataFrame, Section, SectionHeading, SiteButton, SiteFooter, SiteHeader } from './components/site';
import { DashboardPreview, HeroPreview, exampleEarly, exampleResults } from './components/site/Previews';

// AI suggestions (Growth and Enterprise, with the customer's own provider key). The homepage only talks about them
// once they are switched on for the site, so the claim never goes live before the feature does.
const aiFeatures = [
    { title: 'Test ideas from any page', body: 'Enter a page and a goal. Get up to 5 test ideas with a hypothesis, the change to make and a priority, ready for your test planner.' },
    { title: 'Hypotheses in one click', body: 'The new test wizard suggests a hypothesis and an expected outcome from the test name, page and goals.' },
    { title: 'Headlines and button copy', body: 'Select text in the visual editor and get other versions to test against it.' },
    { title: 'Results in plain words', body: 'A short summary of what your numbers mean, built on the statistical verdict and never against it.' },
    { title: 'Follow-up tests', body: 'When a test ends, get ideas for the next one based on what it showed.' },
];

const HOME_TITLE = 'freeabtest.com: A/B testing for marketers and developers';
const HOME_DESCRIPTION = 'Better decisions, backed by experiments. Run A/B and split URL tests with one script tag or a REST API, and read results from a peeking-safe sequential test. Free plan, no card.';
const HOME_TITLE_AI = 'freeabtest.com: AI-powered A/B testing platform';
const HOME_DESCRIPTION_AI = 'Better decisions, backed by experiments. AI-powered A/B testing: run tests with one script tag or a REST API, read peeking-safe results, and on Growth get test ideas and result summaries from your own AI key.';

export function generateMetadata(): Metadata {
    const base = { alternates: { canonical: `${SITE_URL}/` } };
    if (!aiConfigured()) return { ...base, title: { absolute: HOME_TITLE }, description: HOME_DESCRIPTION, openGraph: { title: HOME_TITLE, description: HOME_DESCRIPTION, url: `${SITE_URL}/`, type: 'website' }, twitter: { card: 'summary', title: HOME_TITLE, description: HOME_DESCRIPTION } };
    return { ...base, title: { absolute: HOME_TITLE_AI }, description: HOME_DESCRIPTION_AI, openGraph: { title: HOME_TITLE_AI, description: HOME_DESCRIPTION_AI, url: `${SITE_URL}/`, type: 'website' }, twitter: { card: 'summary', title: HOME_TITLE_AI, description: HOME_DESCRIPTION_AI } };
}

const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: HOME_FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
};

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

const Check = () => (
    <svg viewBox="0 0 20 20" className="mt-[3px] h-4 w-4 shrink-0 text-accent-600" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 10 3.5 3.5L15 7" /></svg>
);

function Code({ label, code }: { label: string; code: string }) {
    return (
        <figure className="overflow-hidden rounded-xl border border-navy-800 bg-navy-950">
            <figcaption className="border-b border-white/10 px-4 py-2 text-[12px] font-medium text-slate-300">{label}</figcaption>
            <pre className="overflow-x-auto px-4 py-4 text-[13px] leading-[1.7] text-slate-100"><code className="font-mono">{code}</code></pre>
        </figure>
    );
}

export default function LandingPage() {
    const aiLive = aiConfigured();
    const r = exampleResults();
    const early = exampleEarly();
    const ex = WORKED_EXAMPLE;
    return (
        <div className="min-h-screen bg-white text-navy-950">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(JSON.stringify(faqJsonLd)) }} />
            <SiteHeader />
            <main>
                {/* 1. Hero */}
                <section className="border-b border-line bg-surface" aria-labelledby="hero-title">
                    <Container className="grid gap-12 py-14 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)] lg:items-center lg:gap-16">
                        <div>
                            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[13px] font-semibold tracking-[0.04em] text-accent-700 ring-1 ring-inset ring-line">
                                <span className="h-2 w-2 rounded-full bg-accent-600" aria-hidden />
                                {aiLive ? 'AI-POWERED A/B TESTING' : 'A/B TESTING FOR MARKETERS AND DEVELOPERS'}
                            </p>
                            <h1 id="hero-title" className="mt-6 text-[44px] font-bold leading-[1.05] tracking-[-0.035em] text-navy-950 sm:text-[56px] xl:text-[64px]">
                                Better decisions.<br />Backed by experiments.
                            </h1>
                            <p className="mt-6 max-w-[560px] text-[18px] leading-[1.6] text-muted-strong sm:text-[20px]">
                                Run A/B tests, understand your audience and improve your product without expensive experimentation platforms.
                            </p>
                            {aiLive && (
                                <p className="mt-3 max-w-[560px] text-[16px] leading-[1.6] text-muted-strong">
                                    AI suggestions plan tests and explain results in plain words, using your own AI provider key on Growth and above.
                                </p>
                            )}
                            <div className="mt-8 flex flex-wrap gap-3">
                                <SiteButton href="/signin" className="h-12 px-6 text-[16px]">Start experimenting <ArrowIcon /></SiteButton>
                                <SiteButton href="/features" variant="secondary" className="h-12 px-6 text-[16px]">Explore features</SiteButton>
                            </div>
                            <ul className="mt-10 grid gap-3 text-[15px] text-navy-950 sm:grid-cols-3 sm:gap-6">
                                <li className="flex gap-2"><Check /><span><strong className="font-semibold">Accessible.</strong> A free plan and no-code split URL tests.</span></li>
                                <li className="flex gap-2"><Check /><span><strong className="font-semibold">Developer friendly.</strong> One script tag or a REST API.</span></li>
                                <li className="flex gap-2"><Check /><span><strong className="font-semibold">Sound statistics.</strong> Results you can check at any time.</span></li>
                            </ul>
                        </div>
                        <SampleDataFrame><HeroPreview /></SampleDataFrame>
                    </Container>
                </section>

                {/* 2. Audience entry points */}
                <Section labelledBy="audiences-title">
                    <h2 id="audiences-title" className="sr-only">Who it is for</h2>
                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="flex flex-col rounded-2xl border border-line bg-white p-8">
                            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent-700">For marketers and product managers</p>
                            <h3 className="mt-3 text-[26px] font-semibold leading-[1.2] tracking-[-0.02em]">Improve what your customers experience.</h3>
                            <p className="mt-3 text-[16px] leading-[1.6] text-muted-strong">Test headlines, calls to action and whole landing pages, then see which version brings more signups. Most tests need no engineering time.</p>
                            <div className="mt-auto flex flex-wrap gap-x-6 gap-y-2 pt-6 text-[15px] font-medium">
                                <Link href="/solutions/marketing" className="text-accent-700 hover:underline">Marketing solutions</Link>
                                <Link href="/docs/quick-start" className="text-accent-700 hover:underline">Quick start</Link>
                            </div>
                        </div>
                        <div className="flex flex-col rounded-2xl border border-navy-800 bg-navy-950 p-8 text-white">
                            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent-100">For developers</p>
                            <h3 className="mt-3 text-[26px] font-semibold leading-[1.2] tracking-[-0.02em]">Build experimentation into your product.</h3>
                            <p className="mt-3 text-[16px] leading-[1.6] text-slate-300">Deterministic assignment, a small JavaScript API and REST endpoints for your backend, with public and secret keys per environment.</p>
                            <div className="mt-auto flex flex-wrap gap-x-6 gap-y-2 pt-6 text-[15px] font-medium">
                                <Link href="/developers" className="text-white underline-offset-4 hover:underline">Developer hub</Link>
                                <Link href="/docs/rest-api" className="text-white underline-offset-4 hover:underline">REST API</Link>
                            </div>
                        </div>
                    </div>
                </Section>

                {/* 3. Core capabilities */}
                <Section id="capabilities" tone="surface" labelledBy="capabilities-title">
                    <SectionHeading id="capabilities-title" eyebrow="Capabilities" title="Everything a test needs, from setup to decision" lede="Each item below is in the product today. Plan notes say where a feature needs a paid plan." />
                    <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {CAPABILITIES.map((c) => (
                            <li key={c.title} className="flex flex-col rounded-xl border border-line bg-white p-6">
                                <h3 className="text-[17px] font-semibold">{c.title}</h3>
                                <p className="mt-1.5 text-[14px] text-muted-strong">{c.body}</p>
                                <ul className="mt-4 space-y-2 text-[14px] leading-[1.5] text-navy-950">
                                    {c.points.map((p) => <li key={p} className="flex gap-2"><Check /><span>{p}</span></li>)}
                                </ul>
                                <Link href={c.href} className="mt-auto pt-5 text-[14px] font-medium text-accent-700 hover:underline">Learn more<span className="sr-only"> about {c.title.toLowerCase()}</span></Link>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-8 text-[15px]"><Link href="/features" className="font-medium text-accent-700 hover:underline">See every feature with its limits and plan</Link></p>
                </Section>

                {/* 4. How it works */}
                <Section id="how-it-works" labelledBy="how-title">
                    <SectionHeading id="how-title" eyebrow="How it works" title="From hypothesis to decision in seven steps" />
                    <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-7 lg:gap-3">
                        {STEPS.map((s, i) => (
                            <li key={s.title} className="relative flex gap-4 rounded-xl border border-line bg-white p-5 lg:flex-col lg:gap-3 lg:p-4">
                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold ${i === STEPS.length - 1 ? 'bg-accent-700 text-white' : 'bg-navy-950 text-white'}`}>{i + 1}</span>
                                <div>
                                    <h3 className="text-[16px] font-semibold leading-snug">{s.title}</h3>
                                    <p className="mt-1.5 text-[14px] leading-[1.5] text-muted-strong">{s.body}</p>
                                </div>
                                {i < STEPS.length - 1 && <span aria-hidden className="absolute -right-2.5 top-1/2 hidden h-px w-2 bg-slate-300 lg:block" />}
                            </li>
                        ))}
                    </ol>
                    <p className="mt-8 text-[15px]"><Link href="/how-it-works" className="font-medium text-accent-700 hover:underline">See each step with a worked example</Link></p>
                </Section>

                {/* 5. Product preview */}
                <Section id="preview" tone="surface" labelledBy="preview-title">
                    <SectionHeading id="preview-title" eyebrow="Product preview" title="Status, variants and statistics on one screen" lede="An illustration of the experiments list and the results tab. The numbers are example data computed with the same statistics the app uses." />
                    <SampleDataFrame className="mt-12"><DashboardPreview /></SampleDataFrame>
                </Section>

                {/* AI suggestions, shown once they are switched on */}
                {aiLive && (
                    <section id="ai" className="scroll-mt-20 bg-white py-16 md:py-24" aria-labelledby="ai-heading">
                        <Container>
                            <div className="rounded-3xl bg-navy-950 px-6 py-10 text-white sm:px-10 lg:px-14 lg:py-14">
                                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                                    <div>
                                        <span className="inline-block rounded-md bg-white/10 px-3 py-1.5 text-[12px] font-semibold tracking-[0.12em] text-accent-100">AI-POWERED</span>
                                        <h2 id="ai-heading" className="mt-5 text-[30px] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[38px]">Plan better tests.<br className="hidden sm:block" /> Read results faster.</h2>
                                    </div>
                                    <p className="max-w-[440px] text-[16px] leading-[1.6] text-slate-300">On Growth and Enterprise, bring your own OpenAI, Gemini, DeepSeek or Claude key. You pick the model and pay your provider directly, with no extra charge from us.</p>
                                </div>
                                <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                                    {aiFeatures.map((f) => (
                                        <li key={f.title} className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10">
                                            <h3 className="text-[16px] font-semibold">{f.title}</h3>
                                            <p className="mt-2 text-[14px] leading-[1.55] text-slate-300">{f.body}</p>
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-8 flex flex-wrap gap-3">
                                    <SiteButton href="/docs/ai" variant="onDark">How AI suggestions work <ArrowIcon /></SiteButton>
                                    <SiteButton href="/pricing" variant="outlineDark">See plans</SiteButton>
                                </div>
                            </div>
                        </Container>
                    </section>
                )}

                {/* 6. For marketers */}
                <Section id="marketers" tone={aiLive ? 'surface' : 'white'} labelledBy="marketers-title">
                    <SectionHeading id="marketers-title" eyebrow="For marketers" title="Test the pages your campaigns depend on" lede="Start with the page that gets the most traffic and the goal that matters most. These are the tests teams run first." />
                    <ul className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {MARKETER_USE_CASES.map((u) => (
                            <li key={u.title} className="rounded-xl border border-line bg-white p-6">
                                <h3 className="text-[17px] font-semibold">{u.title}</h3>
                                <p className="mt-2 text-[15px] leading-[1.6] text-muted-strong">{u.body}</p>
                                <p className="mt-4 text-[13px] font-medium text-accent-700">{u.feature}</p>
                            </li>
                        ))}
                        <li className="flex flex-col justify-center rounded-xl border border-dashed border-slate-300 p-6">
                            <p className="text-[15px] leading-[1.6] text-muted-strong">See a full campaign test, from hypothesis to rollout, and ideas for SaaS, ecommerce and startups.</p>
                            <Link href="/solutions/marketing" className="mt-3 text-[15px] font-medium text-accent-700 hover:underline">Marketing solutions</Link>
                            <Link href="/solutions" className="mt-1 text-[15px] font-medium text-accent-700 hover:underline">All solutions</Link>
                        </li>
                    </ul>
                </Section>

                {/* 7. For developers */}
                <Section id="developers" tone="navy" labelledBy="developers-title">
                    <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
                        <div>
                            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent-100">For developers</p>
                            <h2 id="developers-title" className="mt-3 text-[28px] font-semibold leading-[1.2] tracking-[-0.02em] md:text-[32px]">An SDK and an API that do one thing well</h2>
                            <ul className="mt-6 space-y-3 text-[15px] leading-[1.6] text-slate-300">
                                <li><strong className="font-semibold text-white">JavaScript SDK.</strong> One dependency-free script with a global <code className="font-mono text-[13px] text-white">ABTest</code> object. It handles bucketing, redirects, visual changes and click goals.</li>
                                <li><strong className="font-semibold text-white">REST API.</strong> Assign and track from your backend with a secret key, and read results as JSON.</li>
                                <li><strong className="font-semibold text-white">Deterministic assignment.</strong> The visitor ID and test ID decide the version, so every server and browser agrees.</li>
                                <li><strong className="font-semibold text-white">Integrations.</strong> GA4 events, Google Tag Manager, a WordPress plugin on paid plans, and signed webhooks.</li>
                            </ul>
                            <div className="mt-8 flex flex-wrap gap-3">
                                <SiteButton href="/developers" variant="onDark">Developer hub <ArrowIcon /></SiteButton>
                                <SiteButton href="/docs/javascript-sdk" variant="outlineDark">SDK reference</SiteButton>
                            </div>
                        </div>
                        <div className="min-w-0 space-y-4">
                            <Code label="1. Add the snippet to every page in the test" code={'<script src="https://www.freeabtest.com/sdk.js"\n        data-key="cro_pk_prod_..." async></script>'} />
                            <Code label="2. Count a custom event (paid plans)" code={"ABTest.track('signup');\nABTest.track('purchase', { revenue: 49.99 });"} />
                            <Code label="3. Or assign a visitor from your server" code={"curl -X POST https://www.freeabtest.com/api/server/assign \\\n  -H 'Authorization: Bearer cro_sk_prod_...' \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"experiment_id\": \"exp_123\", \"user_id\": \"user_42\"}'"} />
                        </div>
                    </div>
                </Section>

                {/* 8. Statistical engine */}
                <Section id="statistics" labelledBy="stats-title">
                    <SectionHeading id="stats-title" eyebrow="Statistical engine" title="Results you can check every day" lede="A classic z-test is only valid if you look once, at a sample size planned in advance. FreeABTest uses a sequential test instead, so stopping the moment a result is significant keeps the false winner rate at 5% or less." />
                    <div className="mt-12 grid gap-6 lg:grid-cols-3">
                        <div className="rounded-xl border border-line p-6">
                            <h3 className="text-[17px] font-semibold">1. Conversion rate and interval</h3>
                            <p className="mt-2 text-[15px] leading-[1.6] text-muted-strong">Rate is converting visitors divided by visitors. Each rate gets a 95% Wilson score interval, which stays accurate for small samples and low rates.</p>
                            <p className="mt-4 rounded-lg bg-surface p-3 text-[14px] tabular-nums">Control: {fmt(ex.control.conversions)} / {fmt(ex.control.visitors)} = <strong>{pct(r.control.conversion_rate)}</strong>, interval {pct(r.control.ci.lower)} to {pct(r.control.ci.upper)}<br />Variant B: {fmt(ex.variant.conversions)} / {fmt(ex.variant.visitors)} = <strong>{pct(r.variant.conversion_rate)}</strong>, interval {pct(r.variant.ci.lower)} to {pct(r.variant.ci.upper)}</p>
                        </div>
                        <div className="rounded-xl border border-line p-6">
                            <h3 className="text-[17px] font-semibold">2. Sequential significance</h3>
                            <p className="mt-2 text-[15px] leading-[1.6] text-muted-strong">Each variant is compared with the control. The p-value stays valid however often you look. With several variants, the 0.05 bar is split between them.</p>
                            <p className="mt-4 rounded-lg bg-surface p-3 text-[14px] tabular-nums">At {fmt(ex.control.visitors)} visitors each: p = {r.seq.p_value.toFixed(3)}, below {r.seq.threshold}. <strong className="text-accent-700">Significant.</strong><br />Same rates at {fmt(ex.early.visitors)} each: p = {early.seq.p_value.toFixed(3)}. <strong>Keep running.</strong></p>
                        </div>
                        <div className="rounded-xl border border-line p-6">
                            <h3 className="text-[17px] font-semibold">3. Reading the result</h3>
                            <p className="mt-2 text-[15px] leading-[1.6] text-muted-strong">Chance to beat control says how likely the variant is truly better. It moves fast on small samples, so decide on the significance verdict.</p>
                            <p className="mt-4 rounded-lg bg-surface p-3 text-[14px] tabular-nums">Lift +{pct(r.lift, 0)}{r.liftCi && <>, interval +{pct(r.liftCi.lower, 0)} to +{pct(r.liftCi.upper, 0)}</>}<br />Chance to beat control: {pct(r.chance)}</p>
                        </div>
                    </div>
                    <div className="mt-6 grid gap-6 md:grid-cols-3">
                        <p className="text-[14px] leading-[1.6] text-muted-strong"><strong className="text-navy-950">Sample size.</strong> To detect a 20% lift on a 5% baseline you need about 8,159 visitors per version for a single planned look, and more for the sequential test. The test planner estimates the duration.</p>
                        <p className="text-[14px] leading-[1.6] text-muted-strong"><strong className="text-navy-950">Inconclusive tests.</strong> No verdict before every version has 100 visitors. Many tests end with no significant difference; ship the simpler version and test a bolder idea.</p>
                        <p className="text-[14px] leading-[1.6] text-muted-strong"><strong className="text-navy-950">Sample ratio check.</strong> If visitors are not split the way you set the weights, the results page warns you before you trust the numbers.</p>
                    </div>
                    <p className="mt-8 text-[14px] text-muted">Worked example with example numbers. <Link href="/experiment-analytics" className="font-medium text-accent-700 hover:underline">Read how results are calculated</Link></p>
                </Section>

                {/* 9. Pricing */}
                <Section id="pricing" tone="surface" labelledBy="pricing-title">
                    <SectionHeading id="pricing-title" eyebrow="Pricing" title="Start free. Pay when you need more traffic." lede="The free plan has no time limit and clear limits. Past a limit, new visitors see your original page; we never upgrade or bill you automatically. Yearly plans include two months free." />
                    <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {PLAN_SUMMARY.map((p) => (
                            <li key={p.name} className={`flex flex-col rounded-xl border bg-white p-6 ${p.name === 'Free' ? 'border-accent-600/50' : 'border-line'}`}>
                                <h3 className="text-[16px] font-semibold">{p.name}</h3>
                                <p className="mt-3"><span className="text-[32px] font-semibold tracking-tight">{p.price}</span></p>
                                <p className="text-[13px] text-muted">{p.note}</p>
                                <ul className="mt-5 space-y-2 text-[14px] leading-[1.5]">
                                    {p.points.map((x) => <li key={x} className="flex gap-2"><Check /><span>{x}</span></li>)}
                                </ul>
                            </li>
                        ))}
                    </ul>
                    <div className="mt-8 flex flex-wrap items-center gap-4">
                        <SiteButton href="/pricing">Compare every feature <ArrowIcon /></SiteButton>
                        <Link href="/pricing#faq" className="text-[15px] font-medium text-accent-700 hover:underline">What counts as a tested visitor?</Link>
                    </div>
                </Section>

                {/* 10. FAQ */}
                <Section id="faq" labelledBy="faq-title">
                    <div className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
                        <SectionHeading id="faq-title" eyebrow="FAQ" title="Questions people ask first" lede={<>More answers on the <Link href="/pricing#faq" className="font-medium text-accent-700 hover:underline">pricing page</Link> and in the <Link href="/docs" className="font-medium text-accent-700 hover:underline">docs</Link>.</>} />
                        <div className="divide-y divide-line border-y border-line">
                            {HOME_FAQ.map((f) => (
                                <details key={f.q} className="group py-1">
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[17px] font-medium text-navy-950 [&::-webkit-details-marker]:hidden">
                                        {f.q}
                                        <span aria-hidden className="text-[20px] leading-none text-muted transition-transform group-open:rotate-45">+</span>
                                    </summary>
                                    <p className="pb-5 text-[15px] leading-[1.65] text-muted-strong">{f.a} <Link href={f.href} className="font-medium text-accent-700 hover:underline">{f.link}</Link></p>
                                </details>
                            ))}
                        </div>
                    </div>
                </Section>

                {/* 11. Final CTA */}
                <CtaBand title="Your next experiment starts here." body={`Free plan with ${fmt(FREE_MONTHLY_VISITORS)} tested visitors a month. No card needed.`} href="/signin" label="Start experimenting for free" />
            </main>
            <SiteFooter />
        </div>
    );
}
