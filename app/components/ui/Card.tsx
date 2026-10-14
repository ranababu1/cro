import { cn } from './cn';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('rounded-lg border border-zinc-200 bg-white shadow-card', className)} {...props} />;
}

export function CardHeader({ title, description, actions, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
    return (
        <div className={cn('flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between', className)}>
            <div className="min-w-0">
                <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
                {description && <p className="mt-0.5 text-sm text-zinc-500">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
        </div>
    );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('px-5 py-4', className)} {...props} />;
}
