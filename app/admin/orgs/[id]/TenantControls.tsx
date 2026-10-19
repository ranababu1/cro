'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardBody, Field, Input, Select, Button, Alert } from '@/app/components/ui';
import type { TenantPlan } from '../../PlanCell';

const PLANS = ['free', 'starter', 'growth', 'enterprise'] as const;

interface Org {
    id: string; status: 'active' | 'suspended'; plan: string;
    plan_override: string | null; plan_override_by: string | null; plan_override_at: string | null;
    monthly_visitor_limit: number | null; monthly_experiment_limit: number | null; monthly_pageview_limit: number | null;
}

const toLimit = (v: string) => (v.trim() === '' ? null : Number(v));

export default function TenantControls({ org, plan: effective }: { org: Org; plan: TenantPlan }) {
    const router = useRouter();
    const [plan, setPlan] = useState(org.plan);
    const [assigned, setAssigned] = useState<string>(org.plan_override ?? 'enterprise');
    const [visitors, setVisitors] = useState(org.monthly_visitor_limit?.toString() ?? '');
    const [pageviews, setPageviews] = useState(org.monthly_pageview_limit?.toString() ?? '');
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
                <CardHeader title="Plan and limits" description="Limits reset each calendar month (UTC). Visitor and experiment limits: blank is unlimited. Orgs with a platform admin member have no pageview cap." />
                <CardBody>
                    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void patch({ plan, monthly_visitor_limit: toLimit(visitors), monthly_experiment_limit: toLimit(experiments), monthly_pageview_limit: toLimit(pageviews) }, 'Plan saved.'); }}>
                        {error && <Alert tone="danger">{error}</Alert>}
                        {saved && <Alert tone="success">{saved}</Alert>}
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <Field label="Billing plan">{(id) => <Input id={id} required value={plan} onChange={(e) => setPlan(e.target.value)} />}</Field>
                            <Field label="Visitors per month">{(id) => <Input id={id} type="number" min={0} value={visitors} placeholder="Unlimited" onChange={(e) => setVisitors(e.target.value)} />}</Field>
                            <Field label="Pageviews per month" hint="Blank uses the plan default. -1 is unlimited.">{(id) => <Input id={id} type="number" min={-1} value={pageviews} placeholder="Plan default" onChange={(e) => setPageviews(e.target.value)} />}</Field>
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
            <Card className="lg:col-span-2">
                <CardHeader title="Assigned plan" description="Gives this organization a plan directly. It overrides the billing plan until you remove it, takes effect for the tenant within 30 seconds, and both changes are saved in the audit log." />
                <CardBody className="space-y-3">
                    <p className="text-sm text-zinc-700">
                        Effective plan: <span className="font-medium capitalize">{effective.effective}</span>
                        {effective.source === 'platform_admin' && ' (a platform admin owns this organization, so it is always Enterprise)'}
                        {effective.source === 'assigned' && org.plan_override_by && ` (assigned by ${org.plan_override_by}${org.plan_override_at ? ` on ${new Date(org.plan_override_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''})`}
                        {effective.source === 'billing' && ' (from billing)'}
                    </p>
                    <div className="flex flex-wrap items-end gap-3">
                        <Field label="Plan to assign">{(id) => (
                            <Select id={id} value={assigned} onChange={(e) => setAssigned(e.target.value)}>
                                {PLANS.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
                            </Select>
                        )}</Field>
                        <Button disabled={busy || assigned === org.plan_override} onClick={() => patch({ plan_override: assigned }, `Assigned the ${assigned} plan.`)}>Assign plan</Button>
                        {org.plan_override && <Button variant="secondary" disabled={busy} onClick={() => patch({ plan_override: null }, 'Assigned plan removed. Billing applies again.')}>Remove assigned plan</Button>}
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
