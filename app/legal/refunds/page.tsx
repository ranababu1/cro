import { pageMetadata } from '@/lib/site/meta';
import Link from 'next/link';
import { LegalDoc } from '../LegalDoc';
import { LEGAL, contactPhoneHref } from '@/lib/legal';

export const metadata = pageMetadata({
    path: '/legal/refunds',
    title: 'Refunds and cancellation',
    description: 'How cancellations, downgrades and refunds work on freeabtest.com paid plans, and how long you keep access after you cancel.',
});

export default function RefundsPage() {
    const mail = <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>;
    return (
        <LegalDoc
            slug="refunds"
            title="Refunds and cancellation"
            intro={
                <p>
                    This page describes how cancellations, downgrades and refunds work for paid plans on {LEGAL.service}. It forms part of the{' '}
                    <Link href="/legal/terms">Terms of Service</Link>.
                </p>
            }
        >
            <h2>Cancelling or changing a plan</h2>
            <p>You can ask to cancel or change a paid plan at any time. Upgrades take effect once payment is confirmed. Downgrades and cancellations take effect at the end of the current billing period. You keep access to the paid plan, including your tests and results, until then.</p>
            <p>This matches the answer on the <Link href="/pricing#faq">pricing FAQ</Link>: upgrades apply right away, and downgrades and cancellations take effect at the end of the billing period.</p>
            <h2>Refunds</h2>
            <p>We do not give mid-cycle refunds when you cancel or downgrade, or for time you do not use in a period you have already paid for. Access continues until that period ends.</p>
            <p>If we charge you by mistake, or charge you twice for the same period, we will refund that charge. If we withdraw a paid plan you have already paid for, you keep access until the end of the period you paid for, or we refund the unused part.</p>
            <h2>How to cancel or ask for a refund</h2>
            <p>
                Write to {mail}, or call <a href={contactPhoneHref()}>{LEGAL.contactPhone}</a>. Include the email on the account and, if you have it, the payment or invoice reference. We will confirm by email. Once paid checkout is available, you will also be able to cancel from the account.
            </p>
            <p>
                Plan prices and billing periods are listed on the <Link href="/pricing">pricing page</Link>. How access is provided is described on the <Link href="/legal/delivery">Service delivery</Link> page.
            </p>
        </LegalDoc>
    );
}
