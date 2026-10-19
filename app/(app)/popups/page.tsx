'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader, Card, CardHeader, CardBody, Table, THead, TBody, TR, TH, TD, Button, Input, Textarea, Select, Field, StatusBadge, Alert, EmptyState } from '@/app/components/ui';
import { UpgradeNote } from '@/app/components/UpgradeNote';
import type { PopupConfig, PopupStats } from '@/lib/popups';

interface Popup { id: string; name: string; status: 'draft' | 'active' | 'paused'; config: PopupConfig | null; stats: PopupStats }
interface Data { popups: Popup[]; max: number }

const BLANK: PopupConfig = {
    title: 'Get 10% off your first order', body: 'Join the newsletter and we send the code right away.', button_text: 'Get the code', button_url: '/signup',
    new_tab: false, position: 'center', color: '#2563eb', trigger: 'delay', trigger_value: 5, frequency: 'once', device: 'all', match: 'all', match_value: '',
};
const POSITION: Record<PopupConfig['position'], string> = { center: 'Center of the page', 'bottom-right': 'Bottom right corner', 'bottom-left': 'Bottom left corner', 'top-bar': 'Bar at the top', 'bottom-bar': 'Bar at the bottom' };
const FREQ: Record<PopupConfig['frequency'], string> = { once: 'Once per visitor', session: 'Once per visit', every_page: 'On every page view' };
const MATCH: Record<PopupConfig['match'], string> = { all: 'All pages', equals: 'Page address is', contains: 'Page address contains', starts_with: 'Page address starts with' };

function triggerText(c: PopupConfig) {
    if (c.trigger === 'exit') return 'When leaving';
    if (c.trigger === 'scroll') return `After ${c.trigger_value}% scroll`;
    return c.trigger_value ? `After ${c.trigger_value}s` : 'Right away';
}

export default function PopupsPage() {
    const [state, setState] = useState<{ status: 'loading' | 'ok' | 'locked' | 'error'; data?: Data }>({ status: 'loading' });
    const [editing, setEditing] = useState<{ id: string | null; name: string; config: PopupConfig } | null>(null);
    const [tick, setTick] = useState(0);
    const reload = useCallback(() => setTick((t) => t + 1), []);

    useEffect(() => {
        let live = true;
        fetch('/api/popups').then(async (res) => {
            if (!live) return;
            if (res.status === 403) return setState({ status: 'locked' });
            if (!res.ok) return setState({ status: 'error' });
            setState({ status: 'ok', data: await res.json() });
        }).catch(() => live && setState({ status: 'error' }));
        return () => { live = false; };
    }, [tick]);

    const patch = async (id: string, body: object) => {
        await fetch(`/api/popups/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        reload();
    };
    const remove = async (p: Popup) => {
        if (!window.confirm(`Delete "${p.name}" and its numbers?`)) return;
        await fetch(`/api/popups/${p.id}`, { method: 'DELETE' });
        reload();
    };

    const d = state.data;
    const full = !!d && d.popups.length >= d.max;
    return (
        <div className="space-y-6">
            <PageHeader
                title="Popups"
                description="Show a message with one button on the pages you choose: a discount, a signup or an announcement. Works on any page with the install snippet."
                actions={state.status === 'ok' && !editing ? <Button onClick={() => setEditing({ id: null, name: 'Newsletter discount', config: BLANK })} disabled={full}>New popup</Button> : undefined}
            />
            {state.status === 'locked' && <UpgradeNote>Popups are part of the paid plans. Upgrade to Starter or above to show popups, corner messages and bars with a call to action, and see how many visitors click.</UpgradeNote>}
            {state.status === 'error' && <p className="text-sm text-red-600">Could not load popups. Try again in a moment.</p>}
            {editing && <Editor key={editing.id ?? 'new'} initial={editing} onDone={() => { setEditing(null); reload(); }} />}
            {state.status === 'ok' && d && !editing && (
                <Card>
                    <CardHeader title="Your popups" description={`Numbers are for the last 30 days. Up to ${d.max} popups per project.`} />
                    {d.popups.length === 0 ? (
                        <EmptyState title="No popups yet" description="Create one, check the preview, then turn it on." />
                    ) : (
                        <Table>
                            <THead><TR><TH>Name</TH><TH>Status</TH><TH>Shows</TH><TH className="text-right">Views</TH><TH className="text-right">Clicks</TH><TH className="text-right">Click rate</TH><TH /></TR></THead>
                            <TBody>
                                {d.popups.map((p) => (
                                    <TR key={p.id}>
                                        <TD className="font-medium">{p.name}</TD>
                                        <TD><StatusBadge status={p.status} /></TD>
                                        <TD className="text-sm text-zinc-600">{p.config ? `${MATCH[p.config.match]}${p.config.match === 'all' ? '' : ` ${p.config.match_value}`}, ${triggerText(p.config).toLowerCase()}` : '-'}</TD>
                                        <TD className="text-right tabular-nums">{p.stats.views.toLocaleString()}</TD>
                                        <TD className="text-right tabular-nums">{p.stats.clicks.toLocaleString()}</TD>
                                        <TD className="text-right tabular-nums">{p.stats.ctr === null ? '-' : `${(p.stats.ctr * 100).toFixed(1)}%`}</TD>
                                        <TD className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="secondary" onClick={() => patch(p.id, { status: p.status === 'active' ? 'paused' : 'active' })}>{p.status === 'active' ? 'Pause' : 'Turn on'}</Button>
                                                <Button size="sm" variant="ghost" onClick={() => p.config && setEditing({ id: p.id, name: p.name, config: p.config })}>Edit</Button>
                                                <Button size="sm" variant="danger" onClick={() => remove(p)}>Delete</Button>
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

function Editor({ initial, onDone }: { initial: { id: string | null; name: string; config: PopupConfig }; onDone: () => void }) {
    const [name, setName] = useState(initial.name);
    const [c, setC] = useState<PopupConfig>(initial.config);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const set = <K extends keyof PopupConfig>(k: K, v: PopupConfig[K]) => setC((x) => ({ ...x, [k]: v }));

    const save = async () => {
        setSaving(true);
        setError('');
        const res = await fetch(initial.id ? `/api/popups/${initial.id}` : '/api/popups', {
            method: initial.id ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, config: c }),
        }).catch(() => null);
        setSaving(false);
        if (!res || !res.ok) return setError((await res?.json().catch(() => null))?.error ?? 'Could not save the popup.');
        onDone();
    };

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <Card>
                <CardHeader title={initial.id ? 'Edit popup' : 'New popup'} description={initial.id ? 'Changes reach your site within a minute.' : 'New popups start as drafts. Turn them on from the list.'} />
                <CardBody className="space-y-4">
                    <Field label="Name" hint="Only you see this.">{(id) => <Input id={id} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />}</Field>
                    <Field label="Title">{(id) => <Input id={id} value={c.title} maxLength={120} onChange={(e) => set('title', e.target.value)} />}</Field>
                    <Field label="Text" hint="Optional. Plain text.">{(id) => <Textarea id={id} rows={3} value={c.body} maxLength={600} onChange={(e) => set('body', e.target.value)} />}</Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Button text">{(id) => <Input id={id} value={c.button_text} maxLength={40} onChange={(e) => set('button_text', e.target.value)} />}</Field>
                        <Field label="Button link" hint="A page address, /path, #section, mailto: or tel:">{(id) => <Input id={id} value={c.button_url} onChange={(e) => set('button_url', e.target.value)} />}</Field>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-zinc-700"><input type="checkbox" checked={c.new_tab} onChange={(e) => set('new_tab', e.target.checked)} /> Open the link in a new tab</label>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Where on the page">{(id) => <Select id={id} value={c.position} onChange={(e) => set('position', e.target.value as PopupConfig['position'])}>{Object.entries(POSITION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
                        <Field label="Color">{(id) => <Input id={id} type="color" value={c.color} onChange={(e) => set('color', e.target.value)} className="p-1" />}</Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="When it shows">{(id) => (
                            <Select id={id} value={c.trigger} onChange={(e) => set('trigger', e.target.value as PopupConfig['trigger'])}>
                                <option value="delay">After some seconds</option>
                                <option value="scroll">After scrolling part of the page</option>
                                <option value="exit">When the visitor is about to leave</option>
                            </Select>
                        )}</Field>
                        {c.trigger !== 'exit' && (
                            <Field label={c.trigger === 'scroll' ? 'Scroll depth (%)' : 'Seconds'}>{(id) => <Input id={id} type="number" min={0} max={c.trigger === 'scroll' ? 100 : 600} value={c.trigger_value} onChange={(e) => set('trigger_value', Math.max(0, Math.round(Number(e.target.value) || 0)))} />}</Field>
                        )}
                    </div>
                    {c.trigger === 'exit' && <p className="text-sm text-zinc-500">Exit intent uses the mouse leaving the window, so it shows on computers only.</p>}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="How often">{(id) => <Select id={id} value={c.frequency} onChange={(e) => set('frequency', e.target.value as PopupConfig['frequency'])}>{Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
                        <Field label="Devices">{(id) => (
                            <Select id={id} value={c.device} onChange={(e) => set('device', e.target.value as PopupConfig['device'])}>
                                <option value="all">All devices</option><option value="desktop">Computers only</option><option value="mobile">Phones only</option>
                            </Select>
                        )}</Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Pages">{(id) => <Select id={id} value={c.match} onChange={(e) => set('match', e.target.value as PopupConfig['match'])}>{Object.entries(MATCH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
                        {c.match !== 'all' && <Field label="Address" hint="A full address or a path such as /pricing">{(id) => <Input id={id} value={c.match_value} onChange={(e) => set('match_value', e.target.value)} placeholder="/pricing" />}</Field>}
                    </div>
                    {error && <Alert tone="danger">{error}</Alert>}
                    <div className="flex gap-2">
                        <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save popup'}</Button>
                        <Button variant="secondary" onClick={onDone}>Cancel</Button>
                    </div>
                </CardBody>
            </Card>
            <Card>
                <CardHeader title="Preview" description="How it looks on your page. Your site's own styles do not change it." />
                <CardBody><Preview c={c} /></CardBody>
            </Card>
        </div>
    );
}

function Preview({ c }: { c: PopupConfig }) {
    const bar = c.position === 'top-bar' || c.position === 'bottom-bar';
    const box = (
        <div className="relative w-full max-w-[340px] rounded-xl bg-white p-5 text-left shadow-xl">
            <span aria-hidden className="absolute right-3 top-2 text-lg text-zinc-400">×</span>
            <p className="mb-1 text-base font-bold text-zinc-900">{c.title || 'Title'}</p>
            {c.body && <p className="mb-4 whitespace-pre-line text-sm text-zinc-600">{c.body}</p>}
            <span className="inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: c.color }}>{c.button_text || 'Button'}</span>
        </div>
    );
    return (
        <div data-testid="popup-preview" className="relative flex h-80 overflow-hidden rounded-lg border border-zinc-200 bg-[repeating-linear-gradient(0deg,#f4f4f5_0,#f4f4f5_12px,#fff_12px,#fff_24px)]">
            {bar ? (
                <div className={`absolute inset-x-0 flex flex-wrap items-center justify-center gap-3 px-10 py-2 text-sm text-white ${c.position === 'top-bar' ? 'top-0' : 'bottom-0'}`} style={{ background: c.color }}>
                    <span className="font-semibold">{c.title || 'Title'}</span>
                    {c.body && <span className="opacity-90">{c.body}</span>}
                    <span className="rounded-md bg-white px-3 py-1 font-semibold" style={{ color: c.color }}>{c.button_text || 'Button'}</span>
                    <span aria-hidden className="absolute right-3">×</span>
                </div>
            ) : c.position === 'center' ? (
                <div className="flex w-full items-center justify-center bg-slate-900/45 p-4">{box}</div>
            ) : (
                <div className={`absolute bottom-4 ${c.position === 'bottom-right' ? 'right-4' : 'left-4'}`}>{box}</div>
            )}
        </div>
    );
}
