import Link from 'next/link';
import { pageMetadata } from '@/lib/site/meta';
import { FREE_LINE } from '@/lib/site/product';
import { SOLUTIONS, solutionBySlug, type Solution } from '@/lib/site/solutions';
import { Breadcrumbs, CtaBand, PageHero, PlanBadge, Section, SectionHeading, SitePage, SolutionsSubnav } from '../components/site';
import { breadcrumbListNode } from '@/lib/site/jsonLd';

export function solutionMetadata(slug: Solution['slug']) {
    const s = solutionBySlug(slug);
    return pageMetadata({ path: `/solutions/${slug}`, title: s.metaTitle, description: s.metaDescription });
}

/** One audience page: challenges, a worked workflow, test ideas, goals, plan notes and next links. */
export function SolutionPage({ slug }: { slug: Solution['slug'] }) {
    const s = solutionBySlug(slug);
    const path = `/solutions/${slug}`;
    const others = SOLUTIONS.filter((o) => o.slug !== slug);
    return (
        <SitePage schema={[breadcrumbListNode([{ href: '/solutions', label: 'Solutions' }, { href: path, label: s.name }])]}>
            <PageHero eyebrow={s.eyebrow} title={s.title} lede={s.lede} actions={[{ href: '/signin', label: 'Start for free' }, { href: s.links[0].href, label: s.links[0].label }]}>
                <Breadcrumbs items={[{ href: '/solutions', label: 'Solutions' }, { href: path, label: s.name }]} />
            </PageHero>
            <SolutionsSubnav current={path} />

            <Section>
                <SectionHeading eyebrow="What gets in the way" title="Problems this solves" />
                <ul className="mt-10 grid gap-4 md:grid-cols-3">
                    {s.challenges.map((c) => (
                        <li key={c.title} className="rounded-xl border border-line p-6">
                            <h3 className="text-[17px] font-semibold text-navy-950">{c.title}</h3>
                            <p className="mt-2 text-[15px] leading-[1.6] text-muted-strong">{c.body}</p>
                        </li>
                    ))}
                </ul>
            </Section>

            <Section id="workflow" tone="surface" className="border-t border-line" labelledBy="workflow-title">
                <div className="grid gap-10 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-16">
                    <div className="lg:sticky lg:top-28 lg:self-start">
                        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent-700">Workflow</p>
                        <h2 id="workflow-title" className="mt-3 text-[28px] font-semibold leading-[1.2] tracking-[-0.02em] text-navy-950 md:text-[32px]">{s.workflow.name}</h2>
                        <p className="mt-4 text-[16px] leading-[1.6] text-muted-strong">{s.workflow.context}</p>
                    </div>
                    <ol className="grid gap-3">
                        {s.workflow.steps.map((st, i) => (
                            <li key={st.title} className="flex gap-4 rounded-xl border border-line bg-white p-5">
                                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white ${i === s.workflow.steps.length - 1 ? 'bg-accent-700' : 'bg-navy-950'}`}>{i + 1}</span>
                                <div>
                                    <h3 className="text-[16px] font-semibold text-navy-950">{st.title}</h3>
                                    <p className="mt-1 text-[15px] leading-[1.6] text-muted-strong">{st.body}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </Section>

            <Section labelledBy="ideas-title">
                <SectionHeading id="ideas-title" eyebrow="Test ideas" title="Where to start" lede="Each idea names the feature it uses and the plan that includes it." />
                <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {s.ideas.map((idea) => (
                        <li key={idea.title} className="flex flex-col rounded-xl border border-line p-6">
                            <h3 className="text-[17px] font-semibold text-navy-950">{idea.title}</h3>
                            <p className="mt-2 flex-1 text-[15px] leading-[1.6] text-muted-strong">{idea.body}</p>
                            <div className="mt-5 flex flex-wrap items-center gap-2 text-[13px] text-muted-strong">
                                <Link href={idea.href} className="font-medium text-accent-700 hover:underline">{idea.feature}</Link>
                                <PlanBadge plan={idea.plan} />
                            </div>
                        </li>
                    ))}
                </ul>
            </Section>

            <Section tone="surface" className="border-t border-line">
                <div className="grid gap-12 lg:grid-cols-2">
                    <div>
                        <SectionHeading eyebrow="Goals" title="What to measure" />
                        <ul className="mt-8 divide-y divide-line rounded-xl border border-line bg-white">
                            {s.goals.map((g) => (
                                <li key={g.name} className="flex flex-wrap items-start justify-between gap-3 p-4">
                                    <div>
                                        <p className="text-[15px] font-semibold text-navy-950">{g.name}</p>
                                        <p className="mt-0.5 text-[14px] text-muted-strong">{g.how}</p>
                                    </div>
                                    <PlanBadge plan={g.plan} />
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <SectionHeading eyebrow="Plans" title="Which plan fits" />
                        <ul className="mt-8 grid gap-3">
                            {s.planNote.map((p) => (
                                <li key={p.plan} className="rounded-xl border border-line bg-white p-4">
                                    <p className="text-[15px] font-semibold text-navy-950">{p.plan}</p>
                                    <p className="mt-1 text-[15px] leading-[1.55] text-muted-strong">{p.body}</p>
                                </li>
                            ))}
                        </ul>
                        <p className="mt-4 text-[14px]"><Link href="/pricing" className="font-medium text-accent-700 hover:underline">Compare every plan</Link></p>
                    </div>
                </div>
            </Section>

            <Section>
                <div className="grid gap-10 md:grid-cols-2">
                    <div>
                        <h2 className="text-[20px] font-semibold text-navy-950">Read next</h2>
                        <ul className="mt-4 grid gap-2">
                            {s.links.map((l) => <li key={l.href}><Link href={l.href} className="text-[15px] font-medium text-accent-700 hover:underline">{l.label}</Link></li>)}
                        </ul>
                    </div>
                    <div>
                        <h2 className="text-[20px] font-semibold text-navy-950">Other solutions</h2>
                        <ul className="mt-4 grid gap-2">
                            {others.map((o) => <li key={o.slug}><Link href={`/solutions/${o.slug}`} className="text-[15px] font-medium text-accent-700 hover:underline">{o.name}</Link><span className="text-[14px] text-muted">: {o.navBody.toLowerCase()}</span></li>)}
                        </ul>
                    </div>
                </div>
            </Section>

            <CtaBand title="Run the first test this week." body={FREE_LINE} href="/signin" label="Start for free" />
        </SitePage>
    );
}

