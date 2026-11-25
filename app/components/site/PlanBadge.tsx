import { cn } from '../ui/cn';

/** Which plans include a feature. Every plan is green; paid tiers are neutral so they never read as free. */
export function PlanBadge({ plan, className }: { plan: 'Every plan' | 'Paid plans' | 'Growth and above'; className?: string }) {
    const tone = plan === 'Every plan' ? 'bg-accent-50 text-accent-700 ring-accent-100' : plan === 'Paid plans' ? 'bg-surface text-muted-strong ring-line' : 'bg-soft-blue text-navy-900 ring-blue-200';
    return <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium ring-1 ring-inset', tone, className)}>{plan}</span>;
}
