import Link from 'next/link';
import { SiteFooter, SiteHeader } from '../components/landing/SiteChrome';
import { LEGAL_PAGES, LEGAL_UPDATED } from '@/lib/legal';

/** Shared frame for the legal pages: title, last updated date, links between the documents and readable prose. */
export function LegalDoc({ slug, title, intro, children }: { slug: string; title: string; intro?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-white">
            <SiteHeader />
            <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
                <nav aria-label="Legal documents" className="mb-8 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    {LEGAL_PAGES.map((p) => (
                        <Link key={p.slug} href={`/legal/${p.slug}`} aria-current={p.slug === slug ? 'page' : undefined} className={p.slug === slug ? 'font-semibold text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}>{p.title}</Link>
                    ))}
                    <Link href="/security" className={slug === 'security' ? 'font-semibold text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}>Security</Link>
                </nav>
                <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">{title}</h1>
                <p className="mt-2 text-sm text-zinc-500">Last updated {LEGAL_UPDATED}</p>
                {intro && <div className="mt-6 text-[15px] leading-7 text-zinc-700 [&_a]:text-brand-700 [&_a]:underline">{intro}</div>}
                <div className="legal-prose mt-8 space-y-4 text-[15px] leading-7 text-zinc-700 [&_a]:text-brand-700 [&_a]:underline [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-zinc-900 [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-zinc-900 [&_li]:ml-5 [&_li]:list-disc [&_td]:border-t [&_td]:border-zinc-200 [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top [&_th]:py-2 [&_th]:pr-4 [&_th]:text-left [&_th]:text-zinc-900">
                    {children}
                </div>
            </main>
            <SiteFooter />
        </div>
    );
}
