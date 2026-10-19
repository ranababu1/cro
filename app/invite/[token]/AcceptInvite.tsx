'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AcceptInvite({ token, email }: { token: string; email: string }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const accept = async () => {
        setBusy(true);
        setError(null);
        const res = await fetch('/api/invites/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) { setError(j.error ?? 'Could not accept the invite'); setBusy(false); return; }
        router.push('/dashboard');
        router.refresh();
    };
    return (
        <div>
            <button type="button" onClick={accept} disabled={busy} className="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60" data-testid="invite-accept">
                {busy ? 'Joining...' : 'Accept and join'}
            </button>
            {email && <p className="mt-3 text-xs text-zinc-500">You are signed in as {email}.</p>}
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        </div>
    );
}
