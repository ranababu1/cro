import { cn } from './cn';

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<Tone, string> = {
    neutral: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
    brand: 'bg-brand-50 text-brand-700 ring-brand-200',
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    warning: 'bg-amber-50 text-amber-800 ring-amber-200',
    danger: 'bg-red-50 text-red-700 ring-red-200',
    info: 'bg-sky-50 text-sky-700 ring-sky-200',
};

export function Badge({ tone = 'neutral', dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: React.ReactNode }) {
    return (
        <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)}>
            {dot && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />}
            {children}
        </span>
    );
}

const statusTone: Record<string, Tone> = { draft: 'neutral', running: 'success', paused: 'warning', completed: 'info', active: 'success', suspended: 'danger', stopped: 'info' };

export function StatusBadge({ status }: { status: string }) {
    return (
        <Badge tone={statusTone[status] ?? 'neutral'} dot>
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
    );
}
