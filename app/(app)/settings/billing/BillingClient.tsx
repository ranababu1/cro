'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PageHeader, Card, CardHeader, CardBody, Alert, Spinner, Badge, Button } from '@/app/components/ui';

type Plan = 'starter' | 'growth';
type Period = 'monthly' | 'yearly';
type Sub = {
    status: string; plan: Plan | null; period: Period | null; next_billing_at: string | null;
    paid_through: string | null; last_payment_at: string | null; payment_failed_at?: string | null;
};
type State = {
    enabled: boolean; owner?: boolean; mode?: 'sandbox' | 'live' | null; plan?: string; plan_source?: string; billing_plan?: string;
    plan_ends_at?: string | null; scheduled_plan?: string | null; scheduled_period?: Period | null; scheduled_plan_at?: string | null;
    subscription?: Sub | null; manage_url?: string | null;
};

const PRICES: Record<Plan, Record<Period, number>> = { starter: { monthly: 10, yearly: 100 }, growth: { monthly: 50, yearly: 500 } };
const NAMES: Record<string, string> = { free: 'Free', starter: 'Starter', growth: 'Growth', enterprise: 'Enterprise' };
const STATUS: Record<string, string> = { ACTIVE: 'Active', SUSPENDED: 'Payment problem', CANCELLED: 'Cancelled', EXPIRED: 'Ended', APPROVAL_PENDING: 'Waiting for approval', APPROVED: 'Approved' };
const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null);

function isUpgrade(fromPlan: Plan | null, fromPeriod: Period | null, toPlan: Plan, toPeriod: Period): boolean {
    if (!fromPlan || !fromPeriod) return true;
    const rank = (p: Plan) => (p === 'growth' ? 2 : 1);
    if (rank(toPlan) !== rank(fromPlan)) return rank(toPlan) > rank(fromPlan);
    return fromPeriod === 'monthly' && toPeriod === 'yearly';
}

type PayPalButtons = { render: (el: HTMLElement) => Promise<void>; close?: () => Promise<void> };
type PayPalNamespace = { Buttons: (o: Record<string, unknown>) => PayPalButtons };
declare global { interface Window { paypal?: PayPalNamespace } }

function loadPayPal(clientId: string): Promise<PayPalNamespace> {
    if (window.paypal) return Promise.resolve(window.paypal);
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&vault=true&intent=subscription&currency=USD&components=buttons`;
        s.async = true;
        s.dataset.sdkIntegrationSource = 'button-factory';
        s.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error('PayPal did not load')));
        s.onerror = () => reject(new Error('PayPal did not load'));
        document.head.appendChild(s);
    });
}

/** Billing for owners: current plan, subscription status, upgrades, downgrades, cancellation and PayPal checkout. */
export function BillingClient({ clientId, initialPlan, initialPeriod }: { clientId: string; initialPlan: Plan; initialPeriod: Period }) {
    const [s, setS] = useState<State | null>(null);
    const [failed, setFailed] = useState(false);
    const [plan, setPlan] = useState<Plan>(initialPlan);
    const [period, setPeriod] = useState<Period>(initialPeriod);
    const [error, setError] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState<'change' | 'cancel' | 'confirm' | null>(null);
    const [confirmCancel, setConfirmCancel] = useState(false);
    const [buttonsReady, setButtonsReady] = useState(false);
    const box = useRef<HTMLDivElement>(null);
    const choice = useRef({ plan, period });
    useEffect(() => { choice.current = { plan, period }; }, [plan, period]);

    const load = useCallback(async () => {
        const r = await fetch('/api/billing', { cache: 'no-store' });
        if (!r.ok) throw new Error('load');
        const next = (await r.json()) as State;
        setS(next);
        return next;
    }, []);

    useEffect(() => {
        let live = true;
        const params = new URLSearchParams(window.location.search);
        const status = params.get('status');
        const subId = params.get('subscription_id');

        const finishLoad = () =>
            fetch('/api/billing', { cache: 'no-store' })
                .then((r) => (r.ok ? r.json() : null))
                .then((next: State | null) => {
                    if (!live) return;
                    if (next) setS(next);
                    else setFailed(true);
                })
                .catch(() => live && setFailed(true));

        if ((status === 'approved' || status === 'revised') && subId) {
            window.history.replaceState({}, '', '/settings/billing');
            fetch('/api/billing/paypal/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription_id: subId }),
            })
                .then(async (r) => {
                    const d = await r.json().catch(() => ({}));
                    if (!live) return;
                    if (r.ok && d.result === 'granted') setNote('Thank you. Your plan has been updated.');
                    else if (r.ok && d.result === 'scheduled_downgrade') setNote('Your downgrade is scheduled for the end of the current billing period. You keep your current plan until then.');
                    else if (r.ok || r.status === 502) setNote('PayPal is still processing the change; your plan updates as soon as it confirms.');
                    else setError(String(d.error || 'Could not confirm the subscription.'));
                    if (d.billing) setS({ ...d.billing, owner: true });
                    else await finishLoad();
                })
                .catch(() => finishLoad());
            return () => { live = false; };
        }

        if (status === 'cancelled') {
            window.history.replaceState({}, '', '/settings/billing');
            fetch('/api/billing', { cache: 'no-store' })
                .then((r) => (r.ok ? r.json() : null))
                .then((next: State | null) => {
                    if (!live) return;
                    if (next) {
                        setS(next);
                        setNote('Checkout closed. No changes were made.');
                    } else setFailed(true);
                })
                .catch(() => live && setFailed(true));
            return () => { live = false; };
        }

        finishLoad();
        return () => { live = false; };
    }, []);

    const sub = s?.subscription ?? null;
    const isActiveOrSuspended = !!sub && (sub.status === 'ACTIVE' || sub.status === 'SUSPENDED');
    const canBuy = !!s?.enabled && !!s.owner && !isActiveOrSuspended;

    useEffect(() => {
        if (!canBuy || !box.current) return;
        let live = true;
        let buttons: PayPalButtons | null = null;
        const el = box.current;
        loadPayPal(clientId).then((paypal) => {
            if (!live) return;
            buttons = paypal.Buttons({
                style: { layout: 'vertical', label: 'subscribe', shape: 'rect' },
                createSubscription: async () => {
                    setError(''); setNote('');
                    const r = await fetch('/api/billing/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(choice.current) });
                    const d = await r.json().catch(() => ({}));
                    if (!r.ok || !d.id) { setError(String(d.error || 'Could not start checkout.')); throw new Error('subscribe'); }
                    return d.id as string;
                },
                onApprove: async (data: { subscriptionID?: string }) => {
                    setNote('Payment approved. Updating your plan...');
                    const r = await fetch('/api/billing/paypal/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription_id: data.subscriptionID }) });
                    const d = await r.json().catch(() => ({}));
                    if (r.ok && d.result === 'granted') setNote('Thank you. Your plan is active.');
                    else if (r.ok || r.status === 502) setNote('Thank you. PayPal is still processing the payment; your plan updates as soon as it confirms. You can refresh this page in a minute.');
                    else setError(String(d.error || 'Could not confirm the subscription.'));
                    await load().catch(() => {});
                },
                onCancel: () => setNote('Checkout closed. You were not charged.'),
                onError: () => setError('PayPal could not complete the checkout. Please try again.'),
            });
            el.innerHTML = '';
            return buttons.render(el);
        }).catch(() => live && setError('PayPal checkout could not load. Check your connection or ad blocker and try again.'))
            .finally(() => live && setButtonsReady(true));
        return () => { live = false; void buttons?.close?.().catch(() => {}); el.innerHTML = ''; };
    }, [canBuy, clientId, load]);

    async function handlePlanChange() {
        setBusy('change'); setError(''); setNote('');
        try {
            const r = await fetch('/api/billing/change', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan, period }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) {
                setError(String(d.error || 'Could not change plan.'));
                return;
            }
            if ((d.action === 'approve' || d.action === 'checkout_new') && d.approve_url) {
                window.location.assign(String(d.approve_url));
                return;
            }
            if (d.action === 'scheduled_cancel') {
                setNote('Your current subscription will not renew, and you keep your current plan until the end of the billing period. Start the new plan here once your current period ends.');
            } else if (d.action === 'applied') {
                setNote('Your plan change has been applied.');
            } else {
                setNote('No changes were needed.');
            }
            if (d.billing) setS({ ...d.billing, owner: true });
            else await load().catch(() => {});
        } finally {
            setBusy(null);
        }
    }

    async function handleCancel() {
        setBusy('cancel'); setError(''); setNote('');
        try {
            const r = await fetch('/api/billing/cancel', { method: 'POST' });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) {
                setError(String(d.error || 'Could not cancel the subscription.'));
                return;
            }
            setConfirmCancel(false);
            setNote('Your subscription is cancelled. You keep your current plan until the end of the period you paid for.');
            if (d.billing) setS({ ...d.billing, owner: true });
            else await load().catch(() => {});
        } finally {
            setBusy(null);
        }
    }

    if (failed) return <Alert tone="danger">Could not load billing.</Alert>;
    if (!s) return <div className="flex justify-center py-16"><Spinner /></div>;
    if (!s.enabled) return <Alert tone="neutral">Billing is not available yet.</Alert>;

    const sameAsActive = sub?.status === 'ACTIVE' && sub.plan === plan && sub.period === period;
    const upgradeSelected = isUpgrade(sub?.plan ?? null, sub?.period ?? null, plan, period);

    return (
        <>
            <PageHeader title="Billing" description="Your plan and payments. Paid plans are billed in US dollars through PayPal." />
            {s.mode === 'sandbox' && <Alert tone="warning" className="mb-4" title="Test mode">Payments use PayPal test accounts. No real money is charged.</Alert>}
            {!s.owner && <Alert tone="neutral">Only owners of the organization can see and change billing.</Alert>}
            {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
            {note && <Alert tone="success" className="mb-4">{note}</Alert>}

            {s.owner && (
                <>
                    {sub?.status === 'SUSPENDED' && (
                        <Alert tone="danger" className="mb-4" title="Payment failed — subscription suspended">
                            PayPal could not collect payment. Update your payment method in{' '}
                            {s.manage_url ? <a className="font-medium underline" href={s.manage_url} target="_blank" rel="noopener noreferrer">automatic payments in PayPal</a> : 'PayPal'}{' '}
                            to keep your paid plan{s.plan_ends_at ? ` after ${day(s.plan_ends_at)}` : ''}, or cancel below so PayPal stops retrying.
                        </Alert>
                    )}
                    {sub?.status === 'ACTIVE' && sub.payment_failed_at && (
                        <Alert tone="warning" className="mb-4" title="Recent payment failed">
                            A payment attempt failed on {day(sub.payment_failed_at)}. Update your payment method in{' '}
                            {s.manage_url ? <a className="font-medium underline" href={s.manage_url} target="_blank" rel="noopener noreferrer">PayPal</a> : 'PayPal'}{' '}
                            so your plan is not interrupted.
                        </Alert>
                    )}

                    <Card className="mb-6">
                        <CardHeader title="Current plan" />
                        <CardBody>
                            <dl className="grid gap-4 text-sm sm:grid-cols-3">
                                <div><dt className="text-zinc-500">Plan</dt><dd className="mt-1 font-medium text-zinc-900" data-testid="billing-plan">{NAMES[s.plan ?? 'free'] ?? s.plan}</dd></div>
                                <div><dt className="text-zinc-500">Status</dt><dd className="mt-1">{sub ? <Badge>{STATUS[sub.status] ?? sub.status}</Badge> : <span className="text-zinc-700">No subscription</span>}</dd></div>
                                <div>
                                    <dt className="text-zinc-500">{s.plan_ends_at ? 'Access until' : s.scheduled_plan && s.scheduled_plan_at ? 'Changes on' : 'Next payment'}</dt>
                                    <dd className="mt-1 text-zinc-900">
                                        {s.plan_ends_at
                                            ? day(s.plan_ends_at)
                                            : s.scheduled_plan && s.scheduled_plan_at
                                                ? `${day(s.scheduled_plan_at)} (to ${NAMES[s.scheduled_plan] ?? s.scheduled_plan})`
                                                : day(sub?.next_billing_at) ?? 'None'}
                                    </dd>
                                </div>
                            </dl>
                            {s.plan_source && s.plan_source !== 'billing' && <p className="mt-4 text-sm text-zinc-600">Your plan was set up by our team, so it does not depend on a subscription.</p>}
                            {sub?.status === 'CANCELLED' && s.plan_ends_at && s.scheduled_plan && (
                                <p className="mt-4 text-sm text-zinc-600">
                                    Your current subscription is cancelled and will not renew. You keep {NAMES[s.plan ?? 'free']} until {day(s.plan_ends_at)}. You chose to switch to {NAMES[s.scheduled_plan]} ({s.scheduled_period}); start that subscription here once {day(s.plan_ends_at)} passes.
                                </p>
                            )}
                            {sub?.status === 'CANCELLED' && s.plan_ends_at && !s.scheduled_plan && (
                                <p className="mt-4 text-sm text-zinc-600">
                                    Your subscription is cancelled. You keep {NAMES[s.plan ?? 'free']} until {day(s.plan_ends_at)}, with no further charges.
                                </p>
                            )}
                            {isActiveOrSuspended && (
                                <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4 text-sm">
                                    {s.manage_url && (
                                        <a className="font-medium text-blue-700 underline" href={s.manage_url} target="_blank" rel="noopener noreferrer">
                                            Manage payment method in PayPal
                                        </a>
                                    )}
                                    {!confirmCancel ? (
                                        <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => setConfirmCancel(true)}>
                                            Cancel at period end
                                        </Button>
                                    ) : (
                                        <div className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                                            <span className="text-zinc-700">No mid-cycle refunds; access continues until the period ends.</span>
                                            <Button size="sm" variant="danger" disabled={busy !== null} onClick={() => void handleCancel()}>
                                                {busy === 'cancel' ? 'Cancelling...' : 'Confirm cancel'}
                                            </Button>
                                            <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => setConfirmCancel(false)}>
                                                Keep plan
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardBody>
                    </Card>

                    {sub?.status === 'ACTIVE' && (
                        <Card className="mb-6">
                            <CardHeader
                                title="Change plan"
                                description="Upgrades apply right away once confirmed with PayPal. Downgrades take effect at the end of the current billing period with no mid-cycle refunds."
                            />
                            <CardBody>
                                <div className="flex flex-wrap gap-6">
                                    <fieldset>
                                        <legend className="text-sm font-medium text-zinc-900">Plan</legend>
                                        <div className="mt-2 flex gap-2">
                                            {(['starter', 'growth'] as Plan[]).map((p) => (
                                                <label key={p} className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${plan === p ? 'border-blue-600 bg-blue-50 text-zinc-900' : 'border-zinc-200 text-zinc-700'}`}>
                                                    <input type="radio" name="change-plan" value={p} checked={plan === p} onChange={() => setPlan(p)} className="sr-only" />
                                                    {NAMES[p]}
                                                </label>
                                            ))}
                                        </div>
                                    </fieldset>
                                    <fieldset>
                                        <legend className="text-sm font-medium text-zinc-900">Billing period</legend>
                                        <div className="mt-2 flex gap-2">
                                            {(['monthly', 'yearly'] as Period[]).map((p) => (
                                                <label key={p} className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${period === p ? 'border-blue-600 bg-blue-50 text-zinc-900' : 'border-zinc-200 text-zinc-700'}`}>
                                                    <input type="radio" name="change-period" value={p} checked={period === p} onChange={() => setPeriod(p)} className="sr-only" />
                                                    {p === 'monthly' ? 'Monthly' : 'Yearly (2 months free)'}
                                                </label>
                                            ))}
                                        </div>
                                    </fieldset>
                                </div>
                                <p className="mt-4 text-sm text-zinc-700" data-testid="billing-change-summary">
                                    {sameAsActive
                                        ? `You are already on ${NAMES[plan]} (${period}).`
                                        : upgradeSelected
                                            ? `Upgrade to ${NAMES[plan]} ($${PRICES[plan][period]} ${period === 'monthly' ? 'a month' : 'a year'}): takes effect as soon as PayPal confirms.`
                                            : `Downgrade to ${NAMES[plan]} ($${PRICES[plan][period]} ${period === 'monthly' ? 'a month' : 'a year'}): takes effect at the end of your current billing period.`}
                                </p>
                                <div className="mt-4">
                                    <Button disabled={busy !== null || sameAsActive} onClick={() => void handlePlanChange()}>
                                        {busy === 'change' ? 'Updating...' : upgradeSelected ? 'Upgrade now' : 'Downgrade at period end'}
                                    </Button>
                                </div>
                            </CardBody>
                        </Card>
                    )}

                    {canBuy && (
                        <Card className="mb-6">
                            <CardHeader title="Choose a paid plan" description="Upgrades take effect once PayPal confirms the payment. No mid-cycle refunds; after a cancellation your plan stays until the end of the period you paid for." />
                            <CardBody>
                                <div className="flex flex-wrap gap-6">
                                    <fieldset>
                                        <legend className="text-sm font-medium text-zinc-900">Plan</legend>
                                        <div className="mt-2 flex gap-2">
                                            {(['starter', 'growth'] as Plan[]).map((p) => (
                                                <label key={p} className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${plan === p ? 'border-blue-600 bg-blue-50 text-zinc-900' : 'border-zinc-200 text-zinc-700'}`}>
                                                    <input type="radio" name="plan" value={p} checked={plan === p} onChange={() => setPlan(p)} className="sr-only" />
                                                    {NAMES[p]}
                                                </label>
                                            ))}
                                        </div>
                                    </fieldset>
                                    <fieldset>
                                        <legend className="text-sm font-medium text-zinc-900">Billing period</legend>
                                        <div className="mt-2 flex gap-2">
                                            {(['monthly', 'yearly'] as Period[]).map((p) => (
                                                <label key={p} className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${period === p ? 'border-blue-600 bg-blue-50 text-zinc-900' : 'border-zinc-200 text-zinc-700'}`}>
                                                    <input type="radio" name="period" value={p} checked={period === p} onChange={() => setPeriod(p)} className="sr-only" />
                                                    {p === 'monthly' ? 'Monthly' : 'Yearly (2 months free)'}
                                                </label>
                                            ))}
                                        </div>
                                    </fieldset>
                                </div>
                                <p className="mt-4 text-sm text-zinc-700" data-testid="billing-price">
                                    {NAMES[plan]}: <span className="font-semibold text-zinc-900">${PRICES[plan][period]}</span> {period === 'monthly' ? 'a month' : 'a year'}, plus any tax that applies. Renews automatically until you cancel.
                                </p>
                                <div className="mt-4 max-w-sm" ref={box} />
                                {!buttonsReady && <div className="mt-2"><Spinner /></div>}
                                <p className="mt-4 text-xs text-zinc-500">
                                    By subscribing you agree to the <Link className="underline" href="/legal/terms" target="_blank" rel="noopener noreferrer">Terms of Service</Link> and the <Link className="underline" href="/legal/refunds" target="_blank" rel="noopener noreferrer">Refunds and cancellation</Link> policy. Compare plans on the <Link className="underline" href="/pricing" target="_blank" rel="noopener noreferrer">pricing page</Link>.
                                </p>
                            </CardBody>
                        </Card>
                    )}
                </>
            )}
        </>
    );
}
