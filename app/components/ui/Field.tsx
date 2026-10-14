import { forwardRef, useId } from 'react';
import { cn } from './cn';

const control =
    'block w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 disabled:bg-zinc-50 disabled:text-zinc-500';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(control, 'h-9', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(control, 'py-2', className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) {
    return <select ref={ref} className={cn(control, 'h-9 pr-8', className)} {...props} />;
});

interface FieldProps {
    label: string;
    hint?: React.ReactNode;
    error?: string;
    className?: string;
    children: (id: string) => React.ReactNode;
}

/** Label, control and help text. Pass the id to the control for accessibility. */
export function Field({ label, hint, error, className, children }: FieldProps) {
    const id = useId();
    return (
        <div className={cn('space-y-1.5', className)}>
            <label htmlFor={id} className="block text-sm font-medium text-zinc-800">
                {label}
            </label>
            {children(id)}
            {error ? <p className="text-sm text-red-700">{error}</p> : hint ? <p className="text-sm text-zinc-500">{hint}</p> : null}
        </div>
    );
}
