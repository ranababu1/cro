import { Card, Alert } from '@/app/components/ui';
import type { PageviewStatus } from '@/lib/pageviewQuota';

/** Monthly tracked pageviews with a progress bar. Collection pauses at the cap until next month. */
export function PageviewUsage({ status, plan }: { status: PageviewStatus; plan: string }) {
    const pct = status.limit ? Math.min(100, Math.round((status.used / status.limit) * 100)) : 0;
    const bar = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-gradient-to-r from-[#2563eb] to-[#14b8a6]';
    return (
        <Card className="mt-6 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                    <p className="text-sm font-semibold text-zinc-900">Tracked pageviews this month</p>
                    <p className="text-xs text-zinc-500">Page loads on pages in a running test. Resets on the 1st (UTC). Plan: {plan}.</p>
                </div>
                <p className="text-sm tabular-nums text-zinc-700">
                    <span className="font-semibold text-zinc-900">{status.used.toLocaleString()}</span>
                    {status.limit === null ? ' (no limit)' : ` of ${status.limit.toLocaleString()}`}
                </p>
            </div>
            {status.limit !== null && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-label="Page views used this month" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                </div>
            )}
            {status.paused && (
                <Alert tone="warning" className="mt-4" title="Tests are paused until next month">
                    You reached this month&apos;s pageview limit, so visitors now see your original pages and no new data is collected. Nothing is charged. Upgrade for a higher limit.
                </Alert>
            )}
            {!status.paused && pct >= 80 && (
                <p className="mt-3 text-sm text-amber-700">You have used {pct}% of this month&apos;s pageviews. Tests pause when you reach the limit.</p>
            )}
        </Card>
    );
}
