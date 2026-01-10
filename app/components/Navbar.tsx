'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

export default function Navbar() {
    const pathname = usePathname();
    const { data: session } = useSession();

    return (
        <div className="navbar bg-base-200 shadow-lg sticky top-0 z-50">
            <div className="navbar-start">
                <div className="dropdown">
                    <div tabIndex={0} role="button" className="btn btn-ghost lg:hidden">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M4 6h16M4 12h8m-8 6h16"
                            />
                        </svg>
                    </div>
                    <ul
                        tabIndex={0}
                        className="menu menu-sm dropdown-content bg-base-200 rounded-box z-[1] mt-3 w-52 p-2 shadow"
                    >
                        {session && (
                            <>
                                <li>
                                    <Link href="/dashboard" className={pathname === '/dashboard' ? 'active' : ''}>
                                        Dashboard
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/experiments/new" className={pathname === '/experiments/new' ? 'active' : ''}>
                                        New Experiment
                                    </Link>
                                </li>
                            </>
                        )}
                    </ul>
                </div>
                <Link href={session ? "/dashboard" : "/"} className="btn btn-ghost text-xl">
                    <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                    </svg>
                    <span className="ml-2">A/B Platform</span>
                </Link>
            </div>
            <div className="navbar-center hidden lg:flex">
                {session && (
                    <ul className="menu menu-horizontal px-1">
                        <li>
                            <Link href="/dashboard" className={pathname === '/dashboard' ? 'active' : ''}>
                                Dashboard
                            </Link>
                        </li>
                        <li>
                            <Link href="/experiments/new" className={pathname === '/experiments/new' ? 'active' : ''}>
                                New Experiment
                            </Link>
                        </li>
                    </ul>
                )}
            </div>
            <div className="navbar-end gap-2">
                {session ? (
                    <div className="dropdown dropdown-end">
                        <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar placeholder">
                            <div className="w-10 rounded-full bg-primary text-primary-content">
                                <span className="text-xl">{session.user.name?.[0] || session.user.email?.[0].toUpperCase()}</span>
                            </div>
                        </div>
                        <ul tabIndex={0} className="menu menu-sm dropdown-content bg-base-200 rounded-box z-[1] mt-3 w-52 p-2 shadow">
                            <li className="menu-title">
                                <span>{session.user.email}</span>
                            </li>
                            <li><Link href="/dashboard">Dashboard</Link></li>
                            <li><button onClick={() => signOut()}>Sign Out</button></li>
                        </ul>
                    </div>
                ) : (
                    <Link href="/api/auth/signin" className="btn btn-primary btn-sm">
                        Sign In
                    </Link>
                )}
            </div>
        </div>
    );
}
