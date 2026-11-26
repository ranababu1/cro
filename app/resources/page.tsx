import Link from 'next/link';
import { pageMetadata } from '@/lib/site/meta';
import { formatDate, getAllPosts } from '@/lib/blog';
import { latestReleases } from '@/lib/changelog';
import { RESOURCE_LINKS, listablePost } from '@/lib/site/resources';
import { Breadcrumbs, CtaBand, PageHero, Section, SectionHeading, SitePage } from '../components/site';
import { breadcrumbListNode } from '@/lib/site/jsonLd';

export const metadata = pageMetadata({
    path: '/resources',
    title: 'Resources: guides, blog, docs, FAQ and changelog',
    description: 'Everything to help you run A/B tests with FreeABTest: curated guides, the blog, documentation, the FAQ, the changelog and how results are calculated.',
});

export default function ResourcesPage() {
    const posts = getAllPosts().filter(listablePost).slice(0, 3);
    const releases = latestReleases(3);
    return (
        <SitePage schema={[breadcrumbListNode([{ href: '/resources', label: 'Resources' }])]}>
            <PageHero eyebrow="Resources" title="Learn, set up and stay up to date"
                lede="Guides for planning and reading tests, documentation for every feature, answers to common questions and what is new in the product."
                actions={[{ href: '/guides', label: 'Start with the guides' }, { href: '/docs', label: 'Read the docs' }]}>
                <Breadcrumbs items={[{ href: '/resources', label: 'Resources' }]} />
            </PageHero>

            <Section labelledBy="all-title">
                <SectionHeading id="all-title" eyebrow="Browse" title="All resources" />
                <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {RESOURCE_LINKS.map((r) => (
                        <li key={r.href} className="min-w-0">
                            <Link href={r.href} className="group flex h-full flex-col rounded-xl border border-line bg-white p-5 shadow-xs transition hover:border-navy-800/30">
                                <span className="text-[17px] font-semibold text-navy-950 group-hover:underline">{r.title}</span>
                                <span className="mt-2 text-[15px] leading-[1.6] text-muted-strong">{r.body}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </Section>

            <Section tone="surface" labelledBy="latest-title">
                <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
                    <div className="min-w-0">
                        <SectionHeading id="latest-title" eyebrow="Blog" title="Latest articles" />
                        <ul className="mt-8 divide-y divide-line rounded-xl border border-line bg-white">
                            {posts.map((p) => (
                                <li key={p.slug} className="p-5">
                                    <Link href={`/blog/${p.slug}`} className="font-semibold text-navy-950 hover:underline">{p.title}</Link>
                                    <p className="mt-1 text-[13px] text-muted">{formatDate(p.date)} · {p.readingMinutes} min read</p>
                                </li>
                            ))}
                        </ul>
                        <Link href="/blog" className="mt-4 inline-block text-[15px] font-medium text-accent-700 hover:underline">All articles →</Link>
                    </div>
                    <div className="min-w-0">
                        <SectionHeading id="new-title" eyebrow="Changelog" title="Recently shipped" />
                        <ul className="mt-8 divide-y divide-line rounded-xl border border-line bg-white">
                            {releases.map((r) => (
                                <li key={r.id} className="p-5">
                                    <Link href={`/changelog#${r.id}`} className="font-semibold text-navy-950 hover:underline">{r.title}</Link>
                                    <p className="mt-1 text-[13px] text-muted">{formatDate(r.date)} · {r.items.length} {r.items.length === 1 ? 'change' : 'changes'}</p>
                                </li>
                            ))}
                        </ul>
                        <Link href="/changelog" className="mt-4 inline-block text-[15px] font-medium text-accent-700 hover:underline">Full changelog →</Link>
                    </div>
                </div>
            </Section>

            <CtaBand title="Ready to run a test?" body="Start on the free plan. No card, no time limit." href="/signin" label="Start for free" />
        </SitePage>
    );
}
