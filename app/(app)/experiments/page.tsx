import Link from 'next/link';
import type { Metadata } from 'next';
import { getAppContext } from '@/lib/appContext';
import { db } from '@/lib/db';
import { buildLiveStats, type LiveStats } from '@/lib/liveStats';
import { PageHeader, Card, Badge, Button, ButtonLink, StatusBadge, Table, THead, TBody, TR, TH, TD, EmptyState, Tabs, Input, Select } from '@/app/components/ui';
import { allTags, filterExperiments, parseTags } from '@/lib/experimentManage';
import { PlusIcon, FlaskIcon } from '@/app/components/shell/icons';

export const metadata: Metadata = { title: 'Experiments' };

const STATUSES = ['running', 'draft', 'paused', 'completed'] as const;
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-');

/** Builds a list URL that keeps the search and tag filters. */
function listHref(p: { status?: string; q?: string; tag?: string }): string {
    const sp = new URLSearchParams();
    if (p.status && p.status !== 'all') sp.set('status', p.status);
    if (p.q) sp.set('q', p.q);
    if (p.tag) sp.set('tag', p.tag);
    const qs = sp.toString();
    return qs ? `/experiments?${qs}` : '/experiments';
}

export default async function ExperimentsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; tag?: string }> }) {
    const ctx = (await getAppContext())!;
    const sp = await searchParams;
    const status = sp.status;
    const q = (sp.q ?? '').slice(0, 200);
    const tag = (sp.tag ?? '').slice(0, 30);
    const active = status === 'archived' || STATUSES.includes(status as (typeof STATUSES)[number]) ? (status as string) : 'all';
    const experiments = ctx.current ? await db.getExperiments([ctx.current.id]) : [];
    const tags = allTags(experiments);
    // Tab counts follow the search and tag filters; archived tests only show under Archived.
    const matching = filterExperiments(experiments, { q, tag });
    const archived = filterExperiments(experiments, { view: 'archived', q, tag });
    const shown = active === 'archived' ? archived : active === 'all' ? matching : matching.filter((e) => e.status === active);
    const filtered = !!(q || tag);
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
            <form method="get" action="/experiments" role="search" className="mb-4 flex flex-wrap items-center gap-2" data-testid="experiment-search">
                {active !== 'all' && <input type="hidden" name="status" value={active} />}
                <Input type="search" name="q" defaultValue={q} placeholder="Search by name, hypothesis or tag" aria-label="Search tests" className="max-w-xs" />
                {tags.length > 0 && (
                    <Select name="tag" defaultValue={tag} aria-label="Tag" className="w-auto">
                        <option value="">All tags</option>
                        {tags.map((t) => <option key={t} value={t}>{t}</option>)}
                    </Select>
                )}
                <Button type="submit" variant="secondary" size="sm">Search</Button>
                {filtered && <Link href={listHref({ status: active })} className="text-sm text-zinc-600 hover:underline">Clear</Link>}
            </form>
            <Tabs
                className="mb-4"
                active={active}
                items={[
                    { id: 'all', label: 'All', href: listHref({ q, tag }), count: matching.length },
                    ...STATUSES.map((s) => ({ id: s, label: s.charAt(0).toUpperCase() + s.slice(1), href: listHref({ status: s, q, tag }), count: matching.filter((e) => e.status === s).length })),
                    { id: 'archived', label: 'Archived', href: listHref({ status: 'archived', q, tag }), count: archived.length },
                ]}
            />
            <Card>
                {shown.length === 0 ? (
                    <EmptyState
                        icon={<FlaskIcon />}
                        title={filtered ? 'No tests match this search' : active === 'all' ? 'No experiments yet' : `No ${active} experiments`}
                        description={filtered ? undefined : active === 'all' ? 'Create an experiment to compare a control with one or more variants.' : active === 'archived' ? 'Archive a completed or paused test from its page to move it here. Its results stay available.' : undefined}
                        action={active === 'all' && !filtered && <ButtonLink href="/experiments/new" size="sm"><PlusIcon />New experiment</ButtonLink>}
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
                                        {parseTags(e.tags).length > 0 && (
                                            <span className="mt-1 flex flex-wrap gap-1" data-testid="experiment-tags">
                                                {parseTags(e.tags).map((t) => <Link key={t} href={listHref({ status: active, q, tag: t })}><Badge>{t}</Badge></Link>)}
                                            </span>
                                        )}
                                    </TD>
                                    <TD><span className="flex flex-wrap items-center gap-1"><StatusBadge status={e.status} />{e.archived_at && <Badge>Archived</Badge>}</span></TD>
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
