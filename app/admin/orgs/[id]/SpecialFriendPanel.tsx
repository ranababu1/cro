'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardBody, Field, Input, Button, Alert } from '@/app/components/ui';
import type { Allowances } from '@/lib/allowances';

type NumKey = 'monthly_visitors' | 'daily_visitors' | 'lifetime_experiments' | 'monthly_pageviews' | 'max_variations' | 'active_experiments' | 'projects' | 'seats' | 'domains';
const NUM_FIELDS: { key: NumKey; label: string }[] = [
    { key: 'monthly_visitors', label: 'Tested visitors per month' },
    { key: 'daily_visitors', label: 'Tested visitors per day' },
    { key: 'lifetime_experiments', label: 'Experiments (lifetime)' },
    { key: 'monthly_pageviews', label: 'Pageviews per month' },
    { key: 'max_variations', label: 'Max variations' },
    { key: 'active_experiments', label: 'Active experiments' },
    { key: 'projects', label: 'Projects' },
    { key: 'seats', label: 'Seats' },
    { key: 'domains', label: 'Domains' },
];
type Toggle = 'plan' | 'on' | 'off';

// Number inputs: blank = plan default, "unlimited" or -1 = no cap.
function toNum(v: string): number | null | undefined {
    const t = v.trim().toLowerCase();
    if (t === '') return undefined;
    if (t === 'unlimited' || t === '-1') return null;
    return Number(t);
}
const fromNum = (v: number | null | undefined) => (v === undefined ? '' : v === null ? 'unlimited' : String(v));
const toToggle = (v: boolean | undefined): Toggle => (v === undefined ? 'plan' : v ? 'on' : 'off');
const fromToggle = (t: Toggle) => (t === 'plan' ? undefined : t === 'on');

export default function SpecialFriendPanel({ orgId, specialFriend, allowances }: { orgId: string; specialFriend: boolean; allowances: Allowances }) {
    const router = useRouter();
    const [enabled, setEnabled] = useState(specialFriend);
    const [nums, setNums] = useState<Record<NumKey, string>>(() => Object.fromEntries(NUM_FIELDS.map((f) => [f.key, fromNum(allowances[f.key])])) as Record<NumKey, string>);
    const [heatmaps, setHeatmaps] = useState<Toggle>(toToggle(allowances.heatmaps));
    const [recordings, setRecordings] = useState<Toggle>(toToggle(allowances.recordings));
    const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
    const [busy, setBusy] = useState(false);

    async function save() {
        setBusy(true);
        setMsg(null);
        const out: Allowances = { flags: allowances.flags };
        for (const f of NUM_FIELDS) {
            const v = toNum(nums[f.key]);
            if (typeof v === 'number' && !Number.isFinite(v)) { setBusy(false); return setMsg({ tone: 'danger', text: `${f.label} must be a number, blank or unlimited.` }); }
            if (v !== undefined) out[f.key] = v;
        }
        const h = fromToggle(heatmaps); if (h !== undefined) out.heatmaps = h;
        const r = fromToggle(recordings); if (r !== undefined) out.recordings = r;
        if (!out.flags) delete out.flags;
        const res = await fetch(`/api/admin/orgs/${orgId}/allowances`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ special_friend: enabled, allowances: out }) });
        setBusy(false);
        if (!res.ok) return setMsg({ tone: 'danger', text: (await res.json()).error || 'Save failed' });
        setMsg({ tone: 'success', text: 'Allowances saved.' });
        router.refresh();
    }

    const select = (id: string, value: Toggle, set: (t: Toggle) => void) => (
        <select id={id} value={value} onChange={(e) => set(e.target.value as Toggle)} disabled={!enabled} className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm">
            <option value="plan">Plan default</option><option value="on">On</option><option value="off">Off</option>
        </select>
    );

    return (
        <Card className="mt-6">
            <CardHeader title="Special friend" description="Custom allowances override the plan for this org. Blank keeps the plan default; type unlimited for no cap. The tenant only sees the effective limits." />
            <CardBody className="space-y-4">
                {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                    <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                    Special friend
                </label>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {NUM_FIELDS.map((f) => (
                        <Field key={f.key} label={f.label}>{(id) => <Input id={id} value={nums[f.key]} disabled={!enabled} placeholder="Plan default" onChange={(e) => setNums({ ...nums, [f.key]: e.target.value })} />}</Field>
                    ))}
                    <Field label="Heatmaps">{(id) => select(id, heatmaps, setHeatmaps)}</Field>
                    <Field label="Recordings">{(id) => select(id, recordings, setRecordings)}</Field>
                </div>
                <div className="flex justify-end"><Button onClick={() => void save()} disabled={busy}>Save allowances</Button></div>
            </CardBody>
        </Card>
    );
}
