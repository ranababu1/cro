import Link from 'next/link';
import { forwardRef } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
    'inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
const variants: Record<Variant, string> = {
    primary: 'bg-brand-600 text-white shadow-xs hover:bg-brand-700',
    secondary: 'bg-white text-zinc-900 border border-zinc-300 shadow-xs hover:bg-zinc-50',
    ghost: 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900',
    danger: 'bg-white text-red-700 border border-red-200 shadow-xs hover:bg-red-50',
};
const sizes: Record<Size, string> = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-9 px-4 text-sm',
    lg: 'h-11 px-5 text-base',
};

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className?: string) {
    return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = 'primary', size = 'md', className, type = 'button', ...props },
    ref,
) {
    return <button ref={ref} type={type} className={buttonClasses(variant, size, className)} {...props} />;
});

type ButtonLinkProps = React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function ButtonLink({ variant = 'primary', size = 'md', className, ...props }: ButtonLinkProps) {
    return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
