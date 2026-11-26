import Link from 'next/link';
import { LEGAL } from '@/lib/legal';
import { Logo } from '../ui/Logo';
import { Container } from './Container';
import { FOOTER_COLUMNS } from './nav';

/** Marketing footer: grouped link columns, contact line and the legal entity. */
export function SiteFooter() {
    return (
        <footer className="border-t border-line">
            <Container className="py-14">
                <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-[1.2fr_repeat(5,1fr)]">
                    <div className="col-span-2 max-w-xs sm:col-span-3 lg:col-span-1">
                        <Logo />
                        <p className="mt-4 text-[14px] leading-[1.6] text-muted-strong">A/B testing for marketers and developers, with results you can trust.</p>
                        <a href={`mailto:${LEGAL.contactEmail}`} className="mt-4 inline-block text-[14px] font-medium text-navy-950 underline underline-offset-2 hover:text-accent-800">{LEGAL.contactEmail}</a>
                    </div>
                    <nav aria-label="Footer" className="contents">
                        {FOOTER_COLUMNS.map((c) => (
                            <div key={c.heading}>
                                <h2 className="text-[13px] font-semibold text-navy-950">{c.heading}</h2>
                                <ul className="mt-3 space-y-2.5">
                                    {c.links.map((l) => (
                                        <li key={l.href}><Link href={l.href} className="text-[14px] text-muted-strong hover:text-navy-950">{l.title}</Link></li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </nav>
                </div>
                <div className="mt-12 flex flex-col gap-2 border-t border-line pt-6 text-[13px] text-navy-950 sm:flex-row sm:items-center sm:justify-between">
                    <p>© {new Date().getFullYear()} FREEABTEST</p>
                    <p>Bengaluru, India</p>
                </div>
            </Container>
        </footer>
    );
}
