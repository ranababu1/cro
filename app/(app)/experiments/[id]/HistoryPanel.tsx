'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardHeader, CardBody, Button, Spinner, Table, THead, TBody, TR, TH, TD, Badge } from '@/app/components/ui';
import { UpgradeNote } from '@/app/components/UpgradeNote';
import type { AuditEntry } from '@/lib/audit';

type Page = { retention_days: number; entries: AuditEntry[]; next_cursor: string | null };
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const period = (d: number) => (d % 365 === 0 ? `${d / 365} year${d === 365 ? '' : 's'}` : `${d} days`);

/** History tab: this test's audit entries. Paid plans, like the audit log; the server enforces the same rule. */
export function HistoryPanel({ experimentId }: { experimentId: string }) {
    const [state, setState] = useState<{ status: 'loading' | 'ok' | 'locked' | 'error'; page?: Page }>({ status: 'loading' });
    const [more, setMore] = useState(false);

    const fetchPage = useCallback(async (cursor: string | null) => {
        const res = await fetch(`/api/experiments/${experimentId}/history${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
        if (res.status === 403) return { locked: true as const };
        if (!res.ok) throw new Error('load failed');
        return { page: (await res.json()) as Page };
    }, [experimentId]);

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

    if (state.status === 'loading') return <Spinner />;
    if (state.status === 'error') return <p className="text-sm text-red-600">Could not load the history of this test.</p>;
    if (state.status === 'locked') {
        return <div data-testid="history-locked"><UpgradeNote>Test history is part of the paid plans. Upgrade to Starter or above to see who created, edited, started, paused or stopped this test, and when.</UpgradeNote></div>;
    }
    const p = state.page!;
    return (
        <div className="space-y-4">
            <Card>
                <CardHeader title="History" description={`Who changed this test and when. Entries are kept for ${period(p.retention_days)} on your plan.`} />
                <CardBody className="p-0">
                    {p.entries.length === 0 ? <p className="p-5 text-sm text-zinc-500">No changes in this period.</p> : (
                        <Table data-testid="history-table">
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
                                        <TD className="font-medium text-zinc-900">{e.label}</TD>
                                        <TD className="max-w-md text-xs text-zinc-600"><span className="line-clamp-2" title={e.details ?? ''}>{e.details ?? ''}</span></TD>
                                    </TR>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </CardBody>
            </Card>
            {p.next_cursor && <div className="flex justify-center"><Button variant="secondary" disabled={more} onClick={() => void loadMore()}>{more ? 'Loading...' : 'Show older entries'}</Button></div>}
        </div>
    );
}
