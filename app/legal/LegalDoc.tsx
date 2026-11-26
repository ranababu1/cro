import Link from 'next/link';
import { Breadcrumbs, SiteFooter, SiteHeader } from '../components/site';
import { COMPANY_PAGES, LEGAL_PAGES, LEGAL_UPDATED } from '@/lib/legal';

const COMPANY = [...COMPANY_PAGES, { slug: 'security', href: '/security', title: 'Security' }] as const;
const NAV = [...COMPANY_PAGES, ...LEGAL_PAGES, { slug: 'security', href: '/security', title: 'Security' }] as const;

const PROSE = 'legal-prose min-w-0 space-y-4 text-[16px] leading-[1.7] text-muted-strong [&_a]:font-medium [&_a]:text-accent-700 [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-12 [&_h2]:scroll-mt-24 [&_h2]:border-t [&_h2]:border-line [&_h2]:pt-8 [&_h2]:text-[22px] [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-navy-950 [&_h2:first-child]:mt-0 [&_h2:first-child]:border-0 [&_h2:first-child]:pt-0 [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-navy-950 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-2 [&_strong]:text-navy-950 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:rounded-xl [&_table]:border [&_table]:border-line [&_table]:text-[14px] [&_td]:border-t [&_td]:border-line [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_th]:bg-surface [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-navy-950';

/** Shared frame for the legal and company policy pages: title, last updated date, links between the documents and readable prose. */
export function LegalDoc({ slug, title, intro, children }: { slug: string; title: string; intro?: React.ReactNode; children: React.ReactNode }) {
    const isCompany = COMPANY.some((p) => p.slug === slug);
    const section = isCompany ? 'Company' : 'Legal';
    const self = NAV.find((p) => p.slug === slug);
    return (
        <div className="min-h-screen bg-site-gradient text-navy-950">
            <SiteHeader />
            <main id="main">
                <header className="border-b border-line">
                    <div className="mx-auto max-w-[1200px] px-5 pb-12 pt-10 sm:px-8 sm:pt-12">
                        <Breadcrumbs items={[{ href: self?.href ?? '/legal/terms', label: title }]} />
                        <p className="mt-8 text-[13px] font-semibold uppercase tracking-[0.08em] text-accent-700">{section}</p>
                        <h1 className="mt-3 max-w-[760px] text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-navy-950 sm:text-[44px]">{title}</h1>
                        <p className="mt-3 text-[14px] text-muted">Last updated {LEGAL_UPDATED}</p>
                        {intro && <div className="mt-6 max-w-[760px] text-[17px] leading-[1.65] text-muted-strong [&_a]:font-medium [&_a]:text-accent-700 [&_a]:underline">{intro}</div>}
                    </div>
                </header>

                <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16 lg:py-16">
                    <nav aria-label="Legal documents" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
                        {[{ heading: 'Company', pages: COMPANY }, { heading: 'Legal', pages: LEGAL_PAGES }].map((g) => (
                            <div key={g.heading} className="mb-6 last:mb-0">
                                <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{g.heading}</p>
                                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[14px] lg:flex-col lg:gap-1">
                                    {g.pages.map((p) => (
                                        <li key={p.slug}>
                                            <Link href={p.href} aria-current={p.slug === slug ? 'page' : undefined}
                                                className={p.slug === slug ? 'font-semibold text-navy-950 lg:-ml-3 lg:block lg:border-l-2 lg:border-accent-600 lg:pl-[10px]' : 'text-muted-strong hover:text-navy-950 lg:block'}>{p.title}</Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </nav>
                    <div className={`${PROSE} max-w-[760px]`}>
                        {children}
                    </div>
                </div>
            </main>
            <SiteFooter />
        </div>
    );
}
