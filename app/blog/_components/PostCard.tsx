import Link from 'next/link';

export type CardPost = { slug: string; title: string; description: string; date: string; dateLabel: string; readingMinutes: number; category: string };

export function CategoryTag({ children }: { children: React.ReactNode }) {
    return <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-1 text-[12px] font-semibold tracking-wide text-teal-800 ring-1 ring-inset ring-teal-600/15">{children}</span>;
}

export function Meta({ p }: { p: Pick<CardPost, 'date' | 'dateLabel' | 'readingMinutes'> }) {
    return <p className="text-[13px] text-zinc-500"><time dateTime={p.date}>{p.dateLabel}</time><span aria-hidden className="mx-2">·</span>{p.readingMinutes} min read</p>;
}

export function PostCard({ p, headingLevel = 3 }: { p: CardPost; headingLevel?: 2 | 3 }) {
    const H = `h${headingLevel}` as 'h2' | 'h3';
    return (
        <article className="group relative flex h-full flex-col rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-[0_1px_2px_rgb(16_24_40/0.04)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_12px_32px_-12px_rgb(37_99_235/0.25)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
            <CategoryTag>{p.category}</CategoryTag>
            <H className="mt-4 text-[19px] font-semibold leading-snug tracking-[-0.01em] text-[#0b1630]">
                <Link href={`/blog/${p.slug}`} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none group-focus-within:text-blue-700 group-hover:text-blue-700">{p.title}</Link>
            </H>
            <p className="mt-3 line-clamp-3 flex-1 text-[15px] leading-relaxed text-zinc-600">{p.description}</p>
            <div className="mt-6 border-t border-zinc-100 pt-4"><Meta p={p} /></div>
            <span className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-blue-500 opacity-0 group-focus-within:opacity-100" aria-hidden />
        </article>
    );
}
