import Link from 'next/link';
import { GOAL_TYPES, GOAL_TYPE_LABELS, BASIC_GOAL_TYPES } from '@/lib/goals';

const WHAT: Record<string, string> = {
    form: 'Count form submissions.',
    page: 'Count visits to a thank-you or other page.',
    event: 'Count events from your code, like ABTest.track(\'signup\'), with revenue.',
};

/** Free plan goal builder: one click goal; the other goal types are shown locked behind an upgrade. */
export function LockedGoalTypes({ maxGoals }: { maxGoals: number | null }) {
    const locked = GOAL_TYPES.filter((t) => !BASIC_GOAL_TYPES.includes(t));
    return (
        <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-teal-50 p-4 text-sm text-[#0b1630]" data-testid="locked-goal-types">
            <p className="font-medium">Free plan: {maxGoals ?? 1} goal per test, a click on a CSS selector.</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                {locked.map((t) => (
                    <li key={t} className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-zinc-500" aria-disabled="true">
                        <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 fill-zinc-400"><path d="M10 2a4 4 0 0 0-4 4v2H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1V6a4 4 0 0 0-4-4Zm-2 6V6a2 2 0 1 1 4 0v2H8Z" /></svg>
                        <span><span className="font-medium text-zinc-700">{GOAL_TYPE_LABELS[t]}</span> <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">Paid plans</span><br />{WHAT[t]}</span>
                    </li>
                ))}
                <li className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-zinc-500 sm:col-span-3" aria-disabled="true">
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 fill-zinc-400"><path d="M10 2a4 4 0 0 0-4 4v2H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1V6a4 4 0 0 0-4-4Zm-2 6V6a2 2 0 1 1 4 0v2H8Z" /></svg>
                    <span><span className="font-medium text-zinc-700">More goals per test</span> <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">Paid plans</span> Track several goals and pick a primary one.</span>
                </li>
            </ul>
            <Link href="/pricing" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-medium text-blue-700 hover:underline">Upgrade to Starter or above</Link>
        </div>
    );
}
