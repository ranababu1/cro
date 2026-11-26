import Link from 'next/link';
import type { Metadata } from 'next';
import { buildSearchIndex, navGroups } from '@/lib/docs';
import { JsonLd, SiteFooter, SiteHeader } from '../components/site';
import { DocsSearch } from './_components/DocsSearch';
import { DocsMobileNav, DocsSidebar } from './_components/DocsNav';

export const metadata: Metadata = { title: { default: 'Documentation', template: '%s · Docs · freeabtest.com' } };

/** Docs shell: the site header and footer, a docs bar with search, the page list and the article. */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
    const groups = navGroups().map((g) => ({ group: g.group, pages: g.pages.map((p) => ({ slug: p.slug, title: p.title })) }));
    const index = buildSearchIndex();
    return (
        <div className="min-h-screen bg-canvas text-navy-950">
            <JsonLd />
            <SiteHeader />
            <div role="region" aria-label="Documentation tools" className="z-40 border-b border-line bg-white lg:sticky lg:top-[72px]">
                <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3 sm:px-8 lg:h-14 lg:flex-nowrap lg:py-0">
                    <Link href="/docs" className="text-[15px] font-semibold text-navy-950 hover:text-accent-700">Documentation</Link>
                    <nav aria-label="Docs sections" className="hidden items-center gap-5 text-[14px] text-muted-strong lg:flex">
                        <Link href="/docs/quick-start" className="hover:text-navy-950">Quick start</Link>
                        <Link href="/docs/javascript-sdk" className="hover:text-navy-950">JavaScript SDK</Link>
                        <Link href="/docs/rest-api" className="hover:text-navy-950">REST API</Link>
                        <Link href="/docs/integrations" className="hover:text-navy-950">Integrations</Link>
                    </nav>
                    <div className="w-full lg:ml-auto lg:max-w-xs"><DocsSearch index={index} /></div>
                </div>
            </div>
            <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
                <aside aria-label="Documentation pages" className="hidden lg:block">
                    <div className="sticky top-[128px] max-h-[calc(100vh-128px)] overflow-y-auto py-8 pr-2"><DocsSidebar groups={groups} /></div>
                </aside>
                <main id="main" className="min-w-0 py-6 lg:py-10">
                    <div className="mb-6 lg:hidden"><DocsMobileNav groups={groups} /></div>
                    {children}
                </main>
            </div>
            <SiteFooter />
        </div>
    );
}
