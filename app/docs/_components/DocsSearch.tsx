'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SearchEntry } from '@/lib/docs';

function score(e: SearchEntry, terms: string[]): number {
    const h = e.heading.toLowerCase();
    const p = e.page.toLowerCase();
    const t = e.text.toLowerCase();
    let s = 0;
    for (const term of terms) {
        if (h.includes(term)) s += 10;
        else if (p.includes(term)) s += 4;
        else if (t.includes(term)) s += 1;
        else return 0;
    }
    return s;
}

function snippet(text: string, term: string): string {
    const i = text.toLowerCase().indexOf(term);
    if (i < 0) return text.slice(0, 120);
    const start = Math.max(0, i - 40);
    return (start > 0 ? '...' : '') + text.slice(start, start + 140) + (start + 140 < text.length ? '...' : '');
}

/** Client-side search over a prebuilt index of every docs section. Press / to focus. */
export function DocsSearch({ index }: { index: SearchEntry[] }) {
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const input = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const results = useMemo(() => {
        const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
        if (!terms.length) return [];
        return index
            .map((e) => ({ e, s: score(e, terms) }))
            .filter((r) => r.s > 0)
            .sort((a, b) => b.s - a.s)
            .slice(0, 8)
            .map((r) => ({ ...r.e, snippet: snippet(r.e.text, terms[0]) }));
    }, [q, index]);

    useEffect(() => {
        const onKey = (ev: KeyboardEvent) => {
            const target = ev.target as HTMLElement;
            if (ev.key === '/' && !['INPUT', 'TEXTAREA'].includes(target.tagName)) {
                ev.preventDefault();
                input.current?.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const go = (href: string) => {
        setOpen(false);
        setQ('');
        router.push(href);
    };

    return (
        <div className="relative w-full">
            <label htmlFor="docs-search" className="sr-only">Search docs</label>
            <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden>
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" fill="none" /><path d="m14 14 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
                id="docs-search"
                ref={input}
                type="search"
                autoComplete="off"
                placeholder="Search docs"
                value={q}
                onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
                    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                    if (e.key === 'Enter' && results[active]) go(results[active].href);
                    if (e.key === 'Escape') { setOpen(false); input.current?.blur(); }
                }}
                role="combobox"
                aria-expanded={open && results.length > 0}
                aria-controls="docs-search-results"
                className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-10 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-zinc-200 px-1.5 text-[10px] text-zinc-400 sm:block">/</kbd>
            {open && q && (
                <div id="docs-search-results" role="listbox" className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1.5 shadow-pop sm:min-w-[26rem]">
                    {results.length === 0 ? (
                        <p className="px-3 py-4 text-sm text-zinc-500">No results for &quot;{q}&quot;</p>
                    ) : results.map((r, i) => (
                        <button
                            key={r.href}
                            type="button"
                            role="option"
                            aria-selected={i === active}
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() => setActive(i)}
                            onClick={() => go(r.href)}
                            className={`block w-full rounded-md px-3 py-2 text-left ${i === active ? 'bg-brand-50' : ''}`}
                        >
                            <span className="block text-[11px] font-medium text-zinc-400">{r.page}</span>
                            <span className="block text-sm font-medium text-zinc-900">{r.heading}</span>
                            <span className="mt-0.5 block line-clamp-2 text-xs text-zinc-500">{r.snippet}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
