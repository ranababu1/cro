'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Select, Field, Alert } from '@/app/components/ui';
import { COUNTRIES, JOB_ROLES, COMPANY_SIZES, HEARD_FROM, PRIMARY_GOALS, safeNext, type ProfileValues } from '@/lib/profile';


export function ProfileForm({ initial, next, submitLabel = 'Save profile', onboarding = false }: { initial: ProfileValues; next?: string | null; submitLabel?: string; onboarding?: boolean }) {
    const router = useRouter();
    const [v, setV] = useState<ProfileValues>(initial);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const [busy, setBusy] = useState(false);
    const dial = useMemo(() => COUNTRIES.find((c) => c.code === v.country)?.dial ?? '', [v.country]);
    const set = <K extends keyof ProfileValues>(k: K, val: ProfileValues[K]) => { setV((p) => ({ ...p, [k]: val })); setSaved(false); };

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true); setError('');
        const res = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) });
        const data = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) { setError(data.error || 'Could not save your profile'); return; }
        if (data.profile?.phone) set('phone', data.profile.phone);
        setSaved(true);
        if (next || onboarding) { router.push(safeNext(next)); router.refresh(); } else router.refresh();
    }

    async function skip() {
        await fetch('/api/profile/skip', { method: 'POST' });
        router.push('/dashboard'); router.refresh();
    }

    const choice = (k: 'job_role' | 'company_size' | 'heard_from' | 'primary_goal', label: string, opts: readonly string[]) => (
        <Field label={label}>{(id) => (
<Select id={id} value={v[k]} onChange={(e) => set(k, e.target.value)} name={k}>
                <option value="">Choose one</option>
                {opts.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
)}</Field>
    );

    return (
        <form onSubmit={submit} className="space-y-4" noValidate>
            {error && <Alert tone="danger">{error}</Alert>}
            {saved && !next && !onboarding && <Alert tone="success">Profile saved.</Alert>}
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name (required)">{(id) => (
<Input id={id} name="first_name" required maxLength={60} autoComplete="given-name" value={v.first_name} onChange={(e) => set('first_name', e.target.value)} />
)}</Field>
                <Field label="Last name (required)">{(id) => (
<Input id={id} name="last_name" required maxLength={60} autoComplete="family-name" value={v.last_name} onChange={(e) => set('last_name', e.target.value)} />
)}</Field>
                <Field label="Country (required)">{(id) => (
<Select id={id} name="country" required value={v.country} onChange={(e) => set('country', e.target.value)} autoComplete="country">
                        <option value="">Choose your country</option>
                        {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </Select>
)}</Field>
                <Field label="Phone" hint={dial ? `Include the country code, for example ${dial} ...` : 'Include the country code, for example +1 415 555 0123'}>{(id) => (
<Input id={id} name="phone" type="tel" maxLength={40} autoComplete="tel" placeholder={dial ? `${dial} ` : '+'} value={v.phone} onChange={(e) => set('phone', e.target.value)} />
)}</Field>
                <Field label="Company or website">{(id) => (
<Input id={id} name="company" maxLength={120} autoComplete="organization" value={v.company} onChange={(e) => set('company', e.target.value)} />
)}</Field>
                {choice('job_role', 'Job role', JOB_ROLES)}
                {choice('company_size', 'Company size', COMPANY_SIZES)}
                {choice('heard_from', 'How did you hear about us?', HEARD_FROM)}
                {choice('primary_goal', 'Primary goal', PRIMARY_GOALS)}
            </div>
            <label className="flex items-start gap-2 text-sm text-zinc-700">
                <input type="checkbox" name="marketing_opt_in" className="mt-0.5" checked={v.marketing_opt_in} onChange={(e) => set('marketing_opt_in', e.target.checked)} />
                <span>Send me product updates and tips by email. You can unsubscribe at any time.</span>
            </label>
            <div className="flex items-center gap-3">
                <Button type="submit" disabled={busy}>{busy ? 'Saving...' : submitLabel}</Button>
                {onboarding && <Button type="button" variant="ghost" onClick={skip}>Skip for now</Button>}
            </div>
        </form>
    );
}
