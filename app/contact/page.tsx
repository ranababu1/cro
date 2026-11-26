import { pageMetadata } from '@/lib/site/meta';
import Link from 'next/link';
import { LegalDoc } from '../legal/LegalDoc';
import { LEGAL, contactPhoneHref, operatorName } from '@/lib/legal';
import { ORGANIZATION_ID, WEBSITE_ID } from '@/lib/site/jsonLd';

export const metadata = pageMetadata({
    path: '/contact',
    title: 'Contact',
    description: 'Email, phone and postal address for freeabtest.com support, billing and legal questions, and what to include so we can help quickly.',
});

const contactSchema = [
    {
        '@type': 'ContactPage',
        '@id': `${LEGAL.siteUrl}/contact#page`,
        name: 'Contact freeabtest.com',
        url: `${LEGAL.siteUrl}/contact`,
        isPartOf: { '@id': WEBSITE_ID },
        mainEntity: { '@id': ORGANIZATION_ID },
    },
    {
        '@type': 'Organization',
        '@id': ORGANIZATION_ID,
        contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer support',
            email: LEGAL.contactEmail,
            telephone: LEGAL.contactPhone,
            areaServed: 'Worldwide',
            availableLanguage: 'English',
        },
    },
];

export default function ContactPage() {
    const op = operatorName();
    return (
        <LegalDoc
                slug="contact"
                schema={contactSchema}
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
    );
}
