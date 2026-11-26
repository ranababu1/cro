import Link from 'next/link';
import { pageMetadata } from '@/lib/site/meta';
import { SITE_URL } from '@/lib/blog';
import { breadcrumbListNode, faqPageNode } from '@/lib/site/jsonLd';
import { BILLING_QUESTIONS, FAQ_GROUPS, allFaqItems } from '@/lib/site/faq';
import { Breadcrumbs, CtaBand, PageHero, Section, SitePage } from '../components/site';

export const metadata = pageMetadata({
    path: '/faq',
    title: 'FAQ: A/B testing with FreeABTest',
    description: 'Answers about setting up FreeABTest, running A/B and split URL tests, how results and significance are calculated, the SDK and API, and privacy.',
});

export default function FaqPage() {
    const crumbs = [{ href: '/resources', label: 'Resources' }, { href: '/faq', label: 'FAQ' }];
    return (
        <SitePage schema={[breadcrumbListNode(crumbs), faqPageNode(allFaqItems(), `${SITE_URL}/faq`)]}>
            <PageHero eyebrow="FAQ" title="Frequently asked questions"
                lede="Short answers about setup, running tests, results, the SDK and privacy. Questions about plans and billing are answered on the pricing page."
                actions={[{ href: '/signin', label: 'Start for free' }, { href: '/contact', label: 'Ask a question' }]}>
                <Breadcrumbs items={crumbs} />
            </PageHero>

            <nav aria-label="On this page" className="border-b border-line bg-white">
                <ul className="mx-auto flex max-w-[1200px] gap-x-5 overflow-x-auto px-5 py-3 text-[14px] text-muted-strong sm:px-8 lg:flex-wrap">
                    {FAQ_GROUPS.map((g) => <li key={g.id} className="shrink-0"><a href={`#${g.id}`} className="hover:text-navy-950">{g.title}</a></li>)}
                    <li className="shrink-0"><a href="#billing" className="hover:text-navy-950">Plans and billing</a></li>
                </ul>
            </nav>

            <Section>
                <div className="mx-auto max-w-[820px] space-y-14">
                    {FAQ_GROUPS.map((g) => (
                        <section key={g.id} id={g.id} aria-labelledby={`${g.id}-title`} className="scroll-mt-24">
                            <h2 id={`${g.id}-title`} className="text-[22px] font-semibold tracking-[-0.01em] text-navy-950">{g.title}</h2>
                            <div className="mt-4 divide-y divide-line rounded-xl border border-line bg-white">
                                {g.items.map((f) => (
                                    <details key={f.q} className="group p-5">
                                        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[16px] font-semibold text-navy-950">
                                            <span>{f.q}</span>
                                            <span aria-hidden className="mt-0.5 shrink-0 text-muted transition group-open:rotate-45">+</span>
                                        </summary>
                                        <p className="mt-3 text-[15px] leading-[1.65] text-muted-strong">{f.a}</p>
                                        {f.href && <Link href={f.href} className="mt-3 inline-block text-[14px] font-medium text-accent-700 hover:underline">{f.link} →</Link>}
                                    </details>
                                ))}
                            </div>
                        </section>
                    ))}
                    <section id="billing" aria-labelledby="billing-title" className="scroll-mt-24">
                        <h2 id="billing-title" className="text-[22px] font-semibold tracking-[-0.01em] text-navy-950">Plans and billing</h2>
                        <p className="mt-2 text-[15px] text-muted-strong">These are answered with the plans on the pricing page.</p>
                        <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-white">
                            {BILLING_QUESTIONS.map((q) => (
                                <li key={q}><Link href="/pricing#faq" className="flex items-center justify-between gap-4 p-5 text-[16px] font-medium text-navy-950 hover:underline"><span>{q}</span><span aria-hidden className="text-muted">→</span></Link></li>
                            ))}
                        </ul>
                    </section>
                </div>
            </Section>

            <CtaBand title="Still have a question?" body="Send it to us and we will answer by email." href="/contact" label="Contact us" />
        </SitePage>
    );
}
