import Link from 'next/link';
import { Card, Alert } from '@/app/components/ui';

/** capacity: a slot limit (running tests, projects) where being full is normal; shown as a note, not a warning. */
export interface UsageRow { label: string; used: number; limit: number | null; atLimit: string; capacity?: boolean }

/** Plan usage on Overview: one bar per limit, with a plain note at each limit. */
export function PlanUsage({ rows, plan }: { rows: UsageRow[]; plan: string }) {
    const limited = rows.filter((r) => r.limit !== null);
    if (!limited.length) return null;
    const hit = limited.filter((r) => !r.capacity && r.used >= (r.limit as number));
    return (
        <Card className="mt-6 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-900">Plan usage</p>
                <p className="text-xs text-zinc-500">Plan: <span className="capitalize">{plan}</span>. Daily counts reset at midnight UTC, monthly on the 1st.</p>
            </div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {limited.map((r) => {
                    const limit = r.limit as number;
                    const pct = limit > 0 ? Math.min(100, Math.round((r.used / limit) * 100)) : 100;
                    const bar = r.capacity ? 'bg-gradient-to-r from-[#2563eb] to-[#14b8a6]' : pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-gradient-to-r from-[#2563eb] to-[#14b8a6]';
                    return (
                        <div key={r.label}>
                            <div className="flex items-baseline justify-between text-sm">
                                <dt className="text-zinc-600">{r.label}</dt>
                                <dd className="tabular-nums text-zinc-900"><span className="font-semibold">{r.used.toLocaleString('en-US')}</span> of {limit.toLocaleString('en-US')}</dd>
                            </div>
                            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-label={r.label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                                <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                            </div>
                            {r.capacity && r.used >= limit && <p className="mt-1 text-xs text-zinc-500">{r.atLimit}</p>}
                        </div>
                    );
                })}
            </dl>
            {hit.map((r) => (
                <Alert key={r.label} tone="warning" className="mt-4" title={`${r.label}: limit reached`}>
                    {r.atLimit} <Link href="/pricing" className="font-medium text-blue-700 hover:underline">See plans</Link>
                </Alert>
            ))}
        </Card>
    );
}
