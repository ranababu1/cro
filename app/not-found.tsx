import Link from 'next/link';
import type { Metadata } from 'next';
import { Logo } from './components/ui/Logo';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
    return (
        <div className="flex min-h-screen flex-col bg-zinc-50">
            <div className="px-6 py-5"><Logo /></div>
            <main className="flex flex-1 items-start justify-center px-4 pt-16 sm:pt-28">
                <div className="max-w-md text-center">
                    <p className="text-sm font-medium text-brand-600">404</p>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">This page does not exist</h1>
                    <p className="mt-2 text-sm text-zinc-500">The address may be mistyped, or the page was moved or deleted.</p>
                    <div className="mt-6 flex justify-center gap-3 text-sm">
                        <Link href="/" className="rounded-md border border-zinc-200 bg-white px-4 py-2 font-medium text-zinc-800 shadow-xs hover:bg-zinc-50">Home</Link>
                        <Link href="/dashboard" className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">Dashboard</Link>
                        <Link href="/docs" className="rounded-md border border-zinc-200 bg-white px-4 py-2 font-medium text-zinc-800 shadow-xs hover:bg-zinc-50">Docs</Link>
                    </div>
                </div>
            </main>
        </div>
    );
}
