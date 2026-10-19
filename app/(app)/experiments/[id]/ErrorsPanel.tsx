'use client';

import { useEffect, useState } from 'react';
import { Card, CardBody, CardHeader, Spinner, Select, Table, THead, TBody, TR, TH, TD } from '@/app/components/ui';
import { UpgradeNote } from '@/app/components/UpgradeNote';
import type { ErrorSummary } from '@/lib/jsErrors';

type Report = ErrorSummary & { range: number; from: string; to: string };

/** JavaScript errors per version (paid): did a version break something on the page? */
export function ErrorsPanel({ experimentId }: { experimentId: string }) {
    const [days, setDays] = useState(30);
    const [data, setData] = useState<Report | null>(null);
    const [state, setState] = useState<'loading' | 'locked' | 'error' | 'ready'>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        let live = true;
        fetch(`/api/experiments/${experimentId}/errors?days=${days}`)
            .then(async (r) => {
                const j = await r.json().catch(() => ({}));
                if (!live) return;
                if (r.status === 403) { setState('locked'); return; }
                if (!r.ok) { setMessage(j.error || 'Could not load errors'); setState('error'); return; }
                setData(j as Report); setState('ready');
            })
            .catch(() => { if (live) { setMessage('Could not load errors'); setState('error'); } });
        return () => { live = false; };
    }, [experimentId, days]);

    const rate = (n: number, of: number) => (of ? `${((n / of) * 100).toFixed(1)}` : '-');
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader
                    title="JavaScript errors"
                    description="Uncaught errors and failed promises on test pages, counted for the version each visitor sees. Use it to spot a version that breaks something."
                    actions={state === 'ready' && (
                        <Select aria-label="Range" value={String(days)} onChange={(e) => setDays(Number(e.target.value))} className="w-auto">
                            <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option>
                        </Select>
                    )}
                />
                {state === 'loading' && <CardBody><Spinner /></CardBody>}
                {state === 'locked' && <CardBody><UpgradeNote>JavaScript error tracking is part of the paid plans. Upgrade to Starter or above to see errors for each version of this test.</UpgradeNote></CardBody>}
                {state === 'error' && <CardBody><p className="text-sm text-red-600">{message}</p></CardBody>}
                {state === 'ready' && data && (
                    <Table data-testid="errors-by-version">
                        <THead><tr><TH>Version</TH><TH align="right">Visitors</TH><TH align="right">Pages with errors</TH><TH align="right">Errors</TH><TH align="right">Errors per 100 visitors</TH></tr></THead>
                        <TBody>
                            {data.variations.map((v) => (
                                <TR key={v.id}>
                                    <TD><span className="font-medium text-zinc-900">{v.name}</span>{v.is_control && <span className="ml-2 text-xs text-zinc-500">Control</span>}</TD>
                                    <TD numeric>{v.visitors.toLocaleString()}</TD>
                                    <TD numeric>{v.pages_with_errors.toLocaleString()}</TD>
                                    <TD numeric>{v.errors.toLocaleString()}</TD>
                                    <TD numeric>{rate(v.errors, v.visitors)}</TD>
                                </TR>
                            ))}
                        </TBody>
                    </Table>
                )}
            </Card>
            {state === 'ready' && data && (
                <Card>
                    <CardHeader title="Top errors" description={`Most frequent errors from ${data.from} to ${data.to} (UTC). Messages are shortened and personal details such as emails and long numbers are removed.`} />
                    {data.top.length === 0 ? <CardBody><p className="text-sm text-zinc-500">No errors in this period. Errors appear here within a minute of happening.</p></CardBody> : (
                        <Table data-testid="top-errors">
                            <THead><tr><TH>Error</TH>{data.variations.map((v) => <TH key={v.id} align="right">{v.name}</TH>)}<TH align="right">Last seen</TH></tr></THead>
                            <TBody>
                                {data.top.map((e) => (
                                    <TR key={e.fingerprint}>
                                        <TD>
                                            <span className="block max-w-[28rem] truncate font-medium text-zinc-900" title={e.message}>{e.kind === 'rejection' ? 'Promise: ' : ''}{e.message}</span>
                                            {e.source && <span className="block max-w-[28rem] truncate font-mono text-xs text-zinc-500" title={e.source}>{e.source}{e.line ? `:${e.line}` : ''}</span>}
                                            {e.fingerprint === '(other)' && <span className="block text-xs text-zinc-500">Errors past the first 200 different errors seen in a day</span>}
                                        </TD>
                                        {data.variations.map((v) => <TD key={v.id} numeric>{(e.by_variation[v.id] ?? 0).toLocaleString()}</TD>)}
                                        <TD numeric className="text-zinc-500">{e.last_seen}</TD>
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
