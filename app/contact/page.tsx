import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDoc } from '../legal/LegalDoc';
import { LEGAL, contactPhoneHref, operatorName, organizationJsonLd } from '@/lib/legal';

export const metadata: Metadata = {
    title: 'Contact',
    description: 'Email, phone and address for freeabtest.com support, billing and legal questions.',
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: 'Contact freeabtest.com',
    url: `${LEGAL.siteUrl}/contact`,
    mainEntity: {
        ...organizationJsonLd(),
        contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer support',
            email: LEGAL.contactEmail,
            telephone: LEGAL.contactPhone,
            areaServed: 'Worldwide',
            availableLanguage: 'English',
        },
    },
};

export default function ContactPage() {
    const op = operatorName();
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <LegalDoc
                slug="contact"
                title="Contact"
                intro={<p>Use these details for support, billing and legal questions. We are a digital service and do not have a walk-in shop.</p>}
            >
                <h2>Email</h2>
                <p>
                    <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
                </p>
                <h2>Phone</h2>
                <p>
                    <a href={contactPhoneHref()}>{LEGAL.contactPhone}</a>
                </p>
                <h2>Postal address</h2>
                <p>
                    {op}
                    <br />
                    {LEGAL.address}
                </p>
                <h2>Useful links</h2>
                <ul>
                    <li>
                        <Link href="/legal/terms">Terms of Service</Link>
                    </li>
                    <li>
                        <Link href="/legal/privacy">Privacy Policy</Link>
                    </li>
                    <li>
                        <Link href="/legal/refunds">Refunds and cancellation</Link>
                    </li>
                    <li>
                        <Link href="/legal/delivery">Service delivery</Link>
                    </li>
                    <li>
                        <Link href="/pricing">Pricing</Link>
                    </li>
                </ul>
            </LegalDoc>
        </>
    );
}
