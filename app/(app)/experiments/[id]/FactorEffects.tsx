'use client';

import { Card, CardHeader, Table, THead, TBody, TR, TH, TD } from '@/app/components/ui';
import { factorEffects, parseMvt } from '@/lib/mvt';
import type { Variation, VariationMetrics } from '@/lib/types';

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

/** Multivariate tests: each factor level's rate, summed over the combinations that use it. */
export function FactorEffects({ mvt, variations, rows }: { mvt: string | null; variations: Variation[]; rows: VariationMetrics[] }) {
    const config = parseMvt(mvt);
    if (!config) return null;
    const effects = factorEffects(config, variations, rows);
    return (
        <Card data-testid="factor-effects">
            <CardHeader title="Effect of each factor" description="Each level's visitors and conversions summed over every combination that uses it. The even split balances the other factors, so this compares one change at a time. Use it as a guide: the significance verdict above compares whole combinations." />
            <Table>
                <THead><tr><TH>Factor</TH><TH>Level</TH><TH align="right">Visitors</TH><TH align="right">Conversions</TH><TH align="right">Conversion rate</TH><TH align="right">Lift vs original</TH></tr></THead>
                <TBody>
                    {effects.flatMap((levels) => levels.map((l, i) => (
                        <TR key={`${l.factor}:${l.level}`}>
                            <TD className="font-medium text-zinc-900">{i === 0 ? l.factor : ''}</TD>
                            <TD className={l.is_original ? 'text-zinc-500' : undefined}>{l.level}</TD>
                            <TD numeric>{l.visitors.toLocaleString()}</TD>
                            <TD numeric>{l.conversions.toLocaleString()}</TD>
                            <TD numeric>{pct(l.conversion_rate)}</TD>
                            <TD numeric><span className={l.lift === null ? 'text-zinc-400' : l.lift > 0 ? 'text-emerald-700' : l.lift < 0 ? 'text-red-700' : ''}>{l.lift === null ? '-' : `${l.lift > 0 ? '+' : ''}${(l.lift * 100).toFixed(1)}%`}</span></TD>
                        </TR>
                    )))}
                </TBody>
            </Table>
        </Card>
    );
}
