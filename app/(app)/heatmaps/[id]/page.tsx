'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader, StatusBadge, Spinner } from '@/app/components/ui';
import { UpgradeNote } from '@/app/components/UpgradeNote';
import { HeatmapsPanel } from '../../experiments/[id]/HeatmapsPanel';

interface PageHeatmap { id: string; name: string; status: 'active' | 'paused'; rule: string }

/** One page heatmap: the same views as a test's Heatmaps tab, for pages without a test. */
export default function PageHeatmapDetail() {
    const { id } = useParams<{ id: string }>();
    const [state, setState] = useState<{ status: 'loading' | 'ok' | 'locked' | 'missing'; heatmap?: PageHeatmap }>({ status: 'loading' });

    useEffect(() => {
        let live = true;
        fetch(`/api/page-heatmaps/${id}`).then(async (res) => {
            if (!live) return;
            if (res.status === 403) return setState({ status: 'locked' });
            if (!res.ok) return setState({ status: 'missing' });
            setState({ status: 'ok', heatmap: (await res.json()).heatmap });
        }).catch(() => live && setState({ status: 'missing' }));
        return () => { live = false; };
    }, [id]);

    const h = state.heatmap;
    return (
        <div className="space-y-6">
            <PageHeader
                breadcrumb={<Link href="/heatmaps" className="hover:underline">Page heatmaps</Link>}
                title={h ? <span className="flex flex-wrap items-center gap-3">{h.name} <StatusBadge status={h.status} /></span> : 'Page heatmap'}
                description={h ? `${h.rule}.${h.status === 'paused' ? ' Paused: nothing is recorded until you turn it on again.' : ''}` : undefined}
            />
            {state.status === 'loading' && <Spinner />}
            {state.status === 'locked' && <UpgradeNote>Heatmaps are part of the paid plans. Upgrade to Starter or above to see them.</UpgradeNote>}
            {state.status === 'missing' && <p className="text-sm text-zinc-600">This page heatmap was not found. It may have been deleted.</p>}
            {h && <HeatmapsPanel experimentId={h.id} base={`/api/page-heatmaps/${h.id}/heatmaps`} page />}
        </div>
    );
}
