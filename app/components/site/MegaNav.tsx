'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowIcon, ChevronIcon } from './Buttons';
import { NAV_LINKS, NAV_MENUS, type NavMenu } from './nav';

const OPEN_DELAY = 90;
const CLOSE_DELAY = 160;

/**
 * Desktop mega menu (lg and up). Click or Enter toggles a menu; mouse hover opens it after a short delay.
 * Escape closes and returns focus to the trigger; outside clicks, focus leaving the nav and route changes close it.
 */
export function MegaNav() {
    const pathname = usePathname();
    // The open menu remembers the page it was opened on, so a route change closes it without an effect.
    const [state, setState] = useState<{ label: string; path: string } | null>(null);
    const open = state && state.path === pathname ? state.label : null;
    const setOpen = useCallback((label: string | null) => setState(label ? { label, path: pathname } : null), [pathname]);
    const root = useRef<HTMLDivElement>(null);
    const triggers = useRef<Record<string, HTMLButtonElement | null>>({});
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const baseId = useId();

    const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
    const close = useCallback(() => { clear(); setOpen(null); }, [setOpen]);
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            const t = triggers.current[open];
            close();
            t?.focus();
        };
        const onDown = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) close(); };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDown);
        return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
    }, [open, close]);
    useEffect(() => clear, []);

    const hoverOpen = (label: string) => (e: React.PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        clear();
        timer.current = setTimeout(() => setOpen(label), open ? 0 : OPEN_DELAY);
    };
    const hoverClose = (e: React.PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        clear();
        timer.current = setTimeout(() => setOpen(null), CLOSE_DELAY);
    };
    const keepOpen = (e: React.PointerEvent) => { if (e.pointerType === 'mouse') clear(); };

    return (
        <div ref={root} className="hidden lg:block" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close(); }}>
            <nav aria-label="Main" className="flex items-center gap-1">
                {NAV_MENUS.map((m) => {
                    const id = `${baseId}-${m.label}`;
                    const isOpen = open === m.label;
                    return (
                        <div key={m.label} onPointerEnter={hoverOpen(m.label)} onPointerLeave={hoverClose}>
                            <button
                                ref={(el) => { triggers.current[m.label] = el; }}
                                type="button"
                                aria-expanded={isOpen}
                                aria-controls={id}
                                onClick={() => { clear(); setOpen(isOpen ? null : m.label); }}
                                className={`flex h-10 items-center gap-1 rounded-lg px-3 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent-700 ${isOpen ? 'bg-surface text-navy-950' : 'text-muted-strong hover:text-navy-950'}`}
                            >
                                {m.label}
                                <ChevronIcon className={`h-4 w-4 text-muted transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
                            </button>
                            <div id={id} hidden={!isOpen} onPointerEnter={keepOpen} onPointerLeave={hoverClose}
                                className="absolute inset-x-0 top-full z-40 border-b border-line bg-white shadow-pop">
                                <MenuPanel menu={m} onNavigate={close} />
                            </div>
                        </div>
                    );
                })}
                {NAV_LINKS.map((l) => (
                    <Link key={l.href} href={l.href} className="flex h-10 items-center rounded-lg px-3 text-[15px] font-medium text-muted-strong transition-colors hover:text-navy-950 focus-visible:outline-2 focus-visible:outline-accent-700">{l.title}</Link>
                ))}
            </nav>
        </div>
    );
}

function MenuPanel({ menu, onNavigate }: { menu: NavMenu; onNavigate: () => void }) {
    return (
        <div className="mx-auto grid max-w-[1200px] grid-cols-[1fr_1fr_300px] gap-8 px-8 py-8">
            {menu.groups.map((g) => (
                <div key={g.heading}>
                    <p className="px-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">{g.heading}</p>
                    <ul className="mt-3 space-y-1">
                        {g.items.map((i) => (
                            <li key={i.title}>
                                <Link href={i.href} onClick={onNavigate} className="group block rounded-lg px-3 py-2.5 transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent-700">
                                    <span className="block text-[15px] font-medium text-navy-950 group-hover:text-accent-700">{i.title}</span>
                                    <span className="mt-0.5 block text-[13px] leading-snug text-muted">{i.body}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
            {menu.feature && (
                <Link href={menu.feature.href} onClick={onNavigate} className="group flex flex-col rounded-xl border border-line bg-surface p-5 transition-colors hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-accent-700">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent-700">{menu.feature.eyebrow}</span>
                    <span className="mt-2 text-[16px] font-semibold text-navy-950">{menu.feature.title}</span>
                    <span className="mt-1.5 text-[14px] leading-snug text-muted-strong">{menu.feature.body}</span>
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[14px] font-medium text-accent-700">{menu.feature.cta}<ArrowIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
                </Link>
            )}
        </div>
    );
}
