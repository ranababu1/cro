'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/ui';

export default function SuspendButton({ orgId, suspended, group, name }: { orgId: string; suspended: boolean; group: string; name: string }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    return (
        <span className="inline-flex items-center gap-2">
            <Button
                size="sm"
                variant={suspended ? 'secondary' : 'danger'}
                disabled={busy}
                aria-label={`${suspended ? 'Unsuspend' : 'Suspend'} ${name}`}
                onClick={async () => {
                    setBusy(true);
                    setError(null);
                    const res = await fetch(`/api/admin/orgs/${orgId}/suspension`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ suspend: !suspended, group, reason: suspended ? null : 'Duplicate account' }),
                    });
                    setBusy(false);
                    if (!res.ok) return setError('Failed');
                    router.refresh();
                }}
            >
                {busy ? '...' : suspended ? 'Unsuspend' : 'Suspend'}
            </Button>
            {error && <span className="text-xs text-red-700">{error}</span>}
        </span>
    );
}
