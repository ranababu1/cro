'use client';
import Link from 'next/link';
import { useCallback, useId, useRef, useState } from 'react';
import { useOverlay } from '../overlay';

export type MobileNavGroup = { label: string; items: { href: string; title: string }[] };

/** Hamburger menu for the public header below lg, where the desktop nav is hidden. */
export function MobileNav({ groups, links }: { groups: MobileNavGroup[]; links: { href: string; title: string }[] }) {
    const [open, setOpen] = useState(false);
    const close = useCallback(() => setOpen(false), []);
    const panel = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const id = useId();
    useOverlay(open, close, panel, trigger);
    const linkCls = 'block rounded-lg px-3 py-2.5 text-[16px] text-zinc-700 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-blue-600';
    return (
        <div className="lg:hidden">
            <button ref={trigger} type="button" aria-expanded={open} aria-controls={id} aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((o) => !o)}
                className="grid h-11 w-11 place-items-center rounded-xl text-[#0b1630] ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                    {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
                </svg>
            </button>
            {open && (
                <>
                    <div aria-hidden data-overlay-backdrop onClick={close} className="mnav-fade fixed inset-0 top-[88px] z-40 bg-[#0b1630]/20" />
                    <div ref={panel} id={id} role="dialog" aria-modal="true" aria-label="Menu"
                        className="mnav-slide fixed inset-x-0 top-[88px] z-50 max-h-[calc(100dvh-88px)] overflow-y-auto border-t border-zinc-200 bg-white px-5 pb-8 pt-4 shadow-[0_24px_48px_-24px_rgb(11_22_48/0.35)]">
                        <nav aria-label="Mobile">
                            <ul className="space-y-1">
                                {links.map((l) => <li key={l.href}><Link href={l.href} onClick={close} className={`${linkCls} font-medium text-[#0b1630]`}>{l.title}</Link></li>)}
                            </ul>
                            {groups.map((g) => (
                                <div key={g.label} className="mt-5">
                                    <p className="px-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{g.label}</p>
                                    <ul className="mt-1.5 space-y-0.5">
                                        {g.items.map((i) => <li key={i.title}><a href={i.href} onClick={close} className={linkCls}>{i.title}</a></li>)}
                                    </ul>
                                </div>
                            ))}
                        </nav>
                        <div className="mt-6 grid gap-3 border-t border-zinc-100 pt-6">
                            <Link href="/signin" onClick={close} className="inline-flex h-12 items-center justify-center rounded-xl text-[16px] font-medium text-[#0b1630] ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50">Sign in</Link>
                            <Link href="/signin" onClick={close} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-teal-600 text-[16px] font-medium text-white hover:from-blue-700 hover:to-teal-700">Start free <span aria-hidden>→</span></Link>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
