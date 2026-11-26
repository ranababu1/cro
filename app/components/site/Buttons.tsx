import Link from 'next/link';
import { cn } from '../ui/cn';

const base = 'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-[15px] font-medium transition-colors transition-shadow duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700';
const variants = {
    primary: 'bg-navy-950 text-white hover:bg-navy-800 hover:shadow-site-btn',
    accent: 'bg-accent-700 text-white hover:bg-accent-800 hover:shadow-site-btn',
    secondary: 'bg-white text-navy-950 ring-1 ring-inset ring-line hover:border-accent-200 hover:shadow-site',
    ghost: 'text-navy-950 hover:bg-surface',
    onDark: 'bg-white text-navy-950 hover:bg-surface',
    outlineDark: 'text-white ring-1 ring-inset ring-white/30 hover:bg-white/10',
};

/** Marketing call to action. Navy is the primary action; accent is for one emphasised action per view. onDark and outlineDark remain for any dark surface (cn does not merge conflicting classes, so do not override colours with className). */
export function SiteButton({ href, variant = 'primary', className, children, onClick }: {
    href: string; variant?: keyof typeof variants; className?: string; children: React.ReactNode; onClick?: () => void;
}) {
    return <Link href={href} onClick={onClick} className={cn(base, variants[variant], className)}>{children}</Link>;
}

export const ArrowIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 10h12M11 5l5 5-5 5" /></svg>
);

export const ChevronIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
    <svg viewBox="0 0 20 20" className={className} aria-hidden><path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
