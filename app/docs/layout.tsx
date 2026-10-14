import Link from 'next/link';
import type { Metadata } from 'next';
import { Logo } from '../components/ui/Logo';
import { ButtonLink } from '../components/ui';
import { buildSearchIndex, navGroups } from '@/lib/docs';
import { DocsSearch } from './_components/DocsSearch';
import { DocsMobileNav, DocsSidebar } from './_components/DocsNav';

export const metadata: Metadata = { title: { default: 'Documentation', template: '%s · Docs · freeabtest.com' } };

export default function DocsLayout({ children }: { children: React.ReactNode }) {
    const groups = navGroups().map((g) => ({ group: g.group, pages: g.pages.map((p) => ({ slug: p.slug, title: p.title })) }));
    const index = buildSearchIndex();
    return (
        <div className="min-h-screen bg-white text-zinc-900">
            <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
                    <Logo />
                    <Link href="/docs" className="hidden rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 sm:block">Docs</Link>
                    <div className="mx-auto hidden w-full max-w-md md:block"><DocsSearch index={index} /></div>
                    <div className="ml-auto flex items-center gap-3 md:ml-0">
                        <Link href="/dashboard" className="hidden text-sm font-medium text-zinc-600 hover:text-zinc-900 sm:block">Dashboard</Link>
                        <ButtonLink href="/signin" size="sm" className="bg-zinc-900 hover:bg-zinc-800">Start for free</ButtonLink>
                    </div>
                </div>
                <div className="px-4 pb-3 md:hidden"><DocsSearch index={index} /></div>
            </header>
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
                <aside className="hidden lg:block">
                    <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto py-8 pr-2"><DocsSidebar groups={groups} /></div>
                </aside>
                <div className="min-w-0 py-6 lg:py-10">
                    <div className="mb-6 lg:hidden"><DocsMobileNav groups={groups} /></div>
                    {children}
                </div>
            </div>
            <footer className="border-t border-zinc-200">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-xs text-zinc-500 sm:px-6">
                    <span>© {new Date().getFullYear()} freeabtest.com</span>
                    <Link href="/" className="hover:text-zinc-900">Home</Link>
                    <Link href="/docs" className="hover:text-zinc-900">Docs</Link>
                    <Link href="/signin" className="hover:text-zinc-900">Sign in</Link>
                </div>
            </footer>
        </div>
    );
}
