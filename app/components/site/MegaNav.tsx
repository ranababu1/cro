'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowIcon, ChevronIcon } from './Buttons';
import { NAV_LINKS, NAV_MENUS, type NavMenu } from './nav';

const OPEN_DELAY = 110;
const CLOSE_DELAY = 180;
const EXIT_MS = 180;

/**
 * Desktop mega menu (lg and up). Hover opens after a short intent delay; click or Enter toggles.
 * A single panel is open at a time. Moving between triggers swaps the panel without a close flicker.
 * Escape closes and returns focus to the trigger; outside clicks, focus leaving the nav and route changes close it.
 */
export function MegaNav() {
    const pathname = usePathname();
    const [state, setState] = useState<{ label: string; path: string } | null>(null);
    const open = state && state.path === pathname ? state.label : null;
    const [shown, setShown] = useState<string | null>(null);
    const setOpen = useCallback((label: string | null) => {
        setState(label ? { label, path: pathname } : null);
        if (label) setShown(label);
    }, [pathname]);
    const root = useRef<HTMLDivElement>(null);
    const triggers = useRef<Record<string, HTMLButtonElement | null>>({});
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const baseId = useId();

    const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
    const close = useCallback(() => { clear(); setState(null); }, []);

    useEffect(() => {
        if (open || !shown) return;
        const t = setTimeout(() => setShown(null), EXIT_MS);
        return () => clearTimeout(t);
    }, [open, shown]);

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
                    const isShown = shown === m.label;
                    return (
                        <div key={m.label} onPointerEnter={hoverOpen(m.label)} onPointerLeave={hoverClose}>
                            <button
                                ref={(el) => { triggers.current[m.label] = el; }}
                                type="button"
                                aria-expanded={isOpen}
                                aria-controls={id}
                                onClick={() => { clear(); setOpen(isOpen ? null : m.label); }}
                                className={`flex h-10 items-center gap-1 rounded-lg px-3 text-[15px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent-700 ${isOpen ? 'bg-accent-50 text-navy-950' : 'text-muted-strong hover:text-navy-950'}`}
                            >
                                {m.label}
                                <ChevronIcon className={`h-4 w-4 text-muted transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
                            </button>
                            <div
                                id={id}
                                hidden={!isShown}
                                aria-hidden={!isOpen}
                                onPointerEnter={keepOpen}
                                onPointerLeave={hoverClose}
                                className={`mega-panel absolute inset-x-0 top-full z-40 border-b border-line bg-white shadow-pop ${isOpen ? 'is-open' : ''} ${isShown && !isOpen ? 'is-closing' : ''}`}
                            >
                                {isShown && <MenuPanel menu={m} onNavigate={close} />}
                            </div>
                        </div>
                    );
                })}
                {NAV_LINKS.map((l) => (
                    <Link key={l.href} href={l.href} className="flex h-10 items-center rounded-lg px-3 text-[15px] font-medium text-muted-strong transition-colors duration-150 hover:text-navy-950 focus-visible:outline-2 focus-visible:outline-accent-700">{l.title}</Link>
                ))}
            </nav>
        </div>
    );
}

function MenuPanel({ menu, onNavigate }: { menu: NavMenu; onNavigate: () => void }) {
    return (
        <div key={menu.label} className="mx-auto grid max-w-[1200px] gap-10 px-8 py-9 lg:grid-cols-[minmax(200px,0.9fr)_minmax(0,1.5fr)_minmax(240px,0.85fr)]">
            <div className="menu-reveal max-w-[280px]">
                {menu.intro ? (
                    <>
                        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-accent-700">{menu.intro.eyebrow}</p>
                        <p className="mt-3 text-[22px] font-semibold leading-[1.25] tracking-[-0.02em] text-navy-950">{menu.intro.title}</p>
                        <p className="mt-3 text-[14px] leading-[1.6] text-muted-strong">{menu.intro.body}</p>
                    </>
                ) : (
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-accent-700">{menu.label}</p>
                )}
            </div>
            <div className="grid gap-8 sm:grid-cols-2">
                {menu.groups.map((g, gi) => (
                    <div key={g.heading} className="menu-reveal" style={{ animationDelay: `${80 + gi * 50}ms` }}>
                        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
                            {g.kicker && <span className="mr-2 text-accent-700">{g.kicker}</span>}
                            {g.heading}
                        </p>
                        <ul className="mt-3 space-y-0.5">
                            {g.items.map((i, ii) => (
                                <li key={i.title} className="menu-reveal" style={{ animationDelay: `${110 + gi * 50 + ii * 45}ms` }}>
                                    <Link href={i.href} onClick={onNavigate} className="group flex items-start justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-accent-50 focus-visible:outline-2 focus-visible:outline-accent-700">
                                        <span>
                                            <span className="block text-[15px] font-medium text-navy-950 group-hover:text-accent-700">{i.title}</span>
                                            <span className="mt-0.5 block text-[13px] leading-snug text-muted">{i.body}</span>
                                        </span>
                                        <ArrowIcon className="mt-1 h-3.5 w-3.5 shrink-0 text-accent-700 opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            {menu.feature && (
                <Link href={menu.feature.href} onClick={onNavigate} className="menu-reveal group flex flex-col rounded-2xl border border-accent-100 bg-accent-50 p-6 transition-colors duration-150 hover:border-accent-200 focus-visible:outline-2 focus-visible:outline-accent-700" style={{ animationDelay: '220ms' }}>
                    <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent-700">{menu.feature.eyebrow}</span>
                    <span className="mt-3 text-[18px] font-semibold leading-snug tracking-[-0.02em] text-navy-950">{menu.feature.title}</span>
                    <span className="mt-2 text-[14px] leading-[1.6] text-muted-strong">{menu.feature.body}</span>
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-[14px] font-medium text-accent-700">{menu.feature.cta}<ArrowIcon className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" /></span>
                </Link>
            )}
        </div>
    );
}
