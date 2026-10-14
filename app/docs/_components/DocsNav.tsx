'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavGroup { group: string; pages: { slug: string; title: string }[] }

function Links({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
    const path = usePathname();
    return (
        <div className="space-y-6">
            {groups.map((g) => (
                <div key={g.group}>
                    <p className="px-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{g.group}</p>
                    <ul className="mt-2 space-y-0.5">
                        {g.pages.map((p) => {
                            const href = `/docs/${p.slug}`;
                            const on = path === href || (path === '/docs' && p.slug === 'introduction');
                            return (
                                <li key={p.slug}>
                                    <Link href={href} onClick={onNavigate} aria-current={on ? 'page' : undefined} className={`block rounded-md px-2 py-1.5 text-sm ${on ? 'bg-brand-50 font-medium text-brand-700' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                                        {p.title}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </div>
    );
}

export function DocsSidebar({ groups }: { groups: NavGroup[] }) {
    return <nav aria-label="Docs"><Links groups={groups} /></nav>;
}

/** Collapsible page list for small screens. */
export function DocsMobileNav({ groups }: { groups: NavGroup[] }) {
    const path = usePathname();
    const current = groups.flatMap((g) => g.pages).find((p) => path === `/docs/${p.slug}`)?.title ?? 'Introduction';
    return (
        <details className="group rounded-lg border border-zinc-200 bg-white lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm font-medium text-zinc-900">
                <span><span className="text-zinc-400">Docs / </span>{current}</span>
                <span className="text-zinc-400 transition-transform group-open:rotate-180" aria-hidden>▾</span>
            </summary>
            <div className="border-t border-zinc-100 p-3"><Links groups={groups} /></div>
        </details>
    );
}
