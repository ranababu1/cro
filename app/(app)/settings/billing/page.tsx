import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAppContext } from '@/lib/appContext';
import { canUseBillingCheckout, paypalConfig } from '@/lib/billing/config';
import { BillingClient } from './BillingClient';

export const metadata: Metadata = { title: 'Billing' };
export const dynamic = 'force-dynamic';

/** Settings, Billing. Hidden (404) until configured, and restricted to test accounts in sandbox mode. */
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ plan?: string; period?: string }> }) {
    const cfg = paypalConfig();
    if (!cfg) notFound();
    const ctx = await getAppContext();
    if (cfg.mode === 'sandbox' && !canUseBillingCheckout(ctx?.user.email)) notFound();
    const { plan, period } = await searchParams;
    return (
        <BillingClient
            clientId={cfg.publicClientId}
            initialPlan={plan === 'growth' ? 'growth' : 'starter'}
            initialPeriod={period === 'yearly' ? 'yearly' : 'monthly'}
        />
    );
}
