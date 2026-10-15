'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useOverlay } from '../overlay';
import { Logo } from '../ui/Logo';
import { cn } from '../ui/cn';
import { setProjectCookie } from '@/lib/currentProject';
import { HomeIcon, FlaskIcon, KeyIcon, ShieldIcon, UserIcon, BookIcon, ChevronIcon, MenuIcon, XIcon, CheckIcon } from './icons';

interface ShellProject { id: string; name: string; org_id: string; org_name: string }

export interface AppShellProps {
    user: { name: string; email: string };
    projects: ShellProject[];
    currentProjectId: string | null;
    isPlatformAdmin: boolean;
    children: React.ReactNode;
}

const nav = [
    { href: '/dashboard', label: 'Overview', icon: HomeIcon },
    { href: '/experiments', label: 'Experiments', icon: FlaskIcon },
    { href: '/settings/domains', label: 'Domains', icon: ShieldIcon },
    { href: '/settings/keys', label: 'API keys', icon: KeyIcon },
    { href: '/settings/profile', label: 'Profile', icon: UserIcon },
];

function useClickOutside(onOutside: () => void) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOutside();
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [onOutside]);
    return ref;
}

function ProjectSwitcher({ projects, currentProjectId }: { projects: ShellProject[]; currentProjectId: string | null }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const ref = useClickOutside(() => setOpen(false));
    const current = projects.find((p) => p.id === currentProjectId) ?? projects[0];
    if (!current) return <span className="text-sm text-zinc-500">No project</span>;

    const choose = (id: string) => {
        setProjectCookie(id);
        setOpen(false);
        router.refresh();
    };

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="flex min-w-0 max-w-[24rem] items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-100"
            >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-900 text-[11px] font-semibold text-white">
                    {current.org_name.charAt(0).toUpperCase() || 'O'}
                </span>
                <span className="hidden max-w-[12rem] truncate text-zinc-500 sm:inline">{current.org_name}</span>
                <span className="hidden text-zinc-300 sm:inline">/</span>
                <span className="truncate font-medium text-zinc-900">{current.name}</span>
                <ChevronIcon className="h-4 w-4 shrink-0 text-zinc-400" />
            </button>
            {open && (
                <div role="listbox" className="absolute left-0 z-30 mt-1 w-72 rounded-lg border border-zinc-200 bg-white p-1 shadow-pop">
                    {[...new Set(projects.map((p) => p.org_id))].map((orgId) => (
                        <div key={orgId}>
                            <p className="px-2 pt-2 pb-1 text-xs font-medium text-zinc-500">{projects.find((p) => p.org_id === orgId)?.org_name}</p>
                            {projects.filter((p) => p.org_id === orgId).map((p) => (
                                <button
                                    key={p.id}
                                    role="option"
                                    aria-selected={p.id === current.id}
                                    onClick={() => choose(p.id)}
                                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                                >
                                    {p.name}
                                    {p.id === current.id && <CheckIcon className="h-4 w-4 text-brand-600" />}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function UserMenu({ user }: { user: AppShellProps['user'] }) {
    const [open, setOpen] = useState(false);
    const ref = useClickOutside(() => setOpen(false));
    const initial = (user.name || user.email).charAt(0).toUpperCase();
    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-label="Account menu"
                aria-expanded={open}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-300"
            >
                {initial}
            </button>
            {open && (
                <div className="absolute right-0 z-30 mt-1 w-60 rounded-lg border border-zinc-200 bg-white p-1 shadow-pop">
                    <div className="px-2 py-2">
                        <p className="truncate text-sm font-medium text-zinc-900">{user.name || 'Signed in'}</p>
                        <p className="truncate text-xs text-zinc-500">{user.email}</p>
                    </div>
                    <div className="my-1 h-px bg-zinc-100" />
                    <button onClick={() => signOut({ callbackUrl: '/' })} className="w-full rounded-md px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100">
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}

function NavLinks({ isPlatformAdmin, onNavigate }: { isPlatformAdmin: boolean; onNavigate?: () => void }) {
    const pathname = usePathname();
    const item = (href: string, label: string, Icon: typeof HomeIcon) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href) && !(href === '/admin' && pathname.startsWith('/admin/telemetry')));
        return (
            <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                    'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium',
                    active ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                )}
            >
                <Icon className={cn('h-4 w-4', active ? 'text-zinc-900' : 'text-zinc-400')} />
                {label}
            </Link>
        );
    };
    return (
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
            {nav.map((n) => item(n.href, n.label, n.icon))}
            {isPlatformAdmin && (
                <>
                    <p className="mt-6 mb-1 px-2.5 text-xs font-medium text-zinc-400">Platform</p>
                    {item('/admin', 'Admin console', ShieldIcon)}
                    {item('/admin/telemetry', 'Telemetry', ShieldIcon)}
                </>
            )}
            <div className="mt-auto pb-4">
                <Link href="/docs" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
                    <BookIcon className="h-4 w-4 text-zinc-400" />
                    Documentation
                    <span className="sr-only"> (opens in a new tab)</span>
                </Link>
            </div>
        </nav>
    );
}

export default function AppShell({ user, projects, currentProjectId, isPlatformAdmin, children }: AppShellProps) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const closeDrawer = useCallback(() => setMobileOpen(false), []);
    const drawer = useRef<HTMLElement>(null);
    const drawerTrigger = useRef<HTMLButtonElement>(null);
    useOverlay(mobileOpen, closeDrawer, drawer, drawerTrigger);
    return (
        <div className="min-h-screen bg-zinc-50/50">
            {/* Desktop sidebar */}
            <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-zinc-200 bg-white lg:flex">
                <div className="flex h-14 items-center px-5">
                    <Logo href="/dashboard" />
                </div>
                <NavLinks isPlatformAdmin={isPlatformAdmin} />
            </aside>

            {/* Mobile drawer */}
            {mobileOpen && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <div aria-hidden data-overlay-backdrop onClick={closeDrawer} className="mnav-fade absolute inset-0 bg-zinc-900/30" />
                    <aside ref={drawer} id="app-drawer" role="dialog" aria-modal="true" aria-label="Navigation" className="drawer-slide absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col overflow-y-auto bg-white shadow-pop">
                        <div className="flex h-14 items-center justify-between px-5">
                            <Logo href="/dashboard" />
                            <button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="rounded p-1 text-zinc-500 hover:bg-zinc-100">
                                <XIcon />
                            </button>
                        </div>
                        <NavLinks isPlatformAdmin={isPlatformAdmin} onNavigate={() => setMobileOpen(false)} />
                    </aside>
                </div>
            )}

            <div className="lg:pl-60">
                <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-zinc-200 bg-white px-4 sm:px-6">
                    <button ref={drawerTrigger} type="button" aria-label="Open menu" aria-expanded={mobileOpen} aria-controls="app-drawer" onClick={() => setMobileOpen(true)} className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100 lg:hidden">
                        <MenuIcon className="h-5 w-5" />
                    </button>
                    <ProjectSwitcher projects={projects} currentProjectId={currentProjectId} />
                    <div className="ml-auto">
                        <UserMenu user={user} />
                    </div>
                </header>
                <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
            </div>
        </div>
    );
}
