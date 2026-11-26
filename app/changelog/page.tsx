import Link from 'next/link';
import { pageMetadata } from '@/lib/site/meta';
import { formatDate } from '@/lib/blog';
import { RELEASES, itemPlan } from '@/lib/changelog';
import { Breadcrumbs, CtaBand, PageHero, PlanBadge, Section, SitePage } from '../components/site';
import { breadcrumbListNode } from '@/lib/site/jsonLd';

export const metadata = pageMetadata({
    path: '/changelog',
    title: 'Changelog: what is new in FreeABTest',
    description: 'New features and improvements in FreeABTest, newest first, with the plan each feature is part of.',
});

export default function ChangelogPage() {
    return (
        <SitePage schema={[breadcrumbListNode([{ href: '/resources', label: 'Resources' }, { href: '/changelog', label: 'Changelog' }])]}>
            <PageHero eyebrow="Changelog" title="What is new"
                lede="Features and improvements we have shipped, newest first. Each feature shows the plans it is part of today."
                actions={[{ href: '/signin', label: 'Start for free' }, { href: '/features', label: 'See all features' }]}>
                <Breadcrumbs items={[{ href: '/resources', label: 'Resources' }, { href: '/changelog', label: 'Changelog' }]} />
            </PageHero>

            <Section>
                <ol className="mx-auto max-w-[860px] space-y-12">
                    {RELEASES.map((r) => (
                        <li key={r.id} id={r.id} className="scroll-mt-24 grid grid-cols-1 gap-3 md:grid-cols-[160px_minmax(0,1fr)] md:gap-8">
                            <time dateTime={r.date} className="text-[14px] font-medium text-muted md:pt-1">{formatDate(r.date)}</time>
                            <article className="min-w-0 rounded-xl border border-line bg-white p-5 shadow-xs sm:p-6">
                                <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-navy-950">{r.title}</h2>
                                {r.summary && <p className="mt-2 text-[15px] leading-[1.6] text-muted-strong">{r.summary}</p>}
                                <ul className="mt-4 space-y-3">
                                    {r.items.map((i) => {
                                        const plan = itemPlan(i);
                                        return (
                                            <li key={i.text} className="flex flex-col gap-1.5 text-[15px] leading-[1.6] text-muted-strong sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                                                <span className="flex gap-2.5"><span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-600" />
                                                    <span>{i.href ? <Link href={i.href} className="text-navy-950 underline decoration-line underline-offset-4 hover:decoration-navy-800">{i.text}</Link> : i.text}</span>
                                                </span>
                                                {plan && <PlanBadge plan={plan} className="ml-4 self-start sm:ml-0" />}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </article>
                        </li>
                    ))}
                </ol>
            </Section>

            <CtaBand title="Try what is new" body="Every feature on the free plan is free for good. No card, no time limit." href="/signin" label="Start for free" />
        </SitePage>
    );
}
