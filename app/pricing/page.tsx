import type { Metadata } from 'next';
import { ButtonLink } from '../components/ui';
import { CheckIcon } from '../components/shell/icons';
import { SiteFooter, SiteHeader } from '../components/landing/SiteChrome';

export const metadata: Metadata = { title: 'Pricing' };

const faqs = [
    { q: 'How are visitors assigned to a variant?', a: 'The SDK sends a visitor ID and the platform hashes it together with the experiment ID. The same visitor always lands in the same variant, and raising traffic allocation does not move people who are already in the test.' },
    { q: 'Which statistics do you use?', a: 'Today: a two-proportion z-test of the best variant against the control, and Wilson score intervals for each conversion rate. Significance is only tested once every variant has at least 100 visitors. Bayesian and sequential methods are on the roadmap.' },
    { q: 'Will it slow my site down?', a: 'The current SDK is a small script that requests an assignment per experiment. A version that buckets locally from a cached config, with no extra request per visitor and no flicker, is part of Phase 1.' },
    { q: 'Can I keep test data separate from production?', a: 'Yes. Every project has dev, staging and production environments, each with its own keys. Results can be filtered by environment.' },
    { q: 'Where is my data stored?', a: 'In your own database. freeabtest.com is self-hostable and uses SQLite locally or a hosted libSQL database such as Turso in production.' },
    { q: 'Is there a visual editor?', a: 'Not yet. Variants are written in code today. The visual editor is planned for Phase 3.' },
];

const tiers = [
    { name: 'Free', price: 'TBD', body: 'For trying it out on one site.', items: ['1 project', 'Monthly visitor limit', 'Core A/B and A/B/n tests'] },
    { name: 'Team', price: 'TBD', body: 'For teams running tests every week.', items: ['Multiple projects', 'Higher visitor limits', 'Roles and audit log'], highlight: true },
    { name: 'Enterprise', price: 'Contact us', body: 'For larger traffic and compliance needs.', items: ['Custom limits', 'SSO', 'Self-hosting support'] },
];

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-[#f8faff] text-zinc-950">
            <SiteHeader />
            <main className="mx-auto max-w-[1100px] px-5 pb-20 pt-10 sm:px-8">
                <p className="text-[13px] font-semibold tracking-[0.2em] text-blue-600">PRICING</p>
                <h1 className="mt-4 text-[40px] font-bold tracking-[-0.03em] text-[#0b1630] sm:text-[52px]">Plans</h1>
                <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Placeholder. Pricing has not been set. Tiers and limits below show the intended structure only.
                </div>
                <div className="mt-8 grid gap-5 md:grid-cols-3">
                    {tiers.map((t) => (
                        <div key={t.name} className={`rounded-2xl border bg-white p-7 ${t.highlight ? 'border-blue-600 ring-1 ring-blue-600' : 'border-zinc-200'}`}>
                            <h2 className="text-lg font-semibold">{t.name}</h2>
                            <p className="mt-1 text-sm text-zinc-600">{t.body}</p>
                            <p className="mt-6 text-3xl font-bold tracking-tight">{t.price}</p>
                            <ul className="mt-6 space-y-2 text-sm text-zinc-600">
                                {t.items.map((i) => <li key={i} className="flex gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />{i}</li>)}
                            </ul>
                            <ButtonLink href="/signin" variant={t.highlight ? 'primary' : 'secondary'} className="mt-8 w-full">Get started</ButtonLink>
                        </div>
                    ))}
                </div>
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
            </main>
            <SiteFooter />
        </div>
    );
}
