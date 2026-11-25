import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { paypalConfig } from '@/lib/billing/config';
import { BillingClient } from './BillingClient';

export const metadata: Metadata = { title: 'Billing' };
export const dynamic = 'force-dynamic';

/** Settings, Billing. Hidden (404) until paid checkout is configured. */
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ plan?: string; period?: string }> }) {
    const cfg = paypalConfig();
    if (!cfg) notFound();
    const { plan, period } = await searchParams;
    return (
        <BillingClient
            clientId={cfg.publicClientId}
            initialPlan={plan === 'growth' ? 'growth' : 'starter'}
            initialPeriod={period === 'yearly' ? 'yearly' : 'monthly'}
        />
    );
}
