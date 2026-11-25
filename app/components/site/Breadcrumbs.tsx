import Link from 'next/link';
import { SITE_URL, ldJson } from '@/lib/blog';

export type Crumb = { href: string; label: string };

/** Visible breadcrumb trail plus BreadcrumbList structured data. The last crumb is the current page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
    const all: Crumb[] = [{ href: '/', label: 'Home' }, ...items];
    const json = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: all.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, item: `${SITE_URL}${c.href === '/' ? '/' : c.href}` })),
    };
    return (
        <nav aria-label="Breadcrumb" className="mb-6">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(JSON.stringify(json)) }} />
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
