'use client';

import { useEffect, useState } from 'react';
import { PageHeader, Card, CardHeader, CardBody, Stat, Table, THead, TBody, TR, TH, TD } from '@/app/components/ui';
import { UpgradeNote } from '@/app/components/UpgradeNote';
import { OTHER_PAGES, TRAFFIC_MAX_PAGES_PER_DAY, type TrafficSummary } from '@/lib/traffic';

type Data = TrafficSummary & { environment: string; environments: { key: string; name: string }[]; range: number };
const selectClass = 'h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';
const DEVICE: Record<string, string> = { desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet' };

export default function TrafficPage() {
    const [days, setDays] = useState(30);
    const [env, setEnv] = useState('prod');
    const [state, setState] = useState<{ status: 'loading' | 'ok' | 'locked' | 'error'; data?: Data }>({ status: 'loading' });

    useEffect(() => {
        let live = true;
        fetch(`/api/traffic?days=${days}&environment=${env}`).then(async (res) => {
            if (!live) return;
            if (res.status === 403) return setState({ status: 'locked' });
            if (!res.ok) return setState({ status: 'error' });
            setState({ status: 'ok', data: await res.json() });
        }).catch(() => live && setState({ status: 'error' }));
        return () => { live = false; };
    }, [days, env]);

    const d = state.data;
    return (
        <div className="space-y-6">
            <PageHeader
                title="Traffic"
                description="Page views on every page that has the install snippet, for the selected environment."
                actions={state.status === 'ok' && d ? (
                    <div className="flex gap-2">
                        <select aria-label="Environment" className={selectClass} value={env} onChange={(e) => setEnv(e.target.value)}>
                            {d.environments.map((e) => <option key={e.key} value={e.key}>{e.name}</option>)}
                        </select>
                        <select aria-label="Date range" className={selectClass} value={days} onChange={(e) => setDays(Number(e.target.value))}>
                            <option value={7}>Last 7 days</option>
                            <option value={30}>Last 30 days</option>
                            <option value={90}>Last 90 days</option>
                        </select>
                    </div>
                ) : undefined}
            />
            {state.status === 'locked' && <UpgradeNote>The traffic overview is part of the paid plans. Upgrade to Starter or above to see page views, top pages, sources, devices and countries for your site.</UpgradeNote>}
            {state.status === 'error' && <p className="text-sm text-red-600">Could not load traffic. Try again in a moment.</p>}
            {state.status === 'ok' && d && (
                <>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Stat label="Page views" value={d.totals.views.toLocaleString()} />
                        <Stat label="Entrances" value={d.totals.entries.toLocaleString()} hint="Page views that came from another site or from no link" />
                        <Stat label="From new visitors" value={d.totals.views ? `${Math.round((d.totals.new_views / d.totals.views) * 100)}%` : '-'} hint="Share of page views in a visitor's first session" />
                    </div>
                    <Card>
                        <CardHeader title="Page views per day" description="Days are in UTC." />
                        <CardBody><DayChart days={d.days} /></CardBody>
                    </Card>
                    <div className="grid gap-6 lg:grid-cols-2">
                        <TopTable title="Top pages" head="Page" rows={d.pages.map((r) => (r.key === OTHER_PAGES ? { ...r, key: 'Other pages', hint: `Pages past the first ${TRAFFIC_MAX_PAGES_PER_DAY} different pages seen in a day` } : r))} total={d.totals.views} />
                        <TopTable title="Sources" head="Source" description="Where entrances came from: the utm_source value, the referring site, or direct." rows={d.sources} total={d.totals.entries} />
                        <TopTable title="Devices" head="Device" rows={d.devices.map((r) => ({ ...r, key: DEVICE[r.key] ?? r.key }))} total={d.totals.views} />
                        <TopTable title="Countries" head="Country" rows={d.countries} total={d.totals.views} />
                    </div>
                </>
            )}
        </div>
    );
}

function DayChart({ days }: { days: TrafficSummary['days'] }) {
    const max = Math.max(1, ...days.map((d) => d.views));
    if (!days.some((d) => d.views > 0)) return <p className="text-sm text-zinc-500">No page views yet. They appear here within a minute of the snippet loading on your pages.</p>;
    return (
        <div>
            <div className="flex h-40 items-end gap-[2px]" role="img" aria-label="Page views per day">
                {days.map((d) => (
                    <div key={d.day} className="group relative flex-1">
                        <div className="w-full rounded-t bg-gradient-to-t from-blue-600 to-teal-500" style={{ height: `${Math.max((d.views / max) * 160, d.views > 0 ? 2 : 0)}px` }} title={`${d.day}: ${d.views.toLocaleString()} page views`} />
                    </div>
                ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-zinc-500"><span>{days[0]?.day}</span><span>Peak {max.toLocaleString()} a day</span><span>{days[days.length - 1]?.day}</span></div>
        </div>
    );
}

function TopTable({ title, head, description, rows, total }: { title: string; head: string; description?: string; rows: { key: string; views: number; hint?: string }[]; total: number }) {
    return (
        <Card>
            <CardHeader title={title} description={description} />
            {rows.length === 0 ? <CardBody><p className="text-sm text-zinc-500">No data yet.</p></CardBody> : (
                <Table>
                    <THead><tr><TH>{head}</TH><TH align="right">Page views</TH><TH align="right">Share</TH></tr></THead>
                    <TBody>
                        {rows.map((r) => (
                            <TR key={r.key}>
                                <TD><span className="block max-w-[18rem] truncate font-medium text-zinc-900" title={r.hint ?? r.key}>{r.key}</span>{r.hint && <span className="block text-xs text-zinc-500">{r.hint}</span>}</TD>
                                <TD numeric>{r.views.toLocaleString()}</TD>
                                <TD numeric className="text-zinc-500">{total ? `${((r.views / total) * 100).toFixed(1)}%` : '-'}</TD>
                            </TR>
                        ))}
                    </TBody>
                </Table>
            )}
        </Card>
    );
}
