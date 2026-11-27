import type { Metadata } from 'next';
import { getAppContext } from '@/lib/appContext';
import { canUseBillingCheckout, paypalConfig } from '@/lib/billing/config';
import { getPlanUsage } from '@/lib/planUsage';
import { PlanUsage } from '@/app/components/PlanUsage';
import { BillingClient } from './BillingClient';

export const metadata: Metadata = { title: 'Plan and billing' };
export const dynamic = 'force-dynamic';

/**
 * Settings, Plan and billing. Always available to signed-in users: it shows the current plan and usage.
 * Paid checkout (PayPal) appears only when it is configured, and in test mode only for test accounts.
 */
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ plan?: string; period?: string }> }) {
    const cfg = paypalConfig();
    const ctx = await getAppContext();
    const checkout = !!cfg && (cfg.mode === 'live' || canUseBillingCheckout(ctx?.user.email));
    const { plan, period } = await searchParams;
    const usage = ctx?.current ? await getPlanUsage(ctx.current.org_id) : null;
    return (
        <>
            <BillingClient
                clientId={cfg?.publicClientId ?? ''}
                checkoutAvailable={checkout}
                initialPlan={plan === 'growth' ? 'growth' : 'starter'}
                initialPeriod={period === 'yearly' ? 'yearly' : 'monthly'}
            />
            {usage && usage.rows.length > 0 && <PlanUsage rows={usage.rows} plan={usage.plan} note={usage.note} hideManageLink />}
        </>
    );
}
