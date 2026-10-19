'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader, Card, CardBody, Button, Spinner, Table, THead, TBody, TR, TH, TD, Badge } from '@/app/components/ui';
import { UpgradeNote } from '@/app/components/UpgradeNote';
import type { AuditEntry } from '@/lib/audit';

const selectClass = 'h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';
const ENTITIES: [string, string][] = [['', 'Everything'], ['experiment', 'Tests'], ['survey', 'Surveys'], ['popup', 'Popups'], ['domain', 'Domains'], ['api_key', 'API keys'], ['organization', 'Organization'], ['member', 'Team'], ['project', 'Projects'], ['webhook', 'Webhooks'], ['page_heatmap', 'Page heatmaps'], ['idea', 'Test planner']];
type Page = { organization: string | null; retention_days: number; entries: AuditEntry[]; next_cursor: string | null };

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const period = (d: number) => (d % 365 === 0 ? `${d / 365} year${d === 365 ? '' : 's'}` : `${d} days`);

/** Read-only audit log for the current organization. Paid plans; the server enforces the same rule. */
export default function AuditPage() {
    const [entity, setEntity] = useState('');
    const [state, setState] = useState<{ status: 'loading' | 'ok' | 'locked' | 'error'; page?: Page }>({ status: 'loading' });
    const [more, setMore] = useState(false);

    const fetchPage = useCallback(async (cursor: string | null) => {
        const q = new URLSearchParams();
        if (entity) q.set('entity', entity);
        if (cursor) q.set('cursor', cursor);
        const res = await fetch(`/api/audit?${q}`);
        if (res.status === 403) return { locked: true as const };
        if (!res.ok) throw new Error('load failed');
        const page: Page = await res.json();
        return { page };
    }, [entity]);

    useEffect(() => {
        let live = true;
        fetchPage(null).then((r) => {
            if (!live) return;
            if ('locked' in r) setState({ status: 'locked' }); else setState({ status: 'ok', page: r.page });
        }).catch(() => live && setState({ status: 'error' }));
        return () => { live = false; };
    }, [fetchPage]);

    async function loadMore() {
        const cur = state.page;
        if (!cur?.next_cursor) return;
        setMore(true);
        try {
            const r = await fetchPage(cur.next_cursor);
            if (!('locked' in r)) setState({ status: 'ok', page: { ...r.page, entries: [...cur.entries, ...r.page.entries] } });
        } finally { setMore(false); }
    }

    const p = state.page;
    return (
        <div className="space-y-6">
            <PageHeader
                title="Audit log"
                description={p ? `Who changed what in ${p.organization ?? 'your organization'}. Entries are kept for ${period(p.retention_days)} on your plan.` : 'Who changed what in your organization.'}
                actions={state.status === 'ok' ? (
                    <select aria-label="Show" className={selectClass} value={entity} onChange={(e) => { setEntity(e.target.value); setState({ status: 'loading' }); }}>
                        {ENTITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                ) : undefined}
            />
            {state.status === 'loading' && <Spinner />}
            {state.status === 'error' && <p className="text-sm text-red-600">Could not load the audit log.</p>}
            {state.status === 'locked' && <UpgradeNote>The audit log is part of the paid plans. Upgrade to Starter or above to see who changed what in your organization.</UpgradeNote>}
            {state.status === 'ok' && p && (
                <Card>
                    <CardBody className="p-0">
                        {p.entries.length === 0 ? <p className="p-5 text-sm text-zinc-500">No entries in this period.</p> : (
                            <Table data-testid="audit-table">
                                <THead><TR><TH>When</TH><TH>Who</TH><TH>What</TH><TH>Details</TH></TR></THead>
                                <TBody>
                                    {p.entries.map((e) => (
                                        <TR key={e.id}>
                                            <TD className="whitespace-nowrap text-zinc-600">{when(e.at)}</TD>
                                            <TD className="whitespace-nowrap">
                                                {e.actor.name}
                                                {e.actor.kind === 'team' && <Badge className="ml-2">Support</Badge>}
                                                {e.actor.kind === 'system' && <Badge className="ml-2">{e.actor.name === 'API key' ? 'API' : 'Auto'}</Badge>}
                                            </TD>
                                            <TD>
                                                <span className="font-medium text-zinc-900">{e.label}</span>
                                                <span className="block font-mono text-xs text-zinc-500">{e.entity_id}</span>
                                            </TD>
                                            <TD className="max-w-md text-xs text-zinc-600"><span className="line-clamp-2" title={e.details ?? ''}>{e.details ?? ''}</span></TD>
                                        </TR>
                                    ))}
                                </TBody>
                            </Table>
                        )}
                    </CardBody>
                </Card>
            )}
            {state.status === 'ok' && p?.next_cursor && (
                <div className="flex justify-center"><Button variant="secondary" disabled={more} onClick={() => void loadMore()}>{more ? 'Loading...' : 'Show older entries'}</Button></div>
            )}
        </div>
    );
}
