import Link from 'next/link';
import { Logo } from './components/ui/Logo';
import { ButtonLink, Badge, CodeBlock } from './components/ui';
import { CheckIcon } from './components/shell/icons';
import { Blobs } from './components/landing/Blobs';
import { NavMenu } from './components/landing/NavMenu';
import { DashboardMock } from './components/landing/DashboardMock';
import { TestIllustration } from './components/landing/TestIllustration';

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
const faqs = [
    { q: 'How are visitors assigned to a variant?', a: 'The SDK sends a visitor ID and the platform hashes it together with the experiment ID. The same visitor always lands in the same variant, and raising traffic allocation does not move people who are already in the test.' },
    { q: 'Which statistics do you use?', a: 'Today: a two-proportion z-test of the best variant against the control, and Wilson score intervals for each conversion rate. Significance is only tested once every variant has at least 100 visitors. Bayesian and sequential methods are on the roadmap.' },
    { q: 'Will it slow my site down?', a: 'The current SDK is a small script that requests an assignment per experiment. A version that buckets locally from a cached config, with no extra request per visitor and no flicker, is part of Phase 1.' },
    { q: 'Can I keep test data separate from production?', a: 'Yes. Every project has dev, staging and production environments, each with its own keys. Results can be filtered by environment.' },
    { q: 'Where is my data stored?', a: 'In your own database. freeabtest.com is self-hostable and uses SQLite locally or a hosted libSQL database such as Turso in production.' },
    { q: 'Is there a visual editor?', a: 'Not yet. Variants are written in code today. The visual editor is planned for Phase 3.' },
];

const snippet = `<script src="https://freeabtest.example.com/sdk.js"></script>
<script>
  ABTest.init({
    apiUrl: 'https://freeabtest.example.com',
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

const menus = {
    Product: [
        { href: '#features', title: 'Features', body: 'What works in the current release' },
        { href: '#how-it-works', title: 'How it works', body: 'From snippet to result in three steps' },
        { href: '#roadmap', title: 'Roadmap', body: 'What is planned for each phase' },
    ],
    'Use cases': [
        { href: '#test-anything', title: 'Landing pages', body: 'Headlines, copy and calls to action' },
        { href: '#test-anything', title: 'Pricing pages', body: 'Plans, layout and wording' },
        { href: '#test-anything', title: 'Split URL tests', body: 'Compare two whole pages' },
    ],
    Pricing: [{ href: '#pricing', title: 'Plans', body: 'Intended plan structure (placeholder)' }],
    Resources: [
        { href: 'https://github.com/ranababu1/cro#readme', title: 'Documentation', body: 'Setup and SDK reference' },
        { href: '/demo.html', title: 'Demo page', body: 'See the SDK on a sample page' },
        { href: '#faq', title: 'FAQ', body: 'Common questions' },
    ],
};

const stack = [
    { name: 'JavaScript', status: 'Available' },
    { name: 'HTML', status: 'Available' },
    { name: 'React', status: 'Planned' },
    { name: 'Next.js', status: 'Planned' },
    { name: 'WordPress', status: 'Planned' },
    { name: 'Node.js', status: 'Planned' },
    { name: 'GA4', status: 'Planned' },
];

const howSteps = [
    { title: 'Create', body: 'Set up an experiment, write the hypothesis and add your variations.', tone: 'bg-sky-50 ring-sky-100', icon: 'text-sky-600 bg-sky-100', d: 'M12 5v14M5 12h14' },
    { title: 'Test', body: 'Add a few lines of code. Visitors are split between variations automatically.', tone: 'bg-emerald-50 ring-emerald-100', icon: 'text-emerald-700 bg-emerald-100', d: 'M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3' },
    { title: 'Grow', body: 'Read conversion rates and confidence intervals, then ship the winner.', tone: 'bg-amber-50 ring-amber-100', icon: 'text-amber-700 bg-amber-100', d: 'M4 19 10 13l4 4 6-8M15 9h5v5' },
];

const testList = [
    'Headlines, copy and calls to action',
    'Landing and pricing pages',
    'Whole-page redirects (split URL tests)',
    'Any change you can make in JavaScript',
    'Targeting by URL, device and UTM (coming in Phase 1)',
];

// Each stat is a product fact checked against the code (public/sdk.js size, validation limits, environments, stats engine).
const stats = [
    { value: 'Under 3 KB', label: 'SDK size, gzipped' },
    { value: 'Up to 26', label: 'Variations per experiment' },
    { value: '3', label: 'Environments per project' },
    { value: '95%', label: 'Wilson confidence intervals' },
];

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

function Tick() {
    return (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckIcon className="h-3 w-3" />
        </span>
    );
}

export default function LandingPage() {
    return (
        <div className="min-h-screen overflow-x-hidden bg-white text-zinc-900">
            <header className="sticky top-0 z-40 border-b border-zinc-200/60 bg-white/80 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
                    <Logo />
                    <nav className="hidden items-center lg:flex" aria-label="Main">
                        {Object.entries(menus).map(([label, items]) => <NavMenu key={label} label={label} items={items} />)}
                    </nav>
                    <div className="ml-auto flex items-center gap-2 sm:gap-4">
                        <Link href="/signin" className="hidden text-sm font-medium text-zinc-700 hover:text-zinc-900 sm:block">Log in</Link>
                        <ButtonLink href="/signin" className="bg-zinc-900 hover:bg-zinc-800">Start for free</ButtonLink>
                    </div>
                </div>
            </header>

            <main>
                <section className="relative isolate">
                    <Blobs variant="hero" />
                    <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:pb-24 lg:pt-20 [&>*]:min-w-0">
                        <div>
                            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-3 py-1 text-xs font-medium text-emerald-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Free A/B testing for growing teams
                            </span>
                            <h1 className="mt-6 text-5xl font-bold leading-[1.02] tracking-tight text-zinc-950 sm:text-6xl xl:text-7xl">
                                Build, test and{' '}
                                <span className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent">grow faster.</span>
                            </h1>
                            <p className="mt-6 max-w-lg text-lg leading-8 text-zinc-600">
                                Run A/B tests on your website, see which version converts better, and make decisions backed by real statistics. A few lines of code to get started.
                            </p>
                            <div className="mt-8 flex flex-wrap gap-3">
                                <ButtonLink href="/signin" size="lg" className="bg-zinc-900 hover:bg-zinc-800">Start testing for free</ButtonLink>
                                <ButtonLink href="/demo.html" size="lg" variant="secondary">Try the demo page</ButtonLink>
                            </div>
                            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-zinc-600">
                                {['Free plan', 'Set up in minutes', 'No credit card required'].map((t) => (
                                    <li key={t} className="flex items-center gap-2"><Tick />{t}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="relative">
                            <DashboardMock />
                            <div className="pointer-events-none absolute -bottom-14 left-4 hidden items-end gap-1 font-hand text-2xl text-emerald-800 sm:flex lg:-left-10" aria-hidden>
                                <svg viewBox="0 0 60 50" className="h-12 w-14 -rotate-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <path d="M6 44C14 30 26 18 50 10" />
                                    <path d="M40 6l10 4-6 9" />
                                </svg>
                                <span className="-rotate-3">See what really works</span>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">
                        <p className="text-center text-sm text-zinc-500">Works with your stack</p>
                        <ul className="mt-5 flex flex-wrap items-center justify-center gap-3">
                            {stack.map((s) => (
                                <li key={s.name} className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white/70 px-4 py-2 text-sm font-semibold text-zinc-500">
                                    {s.name}
                                    {s.status !== 'Available' && <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">{s.status}</span>}
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                <section id="how-it-works" className="scroll-mt-20 py-20 sm:py-24">
                    <div className="mx-auto max-w-6xl px-4 sm:px-6">
                        <p className="text-center text-sm font-medium text-emerald-700">How it works</p>
                        <h2 className="mt-2 text-center text-3xl font-bold tracking-tight sm:text-4xl">Simple steps. Real results.</h2>
                        <div className="mt-12 grid gap-6 md:grid-cols-3">
                            {howSteps.map((s, i) => (
                                <div key={s.title} className="relative">
                                    <div className={`h-full rounded-2xl p-6 ring-1 ${s.tone}`}>
                                        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.icon}`}>
                                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={s.d} /></svg>
                                        </span>
                                        <h3 className="mt-5 text-lg font-semibold">{i + 1}. {s.title}</h3>
                                        <p className="mt-2 text-sm leading-6 text-zinc-600">{s.body}</p>
                                    </div>
                                    {i < howSteps.length - 1 && (
                                        <span className="absolute -right-5 top-1/2 z-10 hidden -translate-y-1/2 text-zinc-300 md:block" aria-hidden>
                                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.2fr] [&>*]:min-w-0">
                            <p className="text-sm leading-6 text-zinc-600">This is the code for a real test. The SDK is plain JavaScript with no dependencies, and the snippet below is all a page needs.</p>
                            <CodeBlock label="index.html" tone="dark" code={snippet} />
                        </div>
                    </div>
                </section>

                <section id="test-anything" className="relative isolate scroll-mt-20 overflow-hidden py-20 sm:py-24">
                    <Blobs variant="band" />
                    <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 [&>*]:min-w-0">
                        <TestIllustration />
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Test anything.<br />Improve everything.</h2>
                            <p className="mt-4 max-w-md text-zinc-600">Compare versions of a page and let the data decide which one wins.</p>
                            <ul className="mt-6 space-y-3 text-sm text-zinc-700">
                                {testList.map((t) => <li key={t} className="flex items-center gap-3"><Tick />{t}</li>)}
                            </ul>
                            <ButtonLink href="/signin" size="lg" className="mt-8 bg-zinc-900 hover:bg-zinc-800">Start your first test</ButtonLink>
                        </div>
                    </div>
                    <div className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
                        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 shadow-card md:grid-cols-4">
                            {stats.map((s) => (
                                <div key={s.label} className="flex flex-col-reverse bg-white/90 px-6 py-6 text-center">
                                    <dt className="mt-1 text-sm text-zinc-500">{s.label}</dt>
                                    <dd className="text-3xl font-bold tracking-tight text-zinc-900">{s.value}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
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
                        <p className="text-zinc-500">Free A/B testing and experimentation platform.</p>
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
                    <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-zinc-500 sm:px-6">© {new Date().getFullYear()} freeabtest.com</p>
                </div>
            </footer>
        </div>
    );
}
