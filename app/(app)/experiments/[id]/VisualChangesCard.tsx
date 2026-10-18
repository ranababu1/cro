'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardBody, Button, Input, Alert } from '@/app/components/ui';
import { describeChange, MAX_CHANGES, VISUAL_ATTRS, VISUAL_STYLES, type VisualChange } from '@/lib/visualChanges';
import type { Variation } from '@/lib/types';

const selectClass = 'h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';
type Draft = { selector: string; action: VisualChange['action']; name: string; value: string };
const EMPTY: Draft = { selector: '', action: 'text', name: 'color', value: '' };

/** Visual variations (no URL of their own): open the visual editor on the control page, or edit the change list by hand. */
export function VisualChangesCard({ experimentId, variations }: { experimentId: string; variations: Variation[] }) {
    const visual = variations.filter((v) => !v.is_control && !v.url);
    if (!visual.length) return null;
    return <>{visual.map((v) => <VisualVariation key={v.id} experimentId={experimentId} variation={v} />)}</>;
}

function VisualVariation({ experimentId, variation }: { experimentId: string; variation: Variation }) {
    const base = `/api/experiments/${experimentId}/variations/${variation.id}`;
    const [changes, setChanges] = useState<VisualChange[]>([]);
    const [draft, setDraft] = useState<Draft>(EMPTY);
    const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let live = true;
        const load = () => fetch(`${base}/changes`)
            .then((res) => (res.ok ? res.json() : null))
            .then((d) => { if (live && d) setChanges(d.changes ?? []); })
            .catch(() => undefined);
        load();
        // Changes saved in the editor tab show up when you come back to this tab.
        window.addEventListener('focus', load);
        return () => { live = false; window.removeEventListener('focus', load); };
    }, [base]);

    async function save(next: VisualChange[], done: string) {
        setBusy(true); setMsg(null);
        const res = await fetch(`${base}/changes`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes: next }) });
        const data = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) { setMsg({ tone: 'danger', text: data.error || 'Could not save' }); return false; }
        setChanges(data.changes);
        setMsg({ tone: 'success', text: done });
        return true;
    }

    async function openEditor() {
        setBusy(true); setMsg(null);
        // Open the tab first so pop-up blockers allow it, then point it at the editor link.
        const tab = window.open('', '_blank');
        const res = await fetch(`${base}/editor`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok || !data.url) { tab?.close(); setMsg({ tone: 'danger', text: data.error || 'Could not open the visual editor' }); return; }
        if (tab) tab.location.href = data.url; else window.location.href = data.url;
    }

    function add() {
        const c = (draft.action === 'hide' ? { selector: draft.selector, action: 'hide' }
            : draft.action === 'text' ? { selector: draft.selector, action: 'text', value: draft.value }
                : { selector: draft.selector, action: draft.action, name: draft.name, value: draft.value }) as VisualChange;
        void save([...changes, c], 'Change added.').then((ok) => ok && setDraft(EMPTY));
    }

    const names = draft.action === 'style' ? VISUAL_STYLES : VISUAL_ATTRS;
    return (
        <Card data-testid="visual-changes">
            <CardHeader
                title={`Visual changes: ${variation.name}`}
                description="This variation runs on the control page. The snippet applies these changes before the page shows. Edits reach visitors on their next page load."
                actions={<Button size="sm" disabled={busy} onClick={() => void openEditor()} data-testid="open-visual-editor">Open visual editor</Button>}
            />
            <CardBody className="space-y-4">
                {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
                {changes.length === 0 ? (
                    <p className="text-sm text-zinc-500">No changes yet. Open the visual editor to click and change text, colors, links, images or hide elements on your page.</p>
                ) : (
                    <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                        {changes.map((c, i) => (
                            <li key={i} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                                <div className="min-w-0">
                                    <p className="font-medium text-zinc-900">{describeChange(c)}</p>
                                    <p className="truncate font-mono text-xs text-zinc-500" title={c.selector}>{c.selector}</p>
                                </div>
                                <Button variant="ghost" size="sm" disabled={busy} onClick={() => void save(changes.filter((_, j) => j !== i), 'Change removed.')}>Remove</Button>
                            </li>
                        ))}
                    </ul>
                )}
                <p className="text-xs text-zinc-500">{changes.length} of {MAX_CHANGES} changes.</p>
                <details className="rounded-xl border border-zinc-200 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-zinc-800">Add a change by hand</summary>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1.4fr_8rem_9rem_1.4fr_auto]">
                        <Input aria-label="CSS selector" placeholder="h1.hero-title" value={draft.selector} onChange={(e) => setDraft({ ...draft, selector: e.target.value })} />
                        <select aria-label="Change" className={selectClass} value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value as Draft['action'], name: e.target.value === 'attr' ? 'href' : 'color' })}>
                            <option value="text">Text</option>
                            <option value="hide">Hide</option>
                            <option value="style">Style</option>
                            <option value="attr">Attribute</option>
                        </select>
                        {draft.action === 'style' || draft.action === 'attr' ? (
                            <select aria-label="Property" className={selectClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}>
                                {names.map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                        ) : <span className="hidden sm:block" />}
                        {draft.action !== 'hide' ? <Input aria-label="Value" placeholder={draft.action === 'text' ? 'New text' : draft.action === 'style' ? '#0f766e' : 'https://www.example.com/'} value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} /> : <span className="hidden sm:block" />}
                        <Button size="sm" variant="secondary" disabled={busy || !draft.selector.trim() || changes.length >= MAX_CHANGES} onClick={add}>Add</Button>
                    </div>
                </details>
            </CardBody>
        </Card>
    );
}
