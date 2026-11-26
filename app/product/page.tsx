import Link from 'next/link';
import { pageMetadata } from '@/lib/site/meta';
import { FEATURE_GROUPS, FREE_LINE, PRODUCT_PAGES } from '@/lib/site/product';
import { ArrowIcon, Breadcrumbs, CtaBand, PageHero, ProductSubnav, SampleDataFrame, Section, SectionHeading, SiteCard, SitePage } from '../components/site';
import { HeroPreview } from '../components/site/Previews';

export const metadata = pageMetadata({
    path: '/product',
    title: 'A/B testing platform for marketers and developers',
    description: 'One experimentation platform with two ways in: no-code tests for marketers, and a JavaScript SDK and REST API for developers, with shared statistics.',
});

const JOURNEYS = [
    {
        audience: 'Marketers and product managers', title: 'Test pages without waiting for a release',
        steps: ['Paste one script tag, or install it through Tag Manager or WordPress', 'Create a split URL test, or change copy with the visual editor on Growth', 'Count clicks on any button, and form submits or page visits on paid plans', 'Read a plain verdict and roll out the winner with one click'],
        links: [{ href: '/docs/quick-start', label: 'Quick start' }, { href: '/how-it-works', label: 'How it works' }],
    },
    {
        audience: 'Developers and engineering teams', title: 'Put experiments in your own code',
        steps: ['Read the assigned version in the browser with ABTest.bootstrap', 'Assign from your backend with a secret key and the same hashing', 'Send custom events and revenue from your code on paid plans', 'Read results over the REST API and get signed webhooks'],
        links: [{ href: '/docs/javascript-sdk', label: 'JavaScript SDK' }, { href: '/docs/rest-api', label: 'REST API' }],
    },
];

const SHARED = [
    { title: 'One assignment', body: 'Browser and server use the same hash of visitor ID and test ID, so both agree on the version.' },
    { title: 'One set of statistics', body: 'Every test, from any source, gets the same sequential verdict, Wilson intervals and split check.' },
    { title: 'One workspace', body: 'Projects, environments, keys, teammates and the audit log are shared by everyone on the team.' },
];

export default function ProductPage() {
    return (
        <SitePage>
            <PageHero eyebrow="Product" title="One experimentation platform, two ways in"
                lede="Marketers run tests from the dashboard with one script tag. Developers build experiments into their product with the SDK and the REST API. Both use the same assignment, the same goals and the same statistics."
                actions={[{ href: '/signin', label: 'Start for free' }, { href: '/features', label: 'See every feature' }]}>
                <Breadcrumbs items={[{ href: '/product', label: 'Product' }]} />
            </PageHero>
            <ProductSubnav current="/product" />

            <Section>
                <SectionHeading eyebrow="Two journeys" title="Start where your team works" />
                <div className="mt-10 grid gap-6 lg:grid-cols-2">
                    {JOURNEYS.map((j, i) => (
                        <article key={j.audience} className="site-lift rounded-2xl border border-line bg-white p-8">
                            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent-700">{j.audience}</p>
                            <h3 className="mt-3 text-[24px] font-semibold leading-[1.25] tracking-[-0.02em]">{j.title}</h3>
                            <ol className="mt-6 grid gap-3">
                                {j.steps.map((s, k) => (
                                    <li key={s} className="flex gap-3 text-[15px] leading-[1.55]">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-[12px] font-semibold text-navy-950 ring-1 ring-inset ring-line">{k + 1}</span>
                                        <span className="text-muted-strong">{s}</span>
                                    </li>
                                ))}
                            </ol>
                            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2">
                                {j.links.map((l) => <Link key={l.href} href={l.href} className="text-[14px] font-medium text-accent-700 hover:underline">{l.label}</Link>)}
                            </div>
                        </article>
                    ))}
                </div>
            </Section>

            <Section tone="surface" className="border-t border-line">
                <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:items-center">
                    <div>
                        <SectionHeading eyebrow="Shared foundation" title="The same engine under both journeys" lede="A marketer's split URL test and a developer's server-side test are the same kind of object, read the same way." />
                        <ul className="mt-8 grid gap-5">
                            {SHARED.map((s) => (
                                <li key={s.title}>
                                    <h3 className="text-[17px] font-semibold text-navy-950">{s.title}</h3>
                                    <p className="mt-1 text-[15px] leading-[1.6] text-muted-strong">{s.body}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <SampleDataFrame><HeroPreview /></SampleDataFrame>
                </div>
            </Section>

            <Section>
                <SectionHeading eyebrow="Capability map" title="What the platform covers" lede="Nine areas, each with its own section on the features page: how it works, why it helps, its limits and its plan." />
                <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {FEATURE_GROUPS.map((g) => (
                        <li key={g.id}>
                            <SiteCard href={`/features#${g.id}`} title={g.title} body={g.summary} className="h-full">
                                <p className="mt-4 text-[13px] text-muted">{g.features.map((f) => f.name).join(' · ')}</p>
                            </SiteCard>
                        </li>
                    ))}
                </ul>
            </Section>

            <Section tone="surface" className="border-t border-line">
                <SectionHeading eyebrow="Explore" title="More about the product" />
                <ul className="mt-8 grid gap-4 md:grid-cols-3">
                    {PRODUCT_PAGES.filter((p) => p.href !== '/product').map((p) => (
                        <li key={p.href}>
                            <Link href={p.href} className="group flex h-full flex-col rounded-xl border border-line bg-white p-6 transition-colors hover:border-slate-300">
                                <span className="text-[17px] font-semibold text-navy-950">{p.title}</span>
                                <span className="mt-2 flex-1 text-[15px] leading-[1.55] text-muted-strong">{p.body}</span>
                                <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-accent-700">Open <ArrowIcon /></span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </Section>

            <CtaBand title="One script tag to your first result." body={FREE_LINE} href="/signin" label="Start for free" />
        </SitePage>
    );
}
