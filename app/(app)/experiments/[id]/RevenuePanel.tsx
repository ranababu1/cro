'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardBody, Badge, Table, THead, TBody, TR, TH, TD } from '@/app/components/ui';
import { UpgradeNote } from '@/app/components/UpgradeNote';
import type { RevenueVariation, RevenueVerdict } from '@/lib/revenue';

type RevenueGoal = { goal_id: string; goal_name: string; event_name: string; has_revenue: boolean; variations: RevenueVariation[]; verdict: RevenueVerdict | null };
const money = (x: number) => x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Revenue per variation for custom event goals that send an order value. Paid only. */
export function RevenuePanel({ experimentId, hasEventGoals }: { experimentId: string; hasEventGoals: boolean }) {
    const [state, setState] = useState<{ allowed: boolean | null; goals: RevenueGoal[] }>({ allowed: null, goals: [] });
    useEffect(() => {
        if (!hasEventGoals) return;
        let live = true;
        fetch(`/api/experiments/${experimentId}/revenue`).then(async (res) => {
            if (!live) return;
            if (res.status === 403) return setState({ allowed: false, goals: [] });
            const d = await res.json().catch(() => ({}));
            setState({ allowed: res.ok, goals: d.goals ?? [] });
        }).catch(() => undefined);
        return () => { live = false; };
    }, [experimentId, hasEventGoals]);

    if (!hasEventGoals || state.allowed === null) return null;
    if (!state.allowed) return <UpgradeNote>Revenue goals are part of the paid plans. Upgrade to Starter or above to see revenue per visitor and average order value for each variation.</UpgradeNote>;
    if (!state.goals.length) return null;
    return (
        <div className="space-y-6" data-testid="revenue">
            <h2 className="pt-2 text-base font-semibold text-zinc-900">Revenue</h2>
            {state.goals.map((g) => <RevenueCard key={g.goal_id} goal={g} />)}
        </div>
    );
}

function RevenueCard({ goal }: { goal: RevenueGoal }) {
    if (!goal.has_revenue) {
        return (
            <Card>
                <CardHeader title={goal.goal_name} description="No order values yet for this goal." />
                <CardBody>
                    <p className="text-sm text-zinc-600">Send the order value with the event to see revenue here: <code className="rounded bg-zinc-100 px-1">ABTest.track(&apos;{goal.event_name}&apos;, {'{'} revenue: 49.99 {'}'})</code></p>
                </CardBody>
            </Card>
        );
    }
    const best = goal.verdict && goal.variations.find((v) => v.variation_id === goal.verdict!.variation_id);
    return (
        <Card>
            <CardHeader title={goal.goal_name} description="Revenue per visitor counts every visitor in the variation, including those who did not buy." />
            <Table>
                <THead>
                    <tr><TH>Variation</TH><TH align="right">Visitors</TH><TH align="right">Buyers</TH><TH align="right">Orders</TH><TH align="right">Revenue</TH><TH align="right">Per visitor</TH><TH align="right">Avg order</TH><TH align="right">vs control</TH></tr>
                </THead>
                <TBody>
                    {goal.variations.map((v) => (
                        <TR key={v.variation_id}>
                            <TD>
                                <span className="flex items-center gap-2 font-medium text-zinc-900">
                                    {v.name}
                                    {v.is_control && <Badge>Control</Badge>}
                                </span>
                            </TD>
                            <TD numeric>{v.visitors.toLocaleString()}</TD>
                            <TD numeric>{v.buyers.toLocaleString()}</TD>
                            <TD numeric>{v.orders.toLocaleString()}</TD>
                            <TD numeric>{money(v.revenue)}</TD>
                            <TD numeric><span className="font-medium text-zinc-900">{money(v.per_visitor)}</span></TD>
                            <TD numeric>{money(v.average_order)}</TD>
                            <TD numeric>
                                <span className={v.lift === null ? 'text-zinc-400' : v.lift > 0 ? 'text-emerald-700' : v.lift < 0 ? 'text-red-700' : ''}>
                                    {v.lift === null ? '-' : `${v.lift > 0 ? '+' : ''}${(v.lift * 100).toFixed(1)}%`}
                                </span>
                            </TD>
                        </TR>
                    ))}
                </TBody>
            </Table>
            <CardBody>
                <p className="text-sm text-zinc-600" data-testid="revenue-verdict">
                    {!goal.verdict || !best
                        ? 'A revenue verdict appears once the control and the best variant each have at least 30 visitors.'
                        : goal.verdict.significant
                            ? `${best.name} earns ${goal.verdict.lift !== null && goal.verdict.lift >= 0 ? 'more' : 'less'} per visitor than the control, and the difference is statistically significant (p = ${goal.verdict.p_value.toFixed(3)}).`
                            : `${best.name} has the highest revenue per visitor, but the difference from the control is not significant yet (p = ${goal.verdict.p_value.toFixed(3)}).`}
                </p>
                <p className="mt-1 text-xs text-zinc-500">Method: Welch&apos;s t-test on revenue per visitor, best variant against the control. Amounts are in the currency your site sends.</p>
            </CardBody>
        </Card>
    );
}
