'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader, Card, CardHeader, CardBody, Field, Input, Textarea, Button, Alert, Badge } from '@/app/components/ui';
import { PlusIcon, XIcon } from '@/app/components/shell/icons';

interface VariationDraft {
    name: string;
    description: string;
    url: string;
    weight: number;
    is_control: boolean;
}

/** Splits 100 evenly across n arms, giving the remainder to the first arms so the total is exactly 100. */
function evenWeights(n: number): number[] {
    const base = Math.floor(100 / n);
    return Array.from({ length: n }, (_, i) => base + (i < 100 - base * n ? 1 : 0));
}

export default function NewExperiment() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [traffic, setTraffic] = useState(100);
    const [variations, setVariations] = useState<VariationDraft[]>([
        { name: 'Control', description: '', url: '', weight: 50, is_control: true },
        { name: 'Variant B', description: '', url: '', weight: 50, is_control: false },
    ]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const total = variations.reduce((s, v) => s + Number(v.weight || 0), 0);

    const rebalance = (list: VariationDraft[]) => {
        const w = evenWeights(list.length);
        return list.map((v, i) => ({ ...v, weight: w[i] }));
    };

    const add = () =>
        setVariations((vs) => rebalance([...vs, { name: `Variant ${String.fromCharCode(65 + vs.length)}`, description: '', url: '', weight: 0, is_control: false }]));

    const remove = (i: number) =>
        setVariations((vs) => {
            if (vs.length <= 2) return vs;
            const next = vs.filter((_, j) => j !== i);
            if (!next.some((v) => v.is_control)) next[0] = { ...next[0], is_control: true };
            return rebalance(next);
        });

    const update = <K extends keyof VariationDraft>(i: number, key: K, value: VariationDraft[K]) =>
        setVariations((vs) =>
            vs.map((v, j) => {
                if (key === 'is_control') return { ...v, is_control: j === i };
                return j === i ? { ...v, [key]: value } : v;
            }),
        );

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (Math.abs(total - 100) > 0.01) return setError('Variation weights must add up to 100%.');
        setSubmitting(true);
        try {
            const res = await fetch('/api/experiments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, traffic_allocation: traffic, variations: variations.map((v) => ({ ...v, weight: Number(v.weight) })) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not create the experiment');
            router.push(`/experiments/${data.experiment.id}`);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={submit} className="mx-auto max-w-3xl">
            <PageHeader
                breadcrumb={<Link href="/experiments" className="hover:text-zinc-900">Experiments</Link>}
                title="New experiment"
                description="Experiments start as drafts. Nothing is shown to visitors until you start it."
            />

            {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

            <Card>
                <CardHeader title="Details" />
                <CardBody className="space-y-5">
                    <Field label="Name" hint="Visible to your team only.">
                        {(id) => <Input id={id} required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} placeholder="Pricing page headline" />}
                    </Field>
                    <Field label="Hypothesis or description" hint="What you are changing and what you expect to happen.">
                        {(id) => <Textarea id={id} rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A benefit-led headline will increase plan selections." />}
                    </Field>
                    <Field label={`Traffic allocation: ${traffic}%`} hint="Share of eligible visitors who enter the experiment. The rest see your current site and are not counted.">
                        {(id) => <input id={id} type="range" min={0} max={100} step={5} value={traffic} onChange={(e) => setTraffic(Number(e.target.value))} className="w-full accent-brand-600" />}
                    </Field>
                </CardBody>
            </Card>

            <Card className="mt-4">
                <CardHeader
                    title="Variations"
                    description="One control plus up to 25 variants. Weights split the traffic that enters the experiment."
                    actions={
                        <Button variant="secondary" size="sm" onClick={add} disabled={variations.length >= 26}>
                            <PlusIcon />Add variant
                        </Button>
                    }
                />
                <ul className="divide-y divide-zinc-100">
                    {variations.map((v, i) => (
                        <li key={i} className="grid gap-4 px-5 py-4 sm:grid-cols-[1fr_7rem_9.5rem] sm:items-start">
                            <div className="space-y-3">
                                <Input aria-label={`Variation ${i + 1} name`} required value={v.name} onChange={(e) => update(i, 'name', e.target.value)} />
                                <Input aria-label={`Variation ${i + 1} redirect URL`} type="url" placeholder="Redirect URL (optional, for split URL tests)" value={v.url} onChange={(e) => update(i, 'url', e.target.value)} />
                                <Input aria-label={`Variation ${i + 1} description`} placeholder="Description (optional)" value={v.description} onChange={(e) => update(i, 'description', e.target.value)} />
                            </div>
                            <div>
                                <div className="relative">
                                    <Input aria-label={`Variation ${i + 1} weight`} type="number" min={0} max={100} step="any" value={v.weight} onChange={(e) => update(i, 'weight', Number(e.target.value))} className="pr-7 text-right tabular-nums" />
                                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-400">%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-1 sm:pt-0.5">
                                {v.is_control ? (
                                    <Badge tone="brand" className="ml-3">Control</Badge>
                                ) : (
                                    <Button variant="ghost" size="sm" onClick={() => update(i, 'is_control', true)}>Make control</Button>
                                )}
                                <Button variant="ghost" size="sm" aria-label={`Remove ${v.name}`} onClick={() => remove(i)} disabled={variations.length <= 2}>
                                    <XIcon />
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
                <div className="flex items-center justify-between border-t border-zinc-200 px-5 py-3 text-sm">
                    <span className="text-zinc-500">Total weight</span>
                    <span className={`font-medium tabular-nums ${Math.abs(total - 100) > 0.01 ? 'text-red-700' : 'text-zinc-900'}`}>{total}%</span>
                </div>
            </Card>

            <div className="mt-6 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => router.push('/experiments')}>Cancel</Button>
                <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create draft'}</Button>
            </div>
        </form>
    );
}
