'use client';

import { Fragment, useEffect, useState } from 'react';
import { Card, CardHeader, CardBody, Badge, Select, Table, THead, TBody, TR, TH, TD, Tabs } from '@/app/components/ui';
import { UpgradeNote } from '@/app/components/UpgradeNote';
import { formatChance } from '@/lib/sequential';
import { NOT_RECORDED, OTHER_SOURCES, type SegmentDim, type SegmentDimension } from '@/lib/segments';

type Data = { goal_id: string | null; goals: { goal_id: string; goal_name: string; is_primary: boolean }[]; dimensions: SegmentDimension[] };

const DIM_LABEL: Record<SegmentDim, string> = { device: 'Device', source: 'Traffic source', visitor: 'New or returning' };
const KEY_LABEL: Record<string, string> = {
    desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet', new: 'New visitors', returning: 'Returning visitors', direct: 'Direct',
    [NOT_RECORDED]: 'Not recorded', [OTHER_SOURCES]: 'Other sources',
};
const pct = (x: number) => `${(x * 100).toFixed(2)}%`;

/** Results per device, landing source and new or returning visitors for one goal. Paid only. */
export function SegmentsPanel({ experimentId }: { experimentId: string }) {
    const [goal, setGoal] = useState<string>('');
    const [dim, setDim] = useState<SegmentDim>('device');
    const [state, setState] = useState<{ allowed: boolean | null; data: Data | null }>({ allowed: null, data: null });
    useEffect(() => {
        let live = true;
        fetch(`/api/experiments/${experimentId}/segments${goal ? `?goal=${encodeURIComponent(goal)}` : ''}`).then(async (res) => {
            if (!live) return;
            if (res.status === 403) return setState({ allowed: false, data: null });
            const d = await res.json().catch(() => null);
            setState({ allowed: res.ok, data: res.ok ? d : null });
        }).catch(() => undefined);
        return () => { live = false; };
    }, [experimentId, goal]);

    if (state.allowed === null) return null;
    if (!state.allowed) return <UpgradeNote>Results by segment are part of the paid plans. Upgrade to Starter or above to compare each variation by device, traffic source and new or returning visitors.</UpgradeNote>;
    const data = state.data;
    if (!data) return null;
    const current = data.dimensions.find((d) => d.dim === dim);
    const segments = current?.segments ?? [];
    const notRecorded = segments.some((s) => s.key === NOT_RECORDED);
    return (
        <Card data-testid="segments">
            <CardHeader
                title="Results by segment"
                description="Each variation against the control within the same segment. Visitors are grouped by how they were when they joined the test."
                actions={data.goals.length > 1 ? (
                    <Select aria-label="Goal" value={goal || data.goal_id || ''} onChange={(e) => setGoal(e.target.value)} className="w-48">
                        {data.goals.map((g) => <option key={g.goal_id} value={g.goal_id}>{g.goal_name}{g.is_primary ? ' (primary)' : ''}</option>)}
                    </Select>
                ) : undefined}
            />
            <Tabs className="px-5" items={(['device', 'source', 'visitor'] as SegmentDim[]).map((d) => ({ id: d, label: DIM_LABEL[d] }))} active={dim} onChange={(id) => setDim(id as SegmentDim)} />
            {segments.length === 0 ? (
                <CardBody><p className="text-sm text-zinc-600">No visitors yet.</p></CardBody>
            ) : (
                <div className="overflow-x-auto" tabIndex={0}>
                    <Table>
                        <THead>
                            <tr><TH>Segment</TH><TH>Variation</TH><TH align="right">Visitors</TH><TH align="right">Conversions</TH><TH align="right">Rate</TH><TH align="right">vs control</TH><TH align="right">Chance to beat control</TH></tr>
                        </THead>
                        <TBody>
                            {segments.map((s) => (
                                <Fragment key={s.key}>
                                    {s.variations.map((v, i) => {
                                        const control = s.variations.find((x) => x.is_control);
                                        return (
                                            <TR key={v.variation_id} className={i === 0 ? 'border-t-2 border-zinc-200' : ''}>
                                                <TD>{i === 0 && <span className="font-medium text-zinc-900">{KEY_LABEL[s.key] ?? s.key}</span>}</TD>
                                                <TD>
                                                    <span className="flex items-center gap-2">
                                                        {v.variation_name}
                                                        {v.is_control && <Badge>Control</Badge>}
                                                        {v.sequential_significant && <Badge tone={v.conversion_rate > (control?.conversion_rate ?? 0) ? 'success' : 'danger'}>{v.conversion_rate > (control?.conversion_rate ?? 0) ? 'Better here' : 'Worse here'}</Badge>}
                                                    </span>
                                                </TD>
                                                <TD numeric>{v.total_users.toLocaleString()}</TD>
                                                <TD numeric>{v.conversions.toLocaleString()}</TD>
                                                <TD numeric>{pct(v.conversion_rate)}</TD>
                                                <TD numeric>
                                                    <span className={v.lift === null ? 'text-zinc-400' : v.lift > 0 ? 'text-emerald-700' : v.lift < 0 ? 'text-red-700' : ''}>
                                                        {v.lift === null ? '-' : `${v.lift > 0 ? '+' : ''}${(v.lift * 100).toFixed(1)}%`}
                                                    </span>
                                                </TD>
                                                <TD numeric>{v.is_control ? '-' : formatChance(v.chance_to_beat_control, control?.total_users ?? 0, v.total_users)}</TD>
                                            </TR>
                                        );
                                    })}
                                </Fragment>
                            ))}
                        </TBody>
                    </Table>
                </div>
            )}
            <CardBody>
                <p className="text-xs text-zinc-500" data-testid="segments-method">
                    Checking many segments finds some differences by chance, so &quot;Better here&quot; or &quot;Worse here&quot; needs the peeking-safe test to clear 5% divided by {current?.comparisons ?? 1} comparisons in this view. Chance to beat control shows once both versions have 100 visitors in the segment. Treat a segment result as a lead for a follow-up test, not as the verdict.
                    {notRecorded ? ' Not recorded covers visitors who joined before segments were stored.' : ''}
                </p>
            </CardBody>
        </Card>
    );
}
