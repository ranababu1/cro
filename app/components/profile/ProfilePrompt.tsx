'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

/** Dismissable banner for users without a completed profile. */
export function ProfilePrompt() {
    const [hidden, setHidden] = useState(false);
    const pathname = usePathname();
    if (hidden || pathname.startsWith('/settings/profile') || pathname.startsWith('/experiments/new')) return null;
    async function dismiss() {
        setHidden(true);
        await fetch('/api/profile/dismiss', { method: 'POST' }).catch(() => undefined);
    }
    return (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900" data-testid="profile-prompt">
            <span>Complete your profile to create experiments. It takes a minute.</span>
            <span className="flex items-center gap-3">
                <Link href={`/settings/profile?next=${encodeURIComponent(pathname)}`} className="font-medium text-blue-700 hover:underline">Complete profile</Link>
                <button type="button" onClick={dismiss} className="text-sky-800 hover:underline">Dismiss</button>
            </span>
        </div>
    );
}
