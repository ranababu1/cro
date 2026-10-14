import { cn } from './cn';

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
    return (
        <div className="overflow-x-auto">
            <table className={cn('w-full text-left text-sm text-zinc-700', className)} {...props} />
        </div>
    );
}
export function THead(props: React.HTMLAttributes<HTMLTableSectionElement>) {
    return <thead className="border-b border-zinc-200 bg-zinc-50/60" {...props} />;
}
export function TBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
    return <tbody className="divide-y divide-zinc-100" {...props} />;
}
export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
    return <tr className={cn('hover:bg-zinc-50/60', className)} {...props} />;
}
export function TH({ className, align, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' }) {
    return <th scope="col" className={cn('px-4 py-2.5 text-xs font-medium text-zinc-500 whitespace-nowrap', align === 'right' && 'text-right', className)} {...props} />;
}
export function TD({ className, align, numeric, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right'; numeric?: boolean }) {
    return <td className={cn('px-4 py-3 align-middle', (align === 'right' || numeric) && 'text-right', numeric && 'tabular-nums whitespace-nowrap', className)} {...props} />;
}
