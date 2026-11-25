import Link from 'next/link';

export type CardPost = { slug: string; title: string; description: string; date: string; dateLabel: string; readingMinutes: number; category: string };

export function CategoryTag({ children }: { children: React.ReactNode }) {
    return <span className="inline-flex w-fit items-center self-start rounded-full bg-accent-50 px-2.5 py-0.5 text-[12px] font-medium text-accent-700 ring-1 ring-inset ring-accent-100">{children}</span>;
}

export function Meta({ p }: { p: Pick<CardPost, 'date' | 'dateLabel' | 'readingMinutes'> }) {
    return <p className="text-[13px] text-muted"><time dateTime={p.date}>{p.dateLabel}</time><span aria-hidden className="mx-2">·</span>{p.readingMinutes} min read</p>;
}

export function PostCard({ p, headingLevel = 3 }: { p: CardPost; headingLevel?: 2 | 3 }) {
    const H = `h${headingLevel}` as 'h2' | 'h3';
    return (
        <article className="group relative flex h-full flex-col rounded-xl border border-line bg-white p-6 shadow-xs transition-colors hover:border-navy-800/30 motion-reduce:transition-none">
            <CategoryTag>{p.category}</CategoryTag>
            <H className="mt-4 text-[19px] font-semibold leading-snug tracking-[-0.01em] text-navy-950">
                <Link href={`/blog/${p.slug}`} className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none group-hover:underline">{p.title}</Link>
            </H>
            <p className="mt-3 line-clamp-3 flex-1 text-[15px] leading-[1.6] text-muted-strong">{p.description}</p>
            <div className="mt-6 border-t border-line pt-4"><Meta p={p} /></div>
            <span className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-accent-600 opacity-0 group-focus-within:opacity-100" aria-hidden />
        </article>
    );
}
