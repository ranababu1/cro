import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDoc } from '../LegalDoc';
import { LEGAL, contactPhoneHref } from '@/lib/legal';

export const metadata: Metadata = {
    title: 'Service delivery',
    description: 'How freeabtest.com is delivered: a digital service with no physical shipping.',
};

export default function DeliveryPage() {
    const mail = <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>;
    return (
        <LegalDoc
            slug="delivery"
            title="Service delivery"
            intro={
                <p>
                    {LEGAL.service} is a digital service. This page describes how access is provided. It forms part of the <Link href="/legal/terms">Terms of Service</Link>.
                </p>
            }
        >
            <h2>No physical shipping</h2>
            <p>We do not sell or ship physical goods. There is no parcel, delivery time or shipping address. You do not need to give a delivery address to use the service.</p>
            <h2>How you get access</h2>
            <p>The free plan is available as soon as you create an account and sign in at {LEGAL.siteUrl}.</p>
            <p>When paid checkout is available, paid plan access is added to your account after payment is confirmed. Sign in to use the paid features. There is nothing to download or install for the dashboard itself. To run tests on your website you add our script, as described in the <Link href="/docs">documentation</Link>.</p>
            <h2>If access does not appear</h2>
            <p>
                If payment is confirmed and the paid plan is not visible in your account, email {mail} or call <a href={contactPhoneHref()}>{LEGAL.contactPhone}</a> and include the email on the account and the payment or invoice reference. We will check and restore access.
            </p>
            <p>
                Refunds and cancellations are described on the <Link href="/legal/refunds">Refunds and cancellation</Link> page.
            </p>
        </LegalDoc>
    );
}
