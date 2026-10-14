import Link from 'next/link';
import type { DocPage } from '@/lib/docs';
import { docPages, tocFor } from '@/lib/docs';
import { Blocks } from './Blocks';
import { Toc } from './Toc';

export function DocArticle({ page }: { page: DocPage }) {
    const i = docPages.findIndex((p) => p.slug === page.slug);
    const prev = docPages[i - 1];
    const next = docPages[i + 1];
    const toc = tocFor(page);
    return (
        <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_13rem] xl:gap-10">
            <article className="min-w-0 max-w-3xl">
                <p className="text-sm font-medium text-brand-700">{page.group}</p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900">{page.title}</h1>
                <p className="mt-3 text-lg leading-7 text-zinc-600">{page.description}</p>
                <div className="mt-8"><Blocks blocks={page.blocks} /></div>
                <nav aria-label="Pagination" className="mt-14 grid gap-3 border-t border-zinc-200 pt-6 sm:grid-cols-2">
                    {prev ? (
                        <Link href={`/docs/${prev.slug}`} className="rounded-lg border border-zinc-200 px-4 py-3 hover:border-brand-200 hover:bg-brand-50/40">
                            <span className="block text-xs text-zinc-500">Previous</span>
                            <span className="text-sm font-medium text-zinc-900">{prev.title}</span>
                        </Link>
                    ) : <span />}
                    {next && (
                        <Link href={`/docs/${next.slug}`} className="rounded-lg border border-zinc-200 px-4 py-3 text-right hover:border-brand-200 hover:bg-brand-50/40">
                            <span className="block text-xs text-zinc-500">Next</span>
                            <span className="text-sm font-medium text-zinc-900">{next.title}</span>
                        </Link>
                    )}
                </nav>
            </article>
            <aside className="hidden xl:block">
                <div className="sticky top-24"><Toc items={toc} /></div>
            </aside>
        </div>
    );
}
