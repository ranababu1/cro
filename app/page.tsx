import Link from 'next/link';
import { Logo } from './components/ui/Logo';
import { ButtonLink, Badge, CodeBlock } from './components/ui';
import { CheckIcon } from './components/shell/icons';

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

const steps = [
    { n: '1', title: 'Add the snippet', body: 'One script tag and your SDK key. The SDK is plain JavaScript with no dependencies.' },
    { n: '2', title: 'Define the experiment', body: 'Name it, write the hypothesis, add variants and choose how much traffic to include.' },
    { n: '3', title: 'Start and read results', body: 'Visitors are assigned as they arrive. Results update as conversions come in.' },
];

const faqs = [
    { q: 'How are visitors assigned to a variant?', a: 'The SDK sends a visitor ID and the platform hashes it together with the experiment ID. The same visitor always lands in the same variant, and raising traffic allocation does not move people who are already in the test.' },
    { q: 'Which statistics do you use?', a: 'Today: a two-proportion z-test of the best variant against the control, and Wilson score intervals for each conversion rate. Significance is only tested once every variant has at least 100 visitors. Bayesian and sequential methods are on the roadmap.' },
    { q: 'Will it slow my site down?', a: 'The current SDK is a small script that requests an assignment per experiment. A version that buckets locally from a cached config, with no extra request per visitor and no flicker, is part of Phase 1.' },
    { q: 'Can I keep test data separate from production?', a: 'Yes. Every project has dev, staging and production environments, each with its own keys. Results can be filtered by environment.' },
    { q: 'Where is my data stored?', a: 'In your own database. CRO is self-hostable and uses SQLite locally or a hosted libSQL database such as Turso in production.' },
    { q: 'Is there a visual editor?', a: 'Not yet. Variants are written in code today. The visual editor is planned for Phase 3.' },
];

const snippet = `<script src="https://cro.example.com/sdk.js"></script>
<script>
  ABTest.init({
    apiUrl: 'https://cro.example.com',
    apiKey: 'cro_pk_prod_...'
  });

  ABTest.run('exp_pricing_headline', function (variation) {
    if (variation.variation_name === 'Variant B') {
      document.querySelector('h1').textContent = 'Plans that grow with your team';
    }
  });

  document.querySelector('#start-trial').addEventListener('click', function () {
    ABTest.trackConversion('exp_pricing_headline', 'start_trial');
  });
</script>`;

function Section({ id, eyebrow, title, intro, children }: { id?: string; eyebrow: string; title: string; intro?: string; children: React.ReactNode }) {
    return (
        <section id={id} className="scroll-mt-20 border-t border-zinc-200 py-20 sm:py-24">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <p className="text-sm font-medium text-brand-700">{eyebrow}</p>
                <h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">{title}</h2>
                {intro && <p className="mt-3 max-w-2xl text-zinc-600">{intro}</p>}
                <div className="mt-12">{children}</div>
            </div>
        </section>
    );
}

/** Static product preview. Example numbers only, labelled as such. */
function ResultsPreview() {
    const rows = [
        { name: 'Control', control: true, v: '4,812', c: '386', r: '8.02%', lift: '-', lo: 30, hi: 46, m: 38 },
        { name: 'Variant B', control: false, v: '4,790', c: '471', r: '9.83%', lift: '+22.6%', lo: 50, hi: 68, m: 59 },
    ];
    return (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-pop">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-zinc-900">Pricing page headline</span>
                    <Badge tone="success" dot>Running</Badge>
                </div>
                <span className="text-xs text-zinc-400">Example data</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="border-b border-zinc-200 bg-zinc-50/60 text-xs text-zinc-500">
                        <tr>
                            <th className="px-5 py-2 text-left font-medium">Variation</th>
                            <th className="px-3 py-2 text-right font-medium">Visitors</th>
                            <th className="px-3 py-2 text-right font-medium">Conv.</th>
                            <th className="px-3 py-2 text-right font-medium">Rate</th>
                            <th className="px-5 py-2 text-right font-medium">Lift</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 tabular-nums">
                        {rows.map((r) => (
                            <tr key={r.name}>
                                <td className="px-5 py-3 font-medium text-zinc-900">{r.name}{r.control && <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-normal text-zinc-600">Control</span>}</td>
                                <td className="px-3 py-3 text-right text-zinc-600">{r.v}</td>
                                <td className="px-3 py-3 text-right text-zinc-600">{r.c}</td>
                                <td className="px-3 py-3 text-right font-medium text-zinc-900">{r.r}</td>
                                <td className={`px-5 py-3 text-right ${r.control ? 'text-zinc-400' : 'text-emerald-700'}`}>{r.lift}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="space-y-2.5 border-t border-zinc-200 px-5 py-4">
                {rows.map((r) => (
                    <div key={r.name} className="grid grid-cols-[5.5rem_1fr] items-center gap-3 text-xs text-zinc-500">
                        <span>{r.name}</span>
                        <div className="relative h-5 rounded bg-zinc-50">
                            <div className={`absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full ${r.control ? 'bg-zinc-300' : 'bg-emerald-200'}`} style={{ left: `${r.lo}%`, width: `${r.hi - r.lo}%` }} />
                            <div className={`absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-sm ${r.control ? 'bg-zinc-600' : 'bg-emerald-600'}`} style={{ left: `${r.m}%` }} />
                        </div>
                    </div>
                ))}
                <p className="pt-1 text-xs text-zinc-500">Variant B is ahead at 95% confidence (p = 0.0021).</p>
            </div>
        </div>
    );
}

export default function LandingPage() {
    return (
        <div className="bg-white">
            <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white">
                <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
                    <Logo />
                    <nav className="hidden items-center gap-6 text-sm text-zinc-600 md:flex">
                        <a href="#features" className="hover:text-zinc-900">Features</a>
                        <a href="#how-it-works" className="hover:text-zinc-900">How it works</a>
                        <a href="#roadmap" className="hover:text-zinc-900">Roadmap</a>
                        <a href="#pricing" className="hover:text-zinc-900">Pricing</a>
                        <a href="#faq" className="hover:text-zinc-900">FAQ</a>
                    </nav>
                    <div className="ml-auto flex items-center gap-2">
                        <ButtonLink href="/signin" variant="ghost" size="sm">Sign in</ButtonLink>
                        <ButtonLink href="/signin" size="sm">Get started</ButtonLink>
                    </div>
                </div>
            </header>

            <main>
                <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 [&>*]:min-w-0 pt-16 pb-20 sm:px-6 sm:pt-24 lg:grid-cols-[1.1fr_1fr]">
                    <div>
                        <Badge tone="neutral">Self-hostable experimentation platform</Badge>
                        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">A/B testing you can run on your own stack.</h1>
                        <p className="mt-5 max-w-xl text-lg text-zinc-600">
                            Test changes to your site with a small JavaScript SDK, keep visitors in the same variant, and read results with confidence intervals and significance tests. Your data stays in your database.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <ButtonLink href="/signin" size="lg">Start for free</ButtonLink>
                            <ButtonLink href="#how-it-works" variant="secondary" size="lg">See how it works</ButtonLink>
                        </div>
                        <ul className="mt-8 grid gap-2 text-sm text-zinc-600 sm:grid-cols-2">
                            {['No visual editor lock-in, variants live in your code', 'Separate dev, staging and production data', 'Open roadmap, published below', 'Sign in with Google'].map((t) => (
                                <li key={t} className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />{t}</li>
                            ))}
                        </ul>
                    </div>
                    <ResultsPreview />
                </section>

                <Section id="features" eyebrow="Available today" title="The parts of experimentation that have to be right" intro="Assignment, data separation and statistics come first. Everything here works in the current release.">
                    <div className="grid gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-3">
                        {available.map((f) => (
                            <div key={f.title} className="bg-white p-6">
                                <h3 className="text-sm font-semibold text-zinc-900">{f.title}</h3>
                                <p className="mt-2 text-sm leading-6 text-zinc-600">{f.body}</p>
                            </div>
                        ))}
                    </div>
                </Section>

                <Section id="how-it-works" eyebrow="How it works" title="From snippet to result in three steps">
                    <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] [&>*]:min-w-0">
                        <ol className="space-y-8">
                            {steps.map((s) => (
                                <li key={s.n} className="flex gap-4">
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-sm font-medium text-zinc-700">{s.n}</span>
                                    <div>
                                        <h3 className="font-medium text-zinc-900">{s.title}</h3>
                                        <p className="mt-1 text-sm leading-6 text-zinc-600">{s.body}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                        <CodeBlock label="index.html" tone="dark" code={snippet} />
                    </div>
                </Section>

                <Section id="roadmap" eyebrow="Roadmap" title="What is coming next" intro="The platform is built in three phases. This is the plan, not a list of shipped features.">
                    <div className="grid gap-4 md:grid-cols-3">
                        {planned.map((p) => (
                            <div key={p.phase} className="rounded-lg border border-zinc-200 p-6">
                                <Badge tone={p.phase === 'Phase 1' ? 'brand' : 'neutral'}>{p.phase}</Badge>
                                <ul className="mt-4 space-y-2.5 text-sm text-zinc-600">
                                    {p.items.map((i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />{i}</li>)}
                                </ul>
                            </div>
                        ))}
                    </div>
                </Section>

                <Section id="pricing" eyebrow="Pricing" title="Plans">
                    <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        Placeholder. Pricing has not been set. Tiers and limits below show the intended structure only.
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                        {[
                            { name: 'Free', price: 'TBD', body: 'For trying it out on one site.', items: ['1 project', 'Monthly visitor limit', 'Core A/B and A/B/n tests'] },
                            { name: 'Team', price: 'TBD', body: 'For teams running tests every week.', items: ['Multiple projects', 'Higher visitor limits', 'Roles and audit log'], highlight: true },
                            { name: 'Enterprise', price: 'Contact us', body: 'For larger traffic and compliance needs.', items: ['Custom limits', 'SSO', 'Self-hosting support'] },
                        ].map((t) => (
                            <div key={t.name} className={`rounded-lg border p-6 ${t.highlight ? 'border-brand-600 ring-1 ring-brand-600' : 'border-zinc-200'}`}>
                                <h3 className="font-semibold text-zinc-900">{t.name}</h3>
                                <p className="mt-1 text-sm text-zinc-600">{t.body}</p>
                                <p className="mt-6 text-2xl font-semibold tracking-tight text-zinc-900">{t.price}</p>
                                <ul className="mt-6 space-y-2 text-sm text-zinc-600">
                                    {t.items.map((i) => <li key={i} className="flex gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />{i}</li>)}
                                </ul>
                                <ButtonLink href="/signin" variant={t.highlight ? 'primary' : 'secondary'} className="mt-8 w-full">Get started</ButtonLink>
                            </div>
                        ))}
                    </div>
                </Section>

                <Section id="faq" eyebrow="FAQ" title="Common questions">
                    <div className="divide-y divide-zinc-200 border-y border-zinc-200">
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
                </Section>

                <section className="border-t border-zinc-200 bg-zinc-50">
                    <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Run your first experiment this week.</h2>
                            <p className="mt-2 text-zinc-600">Sign in, create an SDK key and add one script tag.</p>
                        </div>
                        <ButtonLink href="/signin" size="lg">Get started</ButtonLink>
                    </div>
                </section>
            </main>

            <footer className="border-t border-zinc-200">
                <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-sm sm:px-6 md:grid-cols-4">
                    <div className="space-y-3">
                        <Logo />
                        <p className="text-zinc-500">A/B testing and experimentation platform.</p>
                    </div>
                    <div>
                        <p className="font-medium text-zinc-900">Product</p>
                        <ul className="mt-3 space-y-2 text-zinc-600">
                            <li><a href="#features" className="hover:text-zinc-900">Features</a></li>
                            <li><a href="#roadmap" className="hover:text-zinc-900">Roadmap</a></li>
                            <li><a href="#pricing" className="hover:text-zinc-900">Pricing</a></li>
                        </ul>
                    </div>
                    <div>
                        <p className="font-medium text-zinc-900">Developers</p>
                        <ul className="mt-3 space-y-2 text-zinc-600">
                            <li><a href="https://github.com/ranababu1/cro#readme" className="hover:text-zinc-900">Documentation</a></li>
                            <li><a href="/demo.html" className="hover:text-zinc-900">SDK demo page</a></li>
                        </ul>
                    </div>
                    <div>
                        <p className="font-medium text-zinc-900">Account</p>
                        <ul className="mt-3 space-y-2 text-zinc-600">
                            <li><Link href="/signin" className="hover:text-zinc-900">Sign in</Link></li>
                            <li><Link href="/dashboard" className="hover:text-zinc-900">Dashboard</Link></li>
                        </ul>
                    </div>
                </div>
                <div className="border-t border-zinc-200">
                    <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-zinc-500 sm:px-6">© {new Date().getFullYear()} CRO</p>
                </div>
            </footer>
        </div>
    );
}
