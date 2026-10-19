'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PageHeader, Card, CardHeader, CardBody, Table, THead, TBody, TR, TH, TD, Button, Input, Select, Field, StatusBadge, Alert, EmptyState } from '@/app/components/ui';
import { UpgradeNote } from '@/app/components/UpgradeNote';
import { collectionSummary, type Collection } from '../experiments/[id]/HeatmapCollection';

type Match = 'equals' | 'starts_with' | 'contains';
interface PageHeatmap { id: string; name: string; status: 'active' | 'paused'; match: Match; match_value: string; preview_url: string | null; rule: string; collection: Collection }
interface Data { heatmaps: PageHeatmap[]; max: number }

const MATCH: Record<Match, string> = { equals: 'Page address is', starts_with: 'Page address starts with', contains: 'Page address contains' };

/** Page heatmaps (paid): heatmaps for pages without a test. */
export default function PageHeatmapsPage() {
    const [state, setState] = useState<{ status: 'loading' | 'ok' | 'locked' | 'error'; data?: Data }>({ status: 'loading' });
    const [adding, setAdding] = useState(false);
    const [tick, setTick] = useState(0);
    const reload = useCallback(() => setTick((t) => t + 1), []);

    useEffect(() => {
        let live = true;
        fetch('/api/page-heatmaps').then(async (res) => {
            if (!live) return;
            if (res.status === 403) return setState({ status: 'locked' });
            if (!res.ok) return setState({ status: 'error' });
            setState({ status: 'ok', data: await res.json() });
        }).catch(() => live && setState({ status: 'error' }));
        return () => { live = false; };
    }, [tick]);

    const patch = async (id: string, body: object) => {
        await fetch(`/api/page-heatmaps/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        reload();
    };
    const remove = async (h: PageHeatmap) => {
        if (!window.confirm(`Delete "${h.name}" and its heatmap data?`)) return;
        await fetch(`/api/page-heatmaps/${h.id}`, { method: 'DELETE' });
        reload();
    };

    const d = state.data;
    const full = !!d && d.heatmaps.length >= d.max;
    return (
        <div className="space-y-6">
            <PageHeader
                title="Page heatmaps"
                description="Where visitors click and how far they scroll on any page with the install snippet, without running a test."
                actions={state.status === 'ok' && !adding ? <Button onClick={() => setAdding(true)} disabled={full}>New page heatmap</Button> : undefined}
            />
            {state.status === 'locked' && <UpgradeNote>Heatmaps are part of the paid plans. Upgrade to Starter or above to record click and scroll heatmaps on your pages.</UpgradeNote>}
            {state.status === 'error' && <p className="text-sm text-red-600">Could not load page heatmaps. Try again in a moment.</p>}
            {adding && <NewHeatmap onDone={() => { setAdding(false); reload(); }} />}
            {state.status === 'ok' && d && (
                <Card>
                    <CardHeader title="Your page heatmaps" description={`Up to ${d.max} per project. Visitors who are in a test on the page count toward that test's heatmap instead.`} />
                    {d.heatmaps.length === 0 ? (
                        <EmptyState title="No page heatmaps yet" description="Pick a page, and heatmaps start filling in as sampled visitors browse it." />
                    ) : (
                        <Table>
                            <THead><TR><TH>Name</TH><TH>Status</TH><TH>Pages</TH><TH>Collection</TH><TH /></TR></THead>
                            <TBody>
                                {d.heatmaps.map((h) => (
                                    <TR key={h.id}>
                                        <TD className="font-medium"><Link href={`/heatmaps/${h.id}`} className="text-blue-600 hover:underline">{h.name}</Link></TD>
                                        <TD><StatusBadge status={h.status === 'active' && !h.collection.collecting ? 'stopped' : h.status} /></TD>
                                        <TD className="max-w-[16rem] break-words text-sm text-zinc-600">{h.rule}</TD>
                                        <TD className="max-w-[20rem] text-sm text-zinc-600">{h.status === 'paused' ? 'Paused. Nothing is recorded.' : collectionSummary(h.collection)}</TD>
                                        <TD className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Link href={`/heatmaps/${h.id}`} className="rounded-md px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100">View</Link>
                                                <Button size="sm" variant="secondary" onClick={() => patch(h.id, { status: h.status === 'active' ? 'paused' : 'active' })}>{h.status === 'active' ? 'Pause' : 'Turn on'}</Button>
                                                <Button size="sm" variant="danger" onClick={() => remove(h)}>Delete</Button>
                                            </div>
                                        </TD>
                                    </TR>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </Card>
            )}
        </div>
    );
}

function NewHeatmap({ onDone }: { onDone: () => void }) {
    const [name, setName] = useState('Home page');
    const [match, setMatch] = useState<Match>('equals');
    const [value, setValue] = useState('');
    const [preview, setPreview] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        setError('');
        const res = await fetch('/api/page-heatmaps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, match, match_value: value, preview_url: preview.trim() || null }),
        }).catch(() => null);
        setSaving(false);
        if (!res || !res.ok) return setError((await res?.json().catch(() => null))?.error ?? 'Could not save the page heatmap.');
        onDone();
    };

    return (
        <Card>
            <CardHeader title="New page heatmap" description="It starts recording right away, from a sample of visitors on the matching pages. You can change the sample and add stop rules after." />
            <CardBody className="space-y-4">
                <Field label="Name" hint="Only you see this.">{(id) => <Input id={id} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />}</Field>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Pages">{(id) => <Select id={id} value={match} onChange={(e) => setMatch(e.target.value as Match)}>{Object.entries(MATCH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
                    <Field label="Address" hint="A full address or a path such as /pricing. Query strings are ignored.">{(id) => <Input id={id} value={value} maxLength={500} onChange={(e) => setValue(e.target.value)} placeholder="/pricing" />}</Field>
                </div>
                <Field label="Preview address" hint="Optional. A full address of one matching page, shown under the overlay view.">{(id) => <Input id={id} value={preview} maxLength={2000} onChange={(e) => setPreview(e.target.value)} placeholder="https://example.com/pricing" />}</Field>
                {error && <Alert tone="danger">{error}</Alert>}
                <div className="flex gap-2">
                    <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Start recording'}</Button>
                    <Button variant="secondary" onClick={onDone}>Cancel</Button>
                </div>
            </CardBody>
        </Card>
    );
}
