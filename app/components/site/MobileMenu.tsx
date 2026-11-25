'use client';
import Link from 'next/link';
import { useCallback, useId, useRef, useState } from 'react';
import { useOverlay } from '../overlay';
import { ArrowIcon, ChevronIcon } from './Buttons';
import { NAV_LINKS, NAV_MENUS, SIGN_IN_HREF, START_HREF } from './nav';

/** Full-width menu below lg. Each mega menu becomes an accordion; Escape, outside tap and route change close it. */
export function MobileMenu() {
    const [open, setOpen] = useState(false);
    const [section, setSection] = useState<string | null>(null);
    const close = useCallback(() => setOpen(false), []);
    const panel = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const id = useId();
    useOverlay(open, close, panel, trigger);
    return (
        <div className="lg:hidden">
            <button ref={trigger} type="button" aria-expanded={open} aria-controls={id} aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((o) => !o)}
                className="grid h-11 w-11 place-items-center rounded-lg text-navy-950 ring-1 ring-inset ring-line hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                    {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
                </svg>
            </button>
            {open && (
                <>
                    <div aria-hidden data-overlay-backdrop onClick={close} className="mnav-fade fixed inset-0 top-[72px] z-40 bg-navy-950/20" />
                    <div ref={panel} id={id} role="dialog" aria-modal="true" aria-label="Menu"
                        className="mnav-slide fixed inset-x-0 top-[72px] z-50 max-h-[calc(100dvh-72px)] overflow-y-auto border-t border-line bg-white px-5 pb-8 pt-3 shadow-pop sm:px-8">
                        <nav aria-label="Mobile">
                            <ul className="divide-y divide-line">
                                {NAV_MENUS.map((m) => {
                                    const expanded = section === m.label;
                                    const sid = `${id}-${m.label}`;
                                    return (
                                        <li key={m.label}>
                                            <button type="button" aria-expanded={expanded} aria-controls={sid} onClick={() => setSection(expanded ? null : m.label)}
                                                className="flex h-14 w-full items-center justify-between text-left text-[17px] font-medium text-navy-950 focus-visible:outline-2 focus-visible:outline-accent-700">
                                                {m.label}
                                                <ChevronIcon className={`h-5 w-5 text-muted transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`} />
                                            </button>
                                            <div id={sid} hidden={!expanded} className="pb-4">
                                                {m.groups.map((g) => (
                                                    <div key={g.heading} className="mt-2 first:mt-0">
                                                        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">{g.heading}</p>
                                                        <ul className="mt-1">
                                                            {g.items.map((i) => (
                                                                <li key={i.title}>
                                                                    <Link href={i.href} onClick={close} className="block rounded-lg py-2.5 pr-2 focus-visible:outline-2 focus-visible:outline-accent-700">
                                                                        <span className="block text-[16px] text-navy-950">{i.title}</span>
                                                                        <span className="block text-[13px] text-muted">{i.body}</span>
                                                                    </Link>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        </li>
                                    );
                                })}
                                {NAV_LINKS.map((l) => (
                                    <li key={l.href}><Link href={l.href} onClick={close} className="flex h-14 items-center text-[17px] font-medium text-navy-950 focus-visible:outline-2 focus-visible:outline-accent-700">{l.title}</Link></li>
                                ))}
                            </ul>
                        </nav>
                        <div className="mt-4 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
                            <Link href={SIGN_IN_HREF} onClick={close} className="inline-flex h-12 items-center justify-center rounded-lg text-[16px] font-medium text-navy-950 ring-1 ring-inset ring-line hover:bg-surface">Sign in</Link>
                            <Link href={START_HREF} onClick={close} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-navy-950 text-[16px] font-medium text-white hover:bg-navy-800">Start for free <ArrowIcon /></Link>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
