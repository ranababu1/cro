import { cn } from '../ui/cn';

/** Page width wrapper for marketing pages: 1200px content with responsive side padding. */
export function Container({ className, children, as: Tag = 'div' }: { className?: string; children: React.ReactNode; as?: 'div' | 'section' | 'header' | 'footer' | 'nav' }) {
    return <Tag className={cn('mx-auto w-full max-w-[1200px] px-5 sm:px-8', className)}>{children}</Tag>;
}
