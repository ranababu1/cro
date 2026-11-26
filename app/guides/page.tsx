import Link from 'next/link';
import { pageMetadata } from '@/lib/site/meta';
import { getPost } from '@/lib/blog';
import { getDocPage } from '@/lib/docs';
import { GUIDE_SECTIONS, type GuideRef } from '@/lib/site/resources';
import { Breadcrumbs, CtaBand, PageHero, Section, SectionHeading, SitePage } from '../components/site';
import { breadcrumbListNode } from '@/lib/site/jsonLd';

export const metadata = pageMetadata({
    path: '/guides',
    title: 'A/B testing guides: plan tests, read results, set up',
    description: 'Hand-picked guides for planning A/B tests, working out sample size and run time, reading results correctly and setting up tests in the browser or on a server.',
});

/** Resolves a guide to its link, title and label. Throws at build time if a slug no longer exists. */
function resolve(g: GuideRef): { href: string; title: string; label: string; minutes?: number } {
    if (g.kind === 'blog') {
        const p = getPost(g.slug);
        if (!p) throw new Error(`No blog post ${g.slug}`);
        return { href: `/blog/${p.slug}`, title: p.title, label: 'Article', minutes: p.readingMinutes };
    }
    if (g.kind === 'docs') {
        const d = getDocPage(g.slug);
        if (!d) throw new Error(`No docs page ${g.slug}`);
        return { href: `/docs/${d.slug}`, title: d.title, label: 'Docs' };
    }
    return { href: g.slug, title: 'Statistical methodology', label: 'Reference' };
}

export default function GuidesPage() {
    return (
        <SitePage schema={[breadcrumbListNode([{ href: '/resources', label: 'Resources' }, { href: '/guides', label: 'Guides' }])]}>
            <PageHero eyebrow="Guides" title="Guides for running better tests"
                lede="A short reading list in three parts: plan a test, read the results and set things up. Each guide is an article or docs page you can read in a few minutes."
                actions={[{ href: '/signin', label: 'Start for free' }, { href: '/resources', label: 'All resources' }]}>
                <Breadcrumbs items={[{ href: '/resources', label: 'Resources' }, { href: '/guides', label: 'Guides' }]} />
            </PageHero>

            <nav aria-label="On this page" className="border-b border-line bg-white">
                <ul className="mx-auto flex max-w-[1200px] gap-x-5 px-5 py-3 text-[14px] text-muted-strong sm:px-8">
                    {GUIDE_SECTIONS.map((s) => <li key={s.id} className="shrink-0"><a href={`#${s.id}`} className="hover:text-navy-950">{s.title}</a></li>)}
                </ul>
            </nav>

            {GUIDE_SECTIONS.map((s, i) => (
                <Section key={s.id} id={s.id} tone={i % 2 ? 'surface' : 'white'} labelledBy={`${s.id}-title`}>
                    <SectionHeading id={`${s.id}-title`} eyebrow={`Step ${i + 1}`} title={s.title} lede={s.lede} />
                    <ol className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
                        {s.guides.map((g) => {
                            const r = resolve(g);
                            return (
                                <li key={r.href} className="min-w-0">
                                    <Link href={r.href} className="group flex h-full flex-col rounded-xl border border-line bg-white p-5 shadow-xs transition hover:border-navy-800/30">
                                        <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-accent-700">{r.label}{r.minutes ? ` · ${r.minutes} min read` : ''}</span>
                                        <span className="mt-2 text-[17px] font-semibold leading-snug text-navy-950 group-hover:underline">{r.title}</span>
                                        <span className="mt-2 text-[15px] leading-[1.6] text-muted-strong">{g.note}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ol>
                </Section>
            ))}

            <CtaBand title="Put a guide into practice" body="Start a test on the free plan. No card, no time limit." href="/signin" label="Start for free" />
        </SitePage>
    );
}
