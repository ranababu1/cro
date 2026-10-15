import { Alert } from '@/app/components/ui';
import type { ExperimentResults } from '@/lib/types';

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** Warns when visitors are not split the way the weights say (sample ratio mismatch). */
export function SrmWarning({ srm }: { srm: ExperimentResults['srm'] }) {
    if (!srm?.mismatch) return null;
    const parts = srm.variations.map((v) => `${v.variation_name} ${pct(srm.total ? v.observed / srm.total : 0)} (expected ${pct(v.expected_share)})`);
    return (
        <Alert tone="warning" title="Visitors are not split as expected">
            {parts.join(', ')}. This usually means something blocks one version, such as a redirect, a slow or broken page, or the snippet missing on a variation page. Results may not be reliable until it is fixed. If you changed the traffic split during the test, this warning can also appear. (p = {srm.p_value < 0.0001 ? '< 0.0001' : srm.p_value.toFixed(4)})
        </Alert>
    );
}
