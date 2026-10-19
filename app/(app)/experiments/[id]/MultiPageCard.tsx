'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardBody, Button, Input, Alert } from '@/app/components/ui';
import { UpgradeNote } from '@/app/components/UpgradeNote';
import { MAX_PAGES, PAGE_RULE_MATCH, type PageRule } from '@/lib/multipage';

const selectClass = 'h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';
const MATCH_LABEL: Record<PageRule['match'], string> = { equals: 'Page is', starts_with: 'Address starts with', contains: 'Address contains' };
type State = { pages: PageRule[]; allowed: boolean; visual: boolean };

/** Multi-page tests (Growth+): more pages where the visual changes apply, for example every product page. */
export function MultiPageCard({ experimentId, onSaved }: { experimentId: string; onSaved: () => void }) {
    const [state, setState] = useState<State | null>(null);
    const [rows, setRows] = useState<PageRule[]>([]);
    const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let live = true;
        fetch(`/api/experiments/${experimentId}/pages`).then(async (res) => {
            if (!live || !res.ok) return;
            const d = await res.json();
            setState(d);
            setRows(d.pages);
        }).catch(() => undefined);
        return () => { live = false; };
    }, [experimentId]);

    if (!state || !state.visual) return null;
    if (!state.allowed && !state.pages.length) {
        return <UpgradeNote>Multi-page tests are part of the Growth plan and above. Upgrade to change the same element on many pages in one test, for example the button on every product page.</UpgradeNote>;
    }

    async function save(next: PageRule[]) {
        setBusy(true); setMsg(null);
        const res = await fetch(`/api/experiments/${experimentId}/pages`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pages: next }) });
        const data = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) return setMsg({ tone: 'danger', text: String(data.error || 'Could not save') });
        setRows(data.pages);
        setState((s) => (s ? { ...s, pages: data.pages } : s));
        setMsg({ tone: 'success', text: data.pages.length ? 'Pages saved. The changes apply on these pages from the next page load.' : 'Extra pages removed. The test runs on the control page only.' });
        onSaved();
    }

    const dirty = JSON.stringify(rows) !== JSON.stringify(state.pages);
    return (
        <Card data-testid="multi-page">
            <CardHeader title="Pages in this test" description="The test always runs on the control page. Add rules to run it on more pages too: every version's visual changes apply there, and a visitor keeps one version on all of them." />
            <CardBody className="space-y-3">
                {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
                {rows.length === 0 && <p className="text-sm text-zinc-500">Control page only.</p>}
                {rows.map((r, i) => (
                    <div key={i} className="grid items-center gap-2 sm:grid-cols-[12rem_1fr_auto]" data-testid="page-rule">
                        <select aria-label="Page match" className={selectClass} value={r.match} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, match: e.target.value as PageRule['match'] } : x)))}>
                            {PAGE_RULE_MATCH.map((m) => <option key={m} value={m}>{MATCH_LABEL[m]}</option>)}
                        </select>
                        <Input aria-label="Page address" placeholder={r.match === 'equals' ? 'https://www.example.com/pricing' : '/products/'} value={r.value} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                        <Button variant="ghost" size="sm" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</Button>
                    </div>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button variant="secondary" size="sm" disabled={rows.length >= MAX_PAGES || !state.allowed} onClick={() => setRows([...rows, { match: 'starts_with', value: '' }])}>Add page rule</Button>
                    <Button size="sm" disabled={busy || !dirty || rows.some((r) => !r.value.trim())} onClick={() => void save(rows)}>Save pages</Button>
                </div>
                <p className="text-xs text-zinc-500">Use selectors that exist on every page in the test. Elements a selector does not find are left alone. Up to {MAX_PAGES} rules.</p>
            </CardBody>
        </Card>
    );
}
