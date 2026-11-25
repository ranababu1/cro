import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDoc } from '../legal/LegalDoc';
import { LEGAL, contactPhoneHref, operatorName, organizationJsonLd } from '@/lib/legal';

export const metadata: Metadata = {
    title: 'About',
    description: 'Who operates freeabtest.com and how to reach us.',
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'About freeabtest.com',
    url: `${LEGAL.siteUrl}/about`,
    mainEntity: organizationJsonLd(),
};

export default function AboutPage() {
    const op = operatorName();
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <LegalDoc
                slug="about"
                title="About"
                intro={<p>{LEGAL.service} is an A/B testing service for websites. You run experiments, compare page variants and track goals from a dashboard.</p>}
            >
                <h2>Who operates the service</h2>
                <p>The service is operated by {op}. We are based in Bengaluru, India.</p>
                <p>{LEGAL.address}</p>
                <h2>How to reach us</h2>
                <p>
                    Email: <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>. Phone:{' '}
                    <a href={contactPhoneHref()}>{LEGAL.contactPhone}</a>.
                </p>
                <p>
                    For support, billing or legal questions, see the <Link href="/contact">Contact</Link> page. Plan limits and prices are on the <Link href="/pricing">pricing page</Link>. The{' '}
                    <Link href="/legal/terms">Terms of Service</Link> and <Link href="/legal/privacy">Privacy Policy</Link> describe how the service is used and how we handle data.
                </p>
            </LegalDoc>
        </>
    );
}
