'use client';
import Link from 'next/link';
import { useCallback, useId, useRef, useState } from 'react';
import { useOverlay } from '../overlay';
import { ArrowIcon, ChevronIcon } from './Buttons';
import { NAV_LINKS, NAV_MENUS, SIGN_IN_HREF, START_HREF, type NavMenu } from './nav';

/** Spacious slide-out below lg. Menus open as grouped panels with Back and Close; tap only, no hover. */
export function MobileMenu() {
    const [open, setOpen] = useState(false);
    const [section, setSection] = useState<string | null>(null);
    const close = useCallback(() => { setOpen(false); setSection(null); }, []);
    const panel = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const id = useId();
    useOverlay(open, close, panel, trigger);
    const menu = NAV_MENUS.find((m) => m.label === section) ?? null;
    const back = () => setSection(null);
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
                    <div aria-hidden data-overlay-backdrop onClick={close} className="mnav-fade fixed inset-0 z-40 bg-navy-950/30" />
                    <div ref={panel} id={id} role="dialog" aria-modal="true" aria-label="Menu"
                        className="drawer-slide fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col bg-white shadow-pop">
                        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
                            {menu ? (
                                <button type="button" onClick={back} className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-[15px] font-medium text-navy-950 focus-visible:outline-2 focus-visible:outline-accent-700">
                                    <ChevronIcon className="h-4 w-4 rotate-90" /> Back
                                </button>
                            ) : (
                                <p className="px-2 text-[15px] font-semibold text-navy-950">Menu</p>
                            )}
                            <button type="button" onClick={close} className="inline-flex h-10 items-center rounded-lg px-3 text-[15px] font-medium text-muted-strong hover:text-navy-950 focus-visible:outline-2 focus-visible:outline-accent-700">
                                Close
                            </button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                            {menu ? <MobileSection menu={menu} onNavigate={close} /> : (
                                <nav aria-label="Mobile">
                                    <ul>
                                        {NAV_MENUS.map((m) => (
                                            <li key={m.label}>
                                                <button type="button" onClick={() => setSection(m.label)}
                                                    className="flex h-14 w-full items-center justify-between text-left text-[17px] font-medium text-navy-950 focus-visible:outline-2 focus-visible:outline-accent-700">
                                                    {m.label}
                                                    <ChevronIcon className="h-5 w-5 -rotate-90 text-muted" />
                                                </button>
                                            </li>
                                        ))}
                                        {NAV_LINKS.map((l) => (
                                            <li key={l.href}><Link href={l.href} onClick={close} className="flex h-14 items-center text-[17px] font-medium text-navy-950 focus-visible:outline-2 focus-visible:outline-accent-700">{l.title}</Link></li>
                                        ))}
                                    </ul>
                                </nav>
                            )}
                        </div>
                        <div className="grid shrink-0 gap-3 border-t border-line px-5 py-4 sm:grid-cols-2">
                            <Link href={SIGN_IN_HREF} onClick={close} className="inline-flex h-12 items-center justify-center rounded-lg text-[16px] font-medium text-navy-950 ring-1 ring-inset ring-line hover:bg-surface">Sign in</Link>
                            <Link href={START_HREF} onClick={close} className="btn-primary inline-flex h-12 items-center justify-center gap-2 rounded-lg text-[16px] font-medium">Start for free <ArrowIcon /></Link>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function MobileSection({ menu, onNavigate }: { menu: NavMenu; onNavigate: () => void }) {
    return (
        <div>
            {menu.intro && (
                <div className="menu-reveal mb-6 max-w-[320px]">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-accent-700">{menu.intro.eyebrow}</p>
                    <p className="mt-2 text-[20px] font-semibold leading-snug tracking-[-0.02em] text-navy-950">{menu.intro.title}</p>
                    <p className="mt-2 text-[14px] leading-[1.6] text-muted-strong">{menu.intro.body}</p>
                </div>
            )}
            {menu.groups.map((g, gi) => (
                <div key={g.heading} className="menu-reveal border-t border-line py-4 first:border-t-0 first:pt-0" style={{ animationDelay: `${80 + gi * 50}ms` }}>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
                        {g.kicker && <span className="mr-2 text-accent-700">{g.kicker}</span>}
                        {g.heading}
                    </p>
                    <ul className="mt-1">
                        {g.items.map((i) => (
                            <li key={i.title}>
                                <Link href={i.href} onClick={onNavigate} className="block rounded-lg py-2.5 pr-2 focus-visible:outline-2 focus-visible:outline-accent-700">
                                    <span className="block text-[16px] text-navy-950">{i.title}</span>
                                    <span className="block text-[13px] text-muted">{i.body}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
            {menu.feature && (
                <Link href={menu.feature.href} onClick={onNavigate} className="menu-reveal mt-2 flex flex-col rounded-2xl border border-accent-100 bg-accent-50 p-5" style={{ animationDelay: '200ms' }}>
                    <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent-700">{menu.feature.eyebrow}</span>
                    <span className="mt-2 text-[16px] font-semibold text-navy-950">{menu.feature.title}</span>
                    <span className="mt-1.5 text-[14px] leading-snug text-muted-strong">{menu.feature.body}</span>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-accent-700">{menu.feature.cta}<ArrowIcon className="h-3.5 w-3.5" /></span>
                </Link>
            )}
        </div>
    );
}
