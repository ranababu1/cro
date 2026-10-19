import { Badge } from '@/app/components/ui';
import type { PlanSource } from '@/lib/entitlements';

export interface TenantPlan { effective: string; source: PlanSource; billing: string }

/** Effective plan for a tenant, with where it comes from when that is not billing. */
export default function PlanCell({ plan }: { plan: TenantPlan }) {
    return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
            <span className="capitalize">{plan.effective}</span>
            {plan.source === 'platform_admin' && <Badge tone="info">Admin</Badge>}
            {plan.source === 'assigned' && <Badge tone="brand">Assigned</Badge>}
            {plan.source !== 'billing' && plan.billing.toLowerCase() !== plan.effective && <span className="text-xs text-zinc-500">billing: {plan.billing}</span>}
        </span>
    );
}
