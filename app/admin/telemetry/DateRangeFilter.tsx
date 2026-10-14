'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/app/components/ui';

export function DateRangeFilter() {
    const router = useRouter();
    const pathname = usePathname();
    const sp = useSearchParams();
    const [from, setFrom] = useState(() => sp.get('from') || new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10));
    const [to, setTo] = useState(() => sp.get('to') || new Date().toISOString().slice(0, 10));

    function apply(e?: React.FormEvent) {
        e?.preventDefault();
        const next = new URLSearchParams(sp.toString());
        next.set('from', from);
        next.set('to', to);
        router.push(`${pathname}?${next.toString()}`);
    }

    function preset(days: number) {
        const t = new Date().toISOString().slice(0, 10);
        const f = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
        setFrom(f);
        setTo(t);
        const next = new URLSearchParams(sp.toString());
        next.set('from', f);
        next.set('to', t);
        router.push(`${pathname}?${next.toString()}`);
    }

    return (
        <form onSubmit={apply} className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-zinc-500">
                From
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-md border border-zinc-200 px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs text-zinc-500">
                To
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-md border border-zinc-200 px-2 py-1.5 text-sm" />
            </label>
            <Button type="submit" size="sm">Apply</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => preset(7)}>7d</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => preset(30)}>30d</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => preset(90)}>90d</Button>
        </form>
    );
}
