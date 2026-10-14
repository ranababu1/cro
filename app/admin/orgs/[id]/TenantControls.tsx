'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardBody, Field, Input, Button, Alert } from '@/app/components/ui';

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
    const [saved, setSaved] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function patch(body: Record<string, unknown>, message: string) {
        setBusy(true);
        setError(null);
        setSaved(null);
        const res = await fetch(`/api/admin/orgs/${org.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        setBusy(false);
        if (!res.ok) return setError((await res.json()).error || 'Update failed');
        setSaved(message);
        router.refresh();
    }

    return (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <Card>
                <CardHeader title="Plan and limits" description="Limits reset each calendar month. Leave blank for unlimited." />
                <CardBody>
                    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void patch({ plan, monthly_visitor_limit: toLimit(visitors), monthly_experiment_limit: toLimit(experiments) }, 'Plan saved.'); }}>
                        {error && <Alert tone="danger">{error}</Alert>}
                        {saved && <Alert tone="success">{saved}</Alert>}
                        <div className="grid gap-4 sm:grid-cols-3">
                            <Field label="Plan">{(id) => <Input id={id} required value={plan} onChange={(e) => setPlan(e.target.value)} />}</Field>
                            <Field label="Visitors per month">{(id) => <Input id={id} type="number" min={0} value={visitors} placeholder="Unlimited" onChange={(e) => setVisitors(e.target.value)} />}</Field>
                            <Field label="Experiment starts per month">{(id) => <Input id={id} type="number" min={0} value={experiments} placeholder="Unlimited" onChange={(e) => setExperiments(e.target.value)} />}</Field>
                        </div>
                        <div className="flex justify-end"><Button type="submit" disabled={busy}>Save plan</Button></div>
                    </form>
                </CardBody>
            </Card>
            <Card>
                <CardHeader title="Access" />
                <CardBody className="space-y-4">
                    {org.status === 'active' ? (
                        <>
                            <p className="text-sm text-zinc-600">Suspending blocks the tenant&apos;s SDK keys, secret keys and dashboard immediately. Data is kept.</p>
                            <Field label="Reason" hint="Saved in the audit log.">{(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: unpaid invoice" />}</Field>
                            <Button variant="danger" className="w-full" disabled={busy} onClick={() => confirm('Suspend this tenant now?') && patch({ status: 'suspended', suspended_reason: reason || null }, 'Tenant suspended.')}>
                                Suspend tenant
                            </Button>
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-zinc-600">Reactivating restores keys and dashboard access right away.</p>
                            <Button className="w-full" disabled={busy} onClick={() => patch({ status: 'active' }, 'Tenant reactivated.')}>Reactivate tenant</Button>
                        </>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
