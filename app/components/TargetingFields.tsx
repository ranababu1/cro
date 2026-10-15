'use client';

import { Input } from '@/app/components/ui';
import { DEVICES, type Device, type Targeting, type VisitorType } from '@/lib/targeting';

const label = 'block text-sm font-medium text-zinc-800';
const selectClass = 'h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

/** Audience rules for a test. Leave everything empty to include all visitors. */
export function TargetingFields({ value, onChange, disabled }: { value: Targeting; onChange: (t: Targeting) => void; disabled?: boolean }) {
    const devices = value.devices ?? [];
    const toggle = (d: Device) => {
        const next = devices.includes(d) ? devices.filter((x) => x !== d) : [...devices, d];
        onChange({ ...value, devices: next });
    };
    const text = (k: 'utm_source' | 'utm_medium' | 'utm_campaign' | 'referrer_contains', placeholder: string, title: string) => (
        <div>
            <label className={label} htmlFor={`t-${k}`}>{title}</label>
            <Input id={`t-${k}`} className="mt-1" placeholder={placeholder} disabled={disabled} value={value[k] ?? ''} onChange={(e) => onChange({ ...value, [k]: e.target.value })} />
        </div>
    );
    return (
        <div className="space-y-4">
            <div>
                <p className="text-sm font-semibold text-zinc-900">Who can enter</p>
                <p className="text-sm text-zinc-500">Leave empty to include everyone. Visitors already in the test keep their version if you change this.</p>
            </div>
            <div>
                <span className={label}>Devices</span>
                <div className="mt-2 flex flex-wrap gap-2">
                    {DEVICES.map((d) => (
                        <label key={d} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${devices.includes(d) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-zinc-200 text-zinc-700'}`}>
                            <input type="checkbox" className="accent-brand-600" disabled={disabled} checked={devices.includes(d)} onChange={() => toggle(d)} />
                            {d[0].toUpperCase() + d.slice(1)}
                        </label>
                    ))}
                </div>
                <p className="mt-1 text-xs text-zinc-500">None selected means all devices.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
                {text('utm_source', 'google', 'utm_source is')}
                {text('utm_medium', 'cpc', 'utm_medium is')}
                {text('utm_campaign', 'spring_sale', 'utm_campaign is')}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                {text('referrer_contains', 'facebook.com', 'Referrer contains')}
                <div>
                    <label className={label} htmlFor="t-visitor">New or returning</label>
                    <select id="t-visitor" className={`${selectClass} mt-1`} disabled={disabled} value={value.visitor ?? 'all'} onChange={(e) => onChange({ ...value, visitor: e.target.value as VisitorType })}>
                        <option value="all">All visitors</option>
                        <option value="new">New visitors only</option>
                        <option value="returning">Returning visitors only</option>
                    </select>
                </div>
            </div>
        </div>
    );
}
