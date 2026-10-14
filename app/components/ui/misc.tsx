import { cn } from './cn';

export function PageHeader({ title, description, actions, breadcrumb }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; breadcrumb?: React.ReactNode }) {
    return (
        <div className="mb-6">
            {breadcrumb && <div className="mb-2 text-sm text-zinc-500">{breadcrumb}</div>}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">{title}</h1>
                    {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
                </div>
                {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
            </div>
        </div>
    );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
    return (
        <div className="flex flex-col items-center px-6 py-12 text-center">
            {icon && <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-500">{icon}</div>}
            <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
            {description && <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

const alertTones = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
    neutral: 'border-zinc-200 bg-zinc-50 text-zinc-800',
};

export function Alert({ tone = 'neutral', title, children, className }: { tone?: keyof typeof alertTones; title?: React.ReactNode; children?: React.ReactNode; className?: string }) {
    return (
        <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded-md border px-4 py-3 text-sm', alertTones[tone], className)}>
            {title && <p className="font-medium">{title}</p>}
            {children && <div className={cn(title ? 'mt-0.5' : '', 'opacity-90')}>{children}</div>}
        </div>
    );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
    return (
        <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3.5 shadow-card">
            <p className="text-xs font-medium text-zinc-500">{label}</p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-zinc-900 tabular-nums">{value}</p>
            {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
        </div>
    );
}

export function Spinner({ className }: { className?: string }) {
    return <span aria-label="Loading" className={cn('inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700', className)} />;
}

export function Kbd({ children }: { children: React.ReactNode }) {
    return <code className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-xs text-zinc-800">{children}</code>;
}
