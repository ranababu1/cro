import Link from 'next/link';
import { pageMetadata } from '@/lib/site/meta';
import { FREE_LINE } from '@/lib/site/product';
import { SOLUTIONS } from '@/lib/site/solutions';
import { ArrowIcon, Breadcrumbs, CtaBand, PageHero, Section, SectionHeading, SitePage, SolutionsSubnav } from '../components/site';

export const metadata = pageMetadata({
    path: '/solutions',
    title: 'Solutions: A/B testing for marketing, SaaS, ecommerce and startups',
    description: 'How marketing teams, SaaS products, online stores and startups use FreeABTest: a worked workflow, test ideas, the goals to measure and the plan that fits each one.',
});

const BY_GOAL: { goal: string; slug: (typeof SOLUTIONS)[number]['slug'] }[] = [
    { goal: 'More signups from a landing page or campaign', slug: 'marketing' },
    { goal: 'More trials from the pricing page, and more of them activated', slug: 'saas' },
    { goal: 'More revenue per visitor and bigger orders', slug: 'ecommerce' },
    { goal: 'A first useful test with little traffic and no budget', slug: 'startups' },
];

export default function SolutionsPage() {
    return (
        <SitePage>
            <PageHero eyebrow="Solutions" title="The same platform, used four ways"
                lede="A marketing team testing headlines, a product team testing its pricing page, a store measuring revenue, and a startup running its first test all use the same assignment, goals and statistics. What changes is what they test and what they measure."
                actions={[{ href: '/signin', label: 'Start for free' }, { href: '/features', label: 'See every feature' }]}>
                <Breadcrumbs items={[{ href: '/solutions', label: 'Solutions' }]} />
            </PageHero>
            <SolutionsSubnav current="/solutions" />

            <Section>
                <SectionHeading eyebrow="By team" title="Pick the page closest to your work" />
                <ul className="mt-10 grid gap-5 md:grid-cols-2">
                    {SOLUTIONS.map((s) => (
                        <li key={s.slug}>
                            <Link href={`/solutions/${s.slug}`} className="group flex h-full flex-col rounded-2xl border border-line p-7 transition-colors hover:border-slate-300 hover:bg-surface">
                                <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent-700">{s.name}</span>
                                <span className="mt-3 text-[22px] font-semibold leading-[1.25] tracking-[-0.01em] text-navy-950">{s.title}</span>
                                <span className="mt-3 text-[15px] leading-[1.6] text-muted-strong">{s.lede}</span>
                                <span className="mt-5 text-[13px] text-muted">Test ideas: {s.ideas.slice(0, 3).map((i) => i.title.toLowerCase()).join(', ')}</span>
                                <span className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-medium text-accent-700">Read the {s.name.toLowerCase()} page <ArrowIcon /></span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </Section>

            <Section tone="surface" className="border-t border-line">
                <SectionHeading eyebrow="By goal" title="Start from what you want to improve" />
                <ul className="mt-8 divide-y divide-line rounded-xl border border-line bg-white">
                    {BY_GOAL.map((g) => {
                        const s = SOLUTIONS.find((x) => x.slug === g.slug)!;
                        return (
                            <li key={g.goal} className="flex flex-col gap-1 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                                <span className="text-[16px] text-navy-950">{g.goal}</span>
                                <Link href={`/solutions/${s.slug}`} className="shrink-0 text-[14px] font-medium text-accent-700 hover:underline">{s.name}</Link>
                            </li>
                        );
                    })}
                </ul>
            </Section>

            <Section>
                <div className="grid gap-8 md:grid-cols-3">
                    {[
                        { t: 'No code for most tests', b: 'One script tag, split URL tests and click goals. The visual editor on Growth changes copy without code.', h: '/docs/quick-start', l: 'Quick start' },
                        { t: 'Code when you need it', b: 'Read the version in your own code, assign from your server, and send custom events on paid plans.', h: '/docs/javascript-sdk', l: 'JavaScript SDK' },
                        { t: 'One way to read results', b: 'Every test gets the same sequential verdict, Wilson intervals and visitor split check.', h: '/experiment-analytics', l: 'Experiment analytics' },
                    ].map((x) => (
                        <div key={x.t}>
                            <h2 className="text-[18px] font-semibold text-navy-950">{x.t}</h2>
                            <p className="mt-2 text-[15px] leading-[1.6] text-muted-strong">{x.b}</p>
                            <Link href={x.h} className="mt-3 inline-block text-[14px] font-medium text-accent-700 hover:underline">{x.l}</Link>
                        </div>
                    ))}
                </div>
            </Section>

            <CtaBand title="Your next experiment starts here." body={FREE_LINE} href="/signin" label="Start for free" />
        </SitePage>
    );
}
