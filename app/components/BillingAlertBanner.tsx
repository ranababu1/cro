import Link from 'next/link';
import type { OwnerBillingAlert } from '@/lib/billing/service';

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null);

/** In-app banner shown to organization owners when a subscription payment fails or is suspended. */
export function BillingAlertBanner({ alert }: { alert: OwnerBillingAlert }) {
    const tone = alert.kind === 'suspended' ? 'border-red-200 bg-red-50 text-red-900' : 'border-amber-200 bg-amber-50 text-amber-900';
    const message = alert.kind === 'suspended'
        ? `Your subscription payment failed and renewals are suspended.${alert.endsAt ? ` Access ends on ${day(alert.endsAt)} unless you update your payment method.` : ''}`
        : `A subscription payment failed${alert.failedAt ? ` on ${day(alert.failedAt)}` : ''}. Update your payment method in PayPal so your plan is not interrupted.`;
    return (
        <div role="status" className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${tone}`} data-testid="billing-alert-banner">
            <span>{message}</span>
            <span className="flex flex-wrap items-center gap-3">
                <Link href="/settings/billing" className="font-medium underline">Open billing</Link>
                <a href={alert.manageUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline">Update in PayPal</a>
            </span>
        </div>
    );
}
