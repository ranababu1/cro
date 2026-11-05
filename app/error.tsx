'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/** Shown when a page fails to render. The error itself is reported on the server; the visitor gets a retry. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => { console.error(error); }, [error]);
    return (
        <main className="flex min-h-[60vh] items-start justify-center px-4 pt-16 sm:pt-28">
            <div className="max-w-md text-center">
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Something went wrong</h1>
                <p className="mt-2 text-sm text-zinc-500">The page could not load. Try again; if it keeps happening, open a ticket from Support and include the reference below.</p>
                {error.digest && <p className="mt-3 font-mono text-xs text-zinc-400">Reference: {error.digest}</p>}
                <div className="mt-6 flex justify-center gap-3 text-sm">
                    <button type="button" onClick={reset} className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">Try again</button>
                    <Link href="/support" className="rounded-md border border-zinc-200 bg-white px-4 py-2 font-medium text-zinc-800 shadow-xs hover:bg-zinc-50">Support</Link>
                </div>
            </div>
        </main>
    );
}
