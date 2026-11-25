import Link from 'next/link';
import { cn } from '../ui/cn';
import { Container } from './Container';

/** Links between sibling marketing pages, shown under the page hero. */
export function Subnav({ label, items, current }: { label: string; items: { href: string; title: string }[]; current: string }) {
    return (
        <div className="border-b border-line bg-white">
            <Container>
                <nav aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto py-2">
                    {items.map((p) => (
                        <Link key={p.href} href={p.href} aria-current={p.href === current ? 'page' : undefined}
                            className={cn('whitespace-nowrap rounded-lg px-3 py-2 text-[14px] font-medium transition-colors', p.href === current ? 'bg-surface text-navy-950' : 'text-muted-strong hover:bg-surface hover:text-navy-950')}>
                            {p.title}
                        </Link>
                    ))}
                </nav>
            </Container>
        </div>
    );
}
