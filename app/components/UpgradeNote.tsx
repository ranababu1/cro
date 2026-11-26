import Link from 'next/link';

/** Short note shown to free plans where a paid-only feature would be. */
export function UpgradeNote({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-lg border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-navy-950">
            <p>{children}</p>
            <Link href="/pricing" target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-medium text-blue-700 hover:underline">See plans</Link>
        </div>
    );
}
