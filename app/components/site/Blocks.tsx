import { cn } from '../ui/cn';
import { Container } from './Container';
import { ArrowIcon, SiteButton } from './Buttons';

/** Top of a secondary page: breadcrumb slot, h1, lede and up to two actions. */
export function PageHero({ eyebrow, title, lede, actions, children }: {
    eyebrow?: string; title: React.ReactNode; lede?: React.ReactNode; actions?: { href: string; label: string }[]; children?: React.ReactNode;
}) {
    return (
        <div className="border-b border-line">
            <Container className="py-14 md:py-20">
                {children}
                {eyebrow && <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent-700">{eyebrow}</p>}
                <h1 className={cn('max-w-[820px] text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-navy-950 md:text-[44px]', eyebrow && 'mt-3')}>{title}</h1>
                {lede && <p className="mt-5 max-w-[680px] text-[17px] leading-[1.6] text-muted-strong md:text-[18px]">{lede}</p>}
                {actions && actions.length > 0 && (
                    <div className="mt-8 flex flex-wrap gap-3">
                        {actions.map((a, i) => <SiteButton key={a.href} href={a.href} variant={i === 0 ? 'primary' : 'secondary'}>{a.label}{i === 0 && <ArrowIcon />}</SiteButton>)}
                    </div>
                )}
            </Container>
        </div>
    );
}

/** Closing call to action: a deeper indigo band with a primary button. */
export function CtaBand({ title, body, href, label }: { title: string; body?: string; href: string; label: string }) {
    return (
        <section>
            <Container className="py-14 md:py-16">
                <div className="cta-band flex flex-col items-start gap-6 rounded-3xl px-6 py-10 sm:px-10 md:flex-row md:items-center md:justify-between md:px-12 md:py-12">
                    <div className="max-w-[640px]">
                        <h2 className="text-[26px] font-semibold leading-[1.2] tracking-[-0.02em] text-white md:text-[32px]">{title}</h2>
                        {body && <p className="mt-3 text-[17px] leading-[1.6] text-white/85">{body}</p>}
                    </div>
                    <SiteButton href={href} variant="onDark">{label}<ArrowIcon /></SiteButton>
                </div>
            </Container>
        </section>
    );
}

/** Wraps any illustrative UI so it is never mistaken for real customer data. */
export function SampleDataFrame({ children, className, label = 'Example data' }: { children: React.ReactNode; className?: string; label?: string }) {
    return (
        <figure className={cn('relative overflow-hidden rounded-2xl border border-line bg-white shadow-card', className)}>
            <figcaption className="absolute right-3 top-3 z-10 rounded-full bg-amber-50 px-2.5 py-0.5 text-[12px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200">{label}</figcaption>
            {children}
        </figure>
    );
}

/** Small card for feature and link grids. */
export function SiteCard({ title, body, href, className, children }: { title: string; body?: React.ReactNode; href?: string; className?: string; children?: React.ReactNode }) {
    const inner = (
        <>
            <h3 className="text-[17px] font-semibold text-navy-950">{title}</h3>
            {body && <p className="mt-2 text-[15px] leading-[1.6] text-muted-strong">{body}</p>}
            {children}
        </>
    );
    const cls = cn('site-lift block rounded-xl border border-line bg-white p-6', className);
    return href ? <a href={href} className={cls}>{inner}</a> : <div className={cls}>{inner}</div>;
}
