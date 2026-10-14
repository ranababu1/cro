'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Org {
    id: string; status: 'active' | 'suspended'; plan: string;
    monthly_visitor_limit: number | null; monthly_experiment_limit: number | null;
}

const toLimit = (v: string) => (v.trim() === '' ? null : Number(v));

export default function TenantControls({ org }: { org: Org }) {
    const router = useRouter();
    const [plan, setPlan] = useState(org.plan);
    const [visitors, setVisitors] = useState(org.monthly_visitor_limit?.toString() ?? '');
    const [experiments, setExperiments] = useState(org.monthly_experiment_limit?.toString() ?? '');
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function patch(body: Record<string, unknown>) {
        setBusy(true);
        setError(null);
        const res = await fetch(`/api/admin/orgs/${org.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        setBusy(false);
        if (!res.ok) { setError((await res.json()).error || 'Update failed'); return; }
        router.refresh();
    }

    return (
        <div className="card bg-base-200"><div className="card-body space-y-4">
            <h2 className="card-title">Plan and limits</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="grid md:grid-cols-3 gap-4">
                <label className="form-control"><span className="label-text">Plan</span>
                    <input className="input input-bordered" value={plan} onChange={(e) => setPlan(e.target.value)} /></label>
                <label className="form-control"><span className="label-text">Monthly visitor limit (blank = unlimited)</span>
                    <input className="input input-bordered" type="number" min={0} value={visitors} onChange={(e) => setVisitors(e.target.value)} /></label>
                <label className="form-control"><span className="label-text">Monthly experiment limit (blank = unlimited)</span>
                    <input className="input input-bordered" type="number" min={0} value={experiments} onChange={(e) => setExperiments(e.target.value)} /></label>
            </div>
            <button className="btn btn-primary w-fit" disabled={busy}
                onClick={() => patch({ plan, monthly_visitor_limit: toLimit(visitors), monthly_experiment_limit: toLimit(experiments) })}>
                Save plan
            </button>

            <h2 className="card-title">Status</h2>
            {org.status === 'active' ? (
                <div className="flex gap-2 items-end">
                    <label className="form-control flex-1"><span className="label-text">Reason (shown in audit log)</span>
                        <input className="input input-bordered" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
                    <button className="btn btn-error" disabled={busy} onClick={() => {
                        if (confirm('Suspend this tenant? Their SDK keys and dashboard stop working immediately.')) {
                            void patch({ status: 'suspended', suspended_reason: reason || null });
                        }
                    }}>Suspend tenant</button>
                </div>
            ) : (
                <button className="btn btn-success w-fit" disabled={busy} onClick={() => patch({ status: 'active' })}>Reactivate tenant</button>
            )}
        </div></div>
    );
}
