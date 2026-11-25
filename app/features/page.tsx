import Link from 'next/link';
import { aiConfigured } from '@/lib/ai/crypto';
import { pageMetadata } from '@/lib/site/meta';
import { FEATURE_GROUPS, FREE_LINE, NOT_YET, type FeatureGroup } from '@/lib/site/product';
import { Breadcrumbs, Container, CtaBand, PageHero, PlanBadge, ProductSubnav, Section, SitePage } from '../components/site';

export const metadata = pageMetadata({
    path: '/features',
    title: 'Features: A/B testing software, plan by plan',
    description: 'Every FreeABTest feature with how it works, what it is good for, its limits and the plan that includes it: tests, traffic, assignment, goals, statistics, reports and APIs.',
});

// AI suggestions need the customer's own provider key and only show once AI is switched on for the site.
const AI_GROUP: FeatureGroup = {
    id: 'ai', title: 'AI suggestions', summary: 'Help with ideas and copy, using your own AI provider key.',
    features: [
        { name: 'Test ideas, hypotheses and copy', plan: 'Growth and above', href: '/docs/ai',
            what: 'Test ideas from any page, a hypothesis in the new test wizard, and other versions of a headline or button.',
            how: 'You add your own key for OpenAI, Gemini, DeepSeek or Claude. Requests go to your provider and you pay it directly.',
            benefit: 'A faster start on the next test.',
            limits: 'Suggestions are a starting point. Check them before you test them.' },
        { name: 'Results in plain words', plan: 'Growth and above', href: '/docs/ai',
            what: 'A short summary of what the numbers mean, and ideas for a follow-up test.',
            how: 'The summary is built on the statistical verdict and never goes against it.',
            benefit: 'Share a result with people who do not read p-values.',
            limits: 'It summarises the data you have. It does not add certainty.' },
    ],
};

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <dt className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</dt>
            <dd className="mt-1 text-[15px] leading-[1.55] text-muted-strong">{children}</dd>
        </div>
    );
}

export default function FeaturesPage() {
    const groups = aiConfigured() ? [...FEATURE_GROUPS, AI_GROUP] : FEATURE_GROUPS;
    return (
        <SitePage>
            <PageHero eyebrow="Features" title="Everything a test needs, and what each part can and cannot do"
                lede="Each feature below is in the product today. For every one you can see how it works, why it helps, where it stops, and which plan includes it."
                actions={[{ href: '/signin', label: 'Start for free' }, { href: '/pricing#compare', label: 'Compare plans' }]}>
                <Breadcrumbs items={[{ href: '/product', label: 'Product' }, { href: '/features', label: 'Features' }]} />
            </PageHero>
            <ProductSubnav current="/features" />

            <Section className="!py-10 md:!py-12">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">Jump to</h2>
                <ul className="mt-4 flex flex-wrap gap-2">
                    {groups.map((g) => (
                        <li key={g.id}><a href={`#${g.id}`} className="inline-block rounded-lg border border-line px-3 py-1.5 text-[14px] font-medium text-navy-950 hover:bg-surface">{g.title}</a></li>
                    ))}
                </ul>
                <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] text-muted-strong">
                    <span className="flex items-center gap-2"><PlanBadge plan="Every plan" /> includes the free plan</span>
                    <span className="flex items-center gap-2"><PlanBadge plan="Paid plans" /> Starter, Growth and Enterprise</span>
                    <span className="flex items-center gap-2"><PlanBadge plan="Growth and above" /> Growth and Enterprise</span>
                </div>
            </Section>

            {groups.map((g, gi) => (
                <section key={g.id} id={g.id} aria-labelledby={`${g.id}-title`} className={`scroll-mt-20 border-t border-line py-14 md:py-20 ${gi % 2 ? 'bg-surface' : 'bg-white'}`}>
                    <Container className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-16">
                        <div className="lg:sticky lg:top-28 lg:self-start">
                            <h2 id={`${g.id}-title`} className="text-[26px] font-semibold leading-[1.2] tracking-[-0.02em] text-navy-950">{g.title}</h2>
                            <p className="mt-3 text-[16px] leading-[1.6] text-muted-strong">{g.summary}</p>
                        </div>
                        <div className="grid gap-4">
                            {g.features.map((f) => (
                                <article key={f.name} className="rounded-xl border border-line bg-white p-6">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <h3 className="text-[18px] font-semibold text-navy-950">{f.name}</h3>
                                        <PlanBadge plan={f.plan} />
                                    </div>
                                    <p className="mt-2 text-[16px] leading-[1.6] text-navy-950">{f.what}</p>
                                    <dl className="mt-5 grid gap-4 md:grid-cols-3">
                                        <Detail label="How it works">{f.how}</Detail>
                                        <Detail label="Why it helps">{f.benefit}</Detail>
                                        <Detail label="Limits">{f.limits}</Detail>
                                    </dl>
                                    <Link href={f.href} className="mt-5 inline-block text-[14px] font-medium text-accent-700 hover:underline">Read the docs</Link>
                                </article>
                            ))}
                        </div>
                    </Container>
                </section>
            ))}

            <Section tone="surface" className="border-t border-line !py-12">
                <h2 className="text-[20px] font-semibold text-navy-950">Not available yet</h2>
                <p className="mt-2 max-w-[680px] text-[16px] leading-[1.6] text-muted-strong">
                    These are not built yet and are marked coming soon on the <Link href="/pricing#compare" className="font-medium text-accent-700 hover:underline">pricing page</Link>: {NOT_YET.join(', ').toLowerCase()}. Please do not choose a plan for a feature that is not built.
                </p>
            </Section>

            <CtaBand title="Try every free feature on your own site." body={FREE_LINE} href="/signin" label="Start for free" />
        </SitePage>
    );
}
