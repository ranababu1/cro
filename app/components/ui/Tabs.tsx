'use client';

import Link from 'next/link';
import { cn } from './cn';

export interface TabItem {
    id: string;
    label: React.ReactNode;
    href?: string;
    count?: number;
}

const tabClass = (active: boolean) =>
    cn(
        '-mb-px inline-flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium whitespace-nowrap transition-colors',
        active ? 'border-brand-600 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300',
    );

/** Underline tabs. Items with href render as links (URL state); others call onChange. */
export function Tabs({ items, active, onChange, className }: { items: TabItem[]; active: string; onChange?: (id: string) => void; className?: string }) {
    return (
        <div className={cn('border-b border-zinc-200', className)}>
            <nav className="-mb-px flex gap-6 overflow-x-auto" role="tablist">
                {items.map((t) => {
                    const inner = (
                        <>
                            {t.label}
                            {t.count !== undefined && <span className="rounded bg-zinc-100 px-1.5 text-xs text-zinc-600 tabular-nums">{t.count}</span>}
                        </>
                    );
                    return t.href ? (
                        <Link key={t.id} href={t.href} role="tab" aria-selected={active === t.id} className={tabClass(active === t.id)}>
                            {inner}
                        </Link>
                    ) : (
                        <button key={t.id} type="button" role="tab" aria-selected={active === t.id} onClick={() => onChange?.(t.id)} className={tabClass(active === t.id)}>
                            {inner}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
