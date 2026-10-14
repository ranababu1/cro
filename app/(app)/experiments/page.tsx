import Link from 'next/link';
import type { Metadata } from 'next';
import { getAppContext } from '@/lib/appContext';
import { db } from '@/lib/db';
import { buildLiveStats, type LiveStats } from '@/lib/liveStats';
import { PageHeader, Card, Badge, ButtonLink, StatusBadge, Table, THead, TBody, TR, TH, TD, EmptyState, Tabs } from '@/app/components/ui';
import { PlusIcon, FlaskIcon } from '@/app/components/shell/icons';

export const metadata: Metadata = { title: 'Experiments' };

const STATUSES = ['running', 'draft', 'paused', 'completed'] as const;
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-');

export default async function ExperimentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
    const ctx = (await getAppContext())!;
    const { status } = await searchParams;
    const active = STATUSES.includes(status as (typeof STATUSES)[number]) ? (status as string) : 'all';
    const experiments = ctx.current ? await db.getExperiments([ctx.current.id]) : [];
    const shown = active === 'all' ? experiments : experiments.filter((e) => e.status === active);
    const live = new Map<string, LiveStats>();
    await Promise.all(shown.filter((e) => e.status !== 'draft').map(async (e) => {
        const [variations, goals, counts] = await Promise.all([db.getVariations(e.id), db.getGoals(e.id), db.getLiveCounts(e.id)]);
        live.set(e.id, buildLiveStats(variations, goals, counts));
    }));
    const tone = { ahead: 'success', behind: 'warning', early: 'neutral' } as const;

    return (
        <>
            <PageHeader
                title="Experiments"
                description="Every experiment in this project."
                actions={<ButtonLink href="/experiments/new"><PlusIcon />New experiment</ButtonLink>}
            />
            <Tabs
                className="mb-4"
                active={active}
                items={[
                    { id: 'all', label: 'All', href: '/experiments', count: experiments.length },
                    ...STATUSES.map((s) => ({ id: s, label: s.charAt(0).toUpperCase() + s.slice(1), href: `/experiments?status=${s}`, count: experiments.filter((e) => e.status === s).length })),
                ]}
            />
            <Card>
                {shown.length === 0 ? (
                    <EmptyState
                        icon={<FlaskIcon />}
                        title={active === 'all' ? 'No experiments yet' : `No ${active} experiments`}
                        description={active === 'all' ? 'Create an experiment to compare a control with one or more variants.' : undefined}
                        action={active === 'all' && <ButtonLink href="/experiments/new" size="sm"><PlusIcon />New experiment</ButtonLink>}
                    />
                ) : (
                    <Table>
                        <THead>
                            <tr><TH>Name</TH><TH>Status</TH><TH align="right">Visitors</TH><TH align="right">Goal clicks</TH><TH>Result so far</TH><TH align="right">Traffic</TH><TH align="right">Created</TH><TH align="right">Started</TH><TH align="right">Ended</TH></tr>
                        </THead>
                        <TBody>
                            {shown.map((e) => (
                                <TR key={e.id}>
                                    <TD className="max-w-xs">
                                        <Link href={`/experiments/${e.id}`} className="font-medium text-zinc-900 hover:underline">{e.name}</Link>
                                        {e.description && <p className="truncate text-xs text-zinc-500">{e.description}</p>}
                                    </TD>
                                    <TD><StatusBadge status={e.status} /></TD>
                                    <TD numeric>{live.get(e.id)?.total_visitors.toLocaleString() ?? '-'}</TD>
                                    <TD numeric>{live.get(e.id)?.total_clicks.toLocaleString() ?? '-'}</TD>
                                    <TD>{live.get(e.id) ? <Badge className="whitespace-nowrap" tone={tone[live.get(e.id)!.headline.tone]}>{live.get(e.id)!.headline.status}</Badge> : <span className="text-zinc-400">-</span>}</TD>
                                    <TD numeric>{e.traffic_allocation}%</TD>
                                    <TD numeric>{date(e.created_at)}</TD>
                                    <TD numeric>{date(e.started_at)}</TD>
                                    <TD numeric>{date(e.ended_at)}</TD>
                                </TR>
                            ))}
                        </TBody>
                    </Table>
                )}
            </Card>
        </>
    );
}
