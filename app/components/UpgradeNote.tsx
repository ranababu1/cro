import Link from 'next/link';

/** Short note shown to free plans where a paid-only feature would be. */
export function UpgradeNote({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-teal-50 px-4 py-3 text-sm text-[#0b1630]">
            <p>{children}</p>
            <Link href="/pricing" target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-medium text-blue-700 hover:underline">See plans</Link>
        </div>
    );
}
