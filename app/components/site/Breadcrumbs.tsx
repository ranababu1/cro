import Link from 'next/link';
import { breadcrumbListNode } from '@/lib/site/jsonLd';

export type Crumb = { href: string; label: string };

/** Visible breadcrumb trail. Structured data is merged into the page's single JSON-LD graph via breadcrumbListNode. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
    const all: Crumb[] = [{ href: '/', label: 'Home' }, ...items];
    return (
        <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex flex-wrap items-center gap-1.5 text-[14px] text-muted">
                {all.map((c, i) => {
                    const last = i === all.length - 1;
                    return (
                        <li key={c.href} className="flex items-center gap-1.5">
                            {last ? <span aria-current="page" className="text-muted-strong">{c.label}</span> : <Link href={c.href} className="hover:text-navy-950">{c.label}</Link>}
                            {!last && <span aria-hidden className="text-slate-300">/</span>}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

export { breadcrumbListNode };
