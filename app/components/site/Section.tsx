import { cn } from '../ui/cn';
import { Container } from './Container';
import { SiteReveal } from './SiteReveal';

/** Vertical rhythm for marketing sections: 64px on mobile, 96px from md. `tone` is white, canvas (page background) or navy. */
export function Section({ id, tone = 'white', className, children, labelledBy }: {
    id?: string; tone?: 'white' | 'surface' | 'navy'; className?: string; children: React.ReactNode; labelledBy?: string;
}) {
    const bg = tone === 'navy' ? '' : tone === 'surface' ? 'bg-canvas' : 'bg-white';
    return (
        <section id={id} aria-labelledby={labelledBy} className={cn('scroll-mt-20 py-16 md:py-24', bg, className)}>
            <Container>{children}</Container>
        </section>
    );
}

/** Eyebrow, heading and lede. Use `as="h1"` once per page for page heroes. */
export function SectionHeading({ id, eyebrow, title, lede, as: Tag = 'h2', align = 'left', className }: {
    id?: string; eyebrow?: string; title: React.ReactNode; lede?: React.ReactNode; as?: 'h1' | 'h2'; align?: 'left' | 'center'; className?: string;
}) {
    return (
        <SiteReveal className={cn('max-w-[720px]', align === 'center' && 'mx-auto text-center', className)}>
            {eyebrow && <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent-700">{eyebrow}</p>}
            <Tag id={id} className={cn('font-semibold tracking-[-0.02em] text-navy-950', eyebrow && 'mt-3', Tag === 'h1' ? 'text-[34px] leading-[1.1] md:text-[44px]' : 'text-[28px] leading-[1.2] md:text-[32px]')}>{title}</Tag>
            {lede && <p className="mt-4 text-[17px] leading-[1.6] text-muted-strong md:text-[18px]">{lede}</p>}
        </SiteReveal>
    );
}
