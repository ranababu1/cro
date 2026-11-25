import { getServerSession } from 'next-auth';
import { authOptions } from '../auth';
import { canUseBillingCheckout, paypalConfig } from './config';

/**
 * Whether the current browser session can start or open billing checkout.
 * Separated from config.ts so public pages like /pricing can check without importing next-auth directly.
 */
export async function canSessionCheckout(): Promise<boolean> {
    const cfg = paypalConfig();
    if (!cfg) return false;
    if (cfg.mode === 'live') return true;
    const session = await getServerSession(authOptions);
    return canUseBillingCheckout(session?.user?.email);
}
