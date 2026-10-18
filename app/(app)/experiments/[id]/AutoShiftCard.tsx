'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardBody, Button, Badge, Alert } from '@/app/components/ui';
import { UpgradeNote } from '@/app/components/UpgradeNote';

type State = { allowed: boolean; enabled: boolean; last_check_at: string | null; min_visitors: number; floor_percent: number; interval_minutes: number };

/** Auto-shift traffic to the winner: on or off for this test. Growth plan and above. */
export function AutoShiftCard({ experimentId, onSaved }: { experimentId: string; onSaved: () => void }) {
    const [state, setState] = useState<State | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        let live = true;
        fetch(`/api/experiments/${experimentId}/auto-shift`).then(async (res) => {
            if (live && res.ok) setState(await res.json());
        }).catch(() => undefined);
        return () => { live = false; };
    }, [experimentId]);

    async function toggle(enabled: boolean) {
        setBusy(true); setError('');
        const res = await fetch(`/api/experiments/${experimentId}/auto-shift`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) });
        const data = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) return setError(String(data.error || 'Could not save'));
        setState(data);
        onSaved();
    }

    if (!state) return null;
    if (!state.allowed && !state.enabled) {
        return <UpgradeNote>Auto-shift traffic to the winner is part of the Growth plan and above. Upgrade to Growth to send more new visitors to the version that converts best.</UpgradeNote>;
    }
    return (
        <Card data-testid="auto-shift">
            <CardHeader
                title={<span className="flex items-center gap-2">Auto-shift traffic to the winner {state.enabled ? <Badge tone="success">On</Badge> : <Badge>Off</Badge>}</span>}
                description="Sends more new visitors to the version that is most likely to win on the primary goal. Visitors already in the test keep their version."
                actions={<Button variant={state.enabled ? 'secondary' : 'primary'} size="sm" disabled={busy || (!state.allowed && !state.enabled)} onClick={() => void toggle(!state.enabled)}>{state.enabled ? 'Turn off' : 'Turn on'}</Button>}
            />
            <CardBody className="space-y-2 text-sm text-zinc-600">
                {error && <Alert tone="danger">{error}</Alert>}
                <p>About every {state.interval_minutes} minutes while the test gets traffic, the split is recalculated from the chance each active version is the best. Every version keeps at least {state.floor_percent}% of new visitors (less with more than 5 versions), so it keeps collecting data. The split only starts to move once each active version has {state.min_visitors} visitors.</p>
                <p>While it is on, the split below is set for you. Turning it off keeps the current split. A fixed split gives the cleanest read of the results, so use auto-shift when earning from the best version during the test matters more.</p>
                {state.enabled && state.last_check_at && <p className="text-xs text-zinc-500">Last checked {new Date(state.last_check_at).toLocaleString()}.</p>}
            </CardBody>
        </Card>
    );
}
