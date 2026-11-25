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
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent-700">{page.group}</p>
                <h1 className="mt-2 text-[30px] font-semibold leading-[1.15] tracking-[-0.02em] text-navy-950 md:text-[36px]">{page.title}</h1>
                <p className="mt-3 text-[17px] leading-[1.6] text-muted-strong">{page.description}</p>
                <div className="mt-8"><Blocks blocks={page.blocks} /></div>
                <nav aria-label="Pagination" className="mt-14 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
                    {prev ? (
                        <Link href={`/docs/${prev.slug}`} className="rounded-xl border border-line px-4 py-3 hover:border-accent-600 hover:bg-accent-50/60">
                            <span className="block text-xs text-muted">Previous</span>
                            <span className="text-sm font-medium text-navy-950">{prev.title}</span>
                        </Link>
                    ) : <span />}
                    {next && (
                        <Link href={`/docs/${next.slug}`} className="rounded-xl border border-line px-4 py-3 text-right hover:border-accent-600 hover:bg-accent-50/60">
                            <span className="block text-xs text-muted">Next</span>
                            <span className="text-sm font-medium text-navy-950">{next.title}</span>
                        </Link>
                    )}
                </nav>
            </article>
            <aside className="hidden xl:block">
                <div className="sticky top-[152px]"><Toc items={toc} /></div>
            </aside>
        </div>
    );
}
