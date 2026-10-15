'use client';

import { useEffect, useState } from 'react';
import { Card, CardBody, CardHeader, Spinner } from '@/app/components/ui';
import { UpgradeNote } from '@/app/components/UpgradeNote';

/** Heatmaps tab. Free plans see an upgrade note; the server enforces the same rule. */
export function HeatmapsPanel({ experimentId }: { experimentId: string }) {
    const [allowed, setAllowed] = useState<boolean | null>(null);
    useEffect(() => {
        let live = true;
        fetch('/api/plan').then((r) => r.json()).then((p) => { if (live) setAllowed(!!p.features?.heatmaps); }).catch(() => live && setAllowed(false));
        return () => { live = false; };
    }, []);
    return (
        <Card>
            <CardHeader title="Heatmaps" description="See where visitors click and how far they scroll on each version." />
            <CardBody>
                {allowed === null && <Spinner />}
                {allowed === false && <UpgradeNote>Heatmaps are part of the paid plans. Upgrade to Starter or above to see them for this test.</UpgradeNote>}
                {allowed === true && <p className="text-sm text-zinc-600" data-experiment={experimentId}>Heatmaps for this test will show here once they are available on your plan.</p>}
            </CardBody>
        </Card>
    );
}
