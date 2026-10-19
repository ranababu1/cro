'use client';
import { ProfileRequired } from '@/app/components/profile/ProfileRequired';
import { PROFILE_REQUIRED_MESSAGE } from '@/lib/profile';

import { GOAL_TYPE_LABELS, describeGoal, type GoalType } from '@/lib/goals';
import { describeTargeting, parseTargeting } from '@/lib/targeting';
import { describePageRule, parsePages } from '@/lib/multipage';
import { EditTest } from './EditTest';
import { ShareResults } from './ShareResults';
import { HeatmapsPanel } from './HeatmapsPanel';
import { ErrorsPanel } from './ErrorsPanel';
import { FunnelsPanel } from './FunnelsPanel';
import { RevenuePanel } from './RevenuePanel';
import { SegmentsPanel } from './SegmentsPanel';
import { RolloutCard } from './RolloutCard';
import { ScheduleCard } from './ScheduleCard';
import { PreviewLinks } from './PreviewLinks';
import { FactorEffects } from './FactorEffects';
import { SrmWarning } from '@/app/components/SrmWarning';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Experiment, Variation, ExperimentResults } from '@/lib/types';
import {
    PageHeader, Card, CardHeader, CardBody, Button, ButtonLink, StatusBadge, Badge, Tabs, Table, THead, TBody, TR, TH, TD,
    Alert, Spinner, Field, Input, Textarea, Stat, EmptyState, Kbd,
} from '@/app/components/ui';
import { IntervalChart } from './IntervalChart';
import { LiveStats } from './LiveStats';
import { InstallSnippet } from '@/app/components/InstallSnippet';
import { formatChance } from '@/lib/sequential';

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-');
const pct = (v: number, digits = 2) => `${(v * 100).toFixed(digits)}%`;


export default function ExperimentDetail() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [experiment, setExperiment] = useState<Experiment | null>(null);
    const [variations, setVariations] = useState<Variation[]>([]);
    const [goals, setGoals] = useState<{ id: string; name: string; type?: string; selector: string; match_type?: string | null; is_primary: boolean }[]>([]);
    const [results, setResults] = useState<ExperimentResults | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [tab, setTab] = useState('results');
    const [busy, setBusy] = useState(false);
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/experiments/${id}`);
            if (!res.ok) throw new Error(res.status === 404 ? 'Experiment not found' : 'Could not load the experiment');
            const data = await res.json();
            setExperiment(data.experiment);
            setVariations(data.variations);
            setGoals(data.goals || []);
            if (data.experiment.status !== 'draft') {
                const r = await fetch(`/api/experiments/${id}/results`);
                if (r.ok) { setResults(await r.json()); setUpdatedAt(new Date()); }
            } else {
                setResults(null);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        // Fetch on mount; state updates happen after the request resolves.
        void load();
    }, [load]);

    useEffect(() => {
        // Live refresh while the test is running.
        if (experiment?.status !== 'running') return;
        const timer = setInterval(async () => {
            if (document.hidden) return;
            const r = await fetch(`/api/experiments/${id}/results`).catch(() => null);
            if (r?.ok) { setResults(await r.json()); setUpdatedAt(new Date()); }
        }, 30_000);
        return () => clearInterval(timer);
    }, [experiment?.status, id]);

    useEffect(() => {
        // Drafts have no results, so open on setup.
        if (experiment?.status === 'draft') setTab((t) => (t === 'results' ? 'setup' : t));
    }, [experiment?.status]);

    const patch = async (body: Record<string, unknown>, okMessage: string) => {
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const res = await fetch(`/api/experiments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Update failed');
            setNotice(okMessage);
            await load();
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!confirm('Delete this draft experiment? This cannot be undone.')) return;
        const res = await fetch(`/api/experiments/${id}`, { method: 'DELETE' });
        if (!res.ok) return setError((await res.json()).error || 'Delete failed');
        router.push('/experiments');
        router.refresh();
    };

    if (loading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
    if (!experiment) {
        return (
            <Card><EmptyState title={error || 'Experiment not found'} action={<ButtonLink href="/experiments" variant="secondary" size="sm">Back to experiments</ButtonLink>} /></Card>
        );
    }

    const s = experiment.status;
    const actions = (
        <>
            {s === 'draft' && <><Button variant="danger" onClick={remove} disabled={busy}>Delete</Button><Button onClick={() => patch({ status: 'running' }, 'Experiment started.')} disabled={busy}>Start experiment</Button></>}
            {s === 'running' && <><Button variant="secondary" onClick={() => patch({ status: 'paused' }, 'Experiment paused.')} disabled={busy}>Pause</Button><Button variant="secondary" onClick={() => confirm('Stop this experiment? It cannot be restarted.') && patch({ status: 'completed' }, 'Experiment stopped.')} disabled={busy}>Stop</Button></>}
            {s === 'paused' && <><Button variant="secondary" onClick={() => confirm('Stop this experiment? It cannot be restarted.') && patch({ status: 'completed' }, 'Experiment stopped.')} disabled={busy}>Stop</Button><Button onClick={() => patch({ status: 'running' }, 'Experiment resumed.')} disabled={busy}>Resume</Button></>}
        </>
    );

    return (
        <>
            <PageHeader
                breadcrumb={<Link href="/experiments" className="hover:text-zinc-900">Experiments</Link>}
                title={<span className="flex flex-wrap items-center gap-3">{experiment.name}<StatusBadge status={s} /></span>}
                description={experiment.description || undefined}
                actions={actions}
            />
            {error && (error === PROFILE_REQUIRED_MESSAGE ? <ProfileRequired next={`/experiments/${id}`} className="mb-4" /> : <Alert tone="danger" className="mb-4">{error}</Alert>)}
            {notice && <Alert tone="success" className="mb-4">{notice}</Alert>}

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Traffic allocation" value={`${experiment.traffic_allocation}%`} />
                <Stat label="Variations" value={variations.length} />
                <Stat label="Started" value={fmtDate(experiment.started_at)} />
                <Stat label={experiment.ended_at ? 'Ended' : 'Created'} value={fmtDate(experiment.ended_at ?? experiment.created_at)} />
            </div>

            <Tabs
                className="mb-6"
                active={tab}
                onChange={setTab}
                items={[
                    { id: 'results', label: 'Results' },
                    { id: 'setup', label: 'Setup' },
                    { id: 'heatmaps', label: 'Heatmaps' },
                    { id: 'errors', label: 'Errors' },
                    ...(experiment.status !== 'completed' ? [{ id: 'edit', label: 'Edit test' }] : []),
                    { id: 'settings', label: 'Settings' },
                ]}
            />

            {tab === 'results' && experiment.status !== 'draft' && variations.length > 0 && <div className="mb-6"><RolloutCard key={`${experiment.rollout_variation_id ?? ''}${experiment.updated_at}`} experiment={experiment} variations={variations} winnerId={results?.winner} onChanged={() => { void load(); router.refresh(); }} /></div>}
            {tab === 'results' && <ResultsPanel experiment={experiment} variations={variations} results={results} updatedAt={updatedAt} hasEventGoals={goals.some((g) => g.type === 'event')} />}
            {tab === 'results' && experiment.status !== 'draft' && <div className="mt-6"><ShareResults experimentId={experiment.id} /></div>}
            {tab === 'heatmaps' && <HeatmapsPanel experimentId={experiment.id} />}
            {tab === 'errors' && <ErrorsPanel experimentId={experiment.id} />}
            {tab === 'setup' && <SetupPanel experimentId={experiment.id} completed={experiment.status === 'completed'} variations={variations} goals={goals} targeting={experiment.targeting} pages={experiment.pages} controlUrl={experiment.control_url} />}
            {tab === 'edit' && <EditTest key={experiment.updated_at} experimentId={experiment.id} variations={variations} goals={goals} targeting={experiment.targeting} autoShift={!!experiment.auto_shift} status={experiment.status} mvt={experiment.mvt} onSaved={() => void load()} />}
            {tab === 'settings' && experiment.status !== 'completed' && <div className="mb-6"><ScheduleCard experimentId={experiment.id} status={experiment.status} traffic={experiment.traffic_allocation} onSaved={() => void load()} /></div>}
            {tab === 'settings' && <SettingsPanel experiment={experiment} busy={busy} onSave={(b) => patch(b, 'Changes saved.')} onDelete={remove} />}
        </>
    );
}

function ResultsPanel({ experiment, variations, results, updatedAt, hasEventGoals }: { experiment: Experiment; variations: Variation[]; results: ExperimentResults | null; updatedAt: Date | null; hasEventGoals: boolean }) {
    const goalList = results?.goals || [];
    const primaryGoalId = goalList.find((g) => g.is_primary)?.goal_id || goalList[0]?.goal_id || '';
    const [goalId, setGoalId] = useState<string | null>(null);
    const selectedGoalId = goalId || primaryGoalId;

    if (experiment.status === 'draft') {
        return <Card><EmptyState title="No results yet" description="Results appear once the experiment is started and visitors are assigned." /></Card>;
    }
    if (!results) return <Card><EmptyState title="Results are not available" /></Card>;

    const activeGoal = goalList.find((g) => g.goal_id === selectedGoalId) || goalList[0];
    const sourceVariations = activeGoal?.variations || results.variations;
    const rows = [...sourceVariations].sort((a, b) => Number(b.is_control) - Number(a.is_control));
    const control = rows.find((v) => v.is_control);
    const seq = activeGoal ? activeGoal.sequential : results.sequential;
    const winnerId = activeGoal ? activeGoal.winner : results.winner;
    const winner = sourceVariations.find((v) => v.variation_id === winnerId);
    const perArmMin = Math.min(...sourceVariations.map((v) => v.total_users));
    const bar = seq ? `${+(seq.threshold * 100).toFixed(2)}%` : '5%';

    let summary: React.ReactNode;
    if (perArmMin < 100) {
        summary = <Alert tone="neutral" title="Collecting data">Each variation needs at least 100 visitors before significance is tested. The smallest has {perArmMin.toLocaleString()}.</Alert>;
    } else if (winner && seq) {
        summary = <Alert tone="success" title={`${winner.variation_name} is outperforming the control`}>The sequential test is significant (p = {(winner.sequential_p_value ?? seq.p_value).toFixed(4)}, below {bar}), with a {formatChance(winner.chance_to_beat_control, control?.total_users ?? 0, winner.total_users)} chance to beat the control. This result holds however often you checked.</Alert>;
    } else if (seq?.control_ahead) {
        summary = <Alert tone="warning" title="The control is outperforming every variant">Every variant converts significantly worse than the control on the sequential test. Consider stopping the experiment.</Alert>;
    } else if (seq) {
        summary = <Alert tone="neutral" title="No significant difference yet">The best variant compared with the control gives a sequential p = {seq.p_value.toFixed(4)} (it needs to be below {bar}). You can keep checking: the verdict stays valid however often you look.</Alert>;
    }

    return (
        <div className="space-y-6">
            <SrmWarning srm={results.srm} />
            {results.live && <LiveStats live={results.live} running={experiment.status === 'running'} updatedAt={updatedAt} />}
            <h2 className="pt-2 text-base font-semibold text-zinc-900">Detailed results</h2>
            {summary}
            {goalList.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {goalList.map((g) => (
                        <button key={g.goal_id} type="button" onClick={() => setGoalId(g.goal_id)} className={`rounded-full px-3 py-1 text-sm font-medium ${g.goal_id === activeGoal?.goal_id ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-700'}`}>
                            {g.goal_name}{g.is_primary ? ' · Primary' : ''}
                        </button>
                    ))}
                </div>
            )}
            <Card>
                <CardHeader
                    title="Conversion rate by variation"
                    description="Unique visitors who converted, divided by unique visitors assigned."
                    actions={<a href={`/api/experiments/${experiment.id}/results/export`} download className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100" data-testid="results-csv">Download CSV</a>}
                />
                <Table>
                    <THead>
                        <tr><TH>Variation</TH><TH align="right">Visitors</TH><TH align="right">Conversions</TH><TH align="right">Conversion rate</TH><TH align="right">Lift vs control</TH><TH align="right">95% interval</TH><TH align="right">Chance to beat control</TH></tr>
                    </THead>
                    <TBody>
                        {rows.map((v) => {
                            const lift = control && !v.is_control && control.conversion_rate > 0 ? (v.conversion_rate - control.conversion_rate) / control.conversion_rate : null;
                            return (
                                <TR key={v.variation_id}>
                                    <TD>
                                        <span className="flex items-center gap-2 font-medium text-zinc-900">
                                            {v.variation_name}
                                            {v.is_control && <Badge>Control</Badge>}
                                            {v.variation_id === winnerId && <Badge tone="success">Leading</Badge>}
                                        </span>
                                    </TD>
                                    <TD numeric>{v.total_users.toLocaleString()}</TD>
                                    <TD numeric>{v.conversions.toLocaleString()}</TD>
                                    <TD numeric><span className="font-medium text-zinc-900">{pct(v.conversion_rate)}</span></TD>
                                    <TD numeric>
                                        <span className={lift === null ? 'text-zinc-400' : lift > 0 ? 'text-emerald-700' : lift < 0 ? 'text-red-700' : ''}>
                                            {lift === null ? '-' : `${lift > 0 ? '+' : ''}${(lift * 100).toFixed(1)}%`}
                                        </span>
                                    </TD>
                                    <TD numeric className="text-zinc-500">{v.confidence_interval ? `${pct(v.confidence_interval.lower)} to ${pct(v.confidence_interval.upper)}` : '-'}</TD>
                                    <TD numeric>{v.is_control ? <span className="text-zinc-400">-</span> : formatChance(v.chance_to_beat_control, control?.total_users ?? 0, v.total_users)}</TD>
                                </TR>
                            );
                        })}
                    </TBody>
                </Table>
            </Card>
            <FactorEffects mvt={experiment.mvt} variations={variations} rows={rows} />
            <Card>
                <CardHeader title="Confidence intervals" />
                <CardBody><IntervalChart rows={rows} winner={winnerId} /></CardBody>
            </Card>
            {experiment.auto_shift && (
                <p className="text-sm text-zinc-600" data-testid="auto-shift-note">Auto-shift is on, so the split changes over time, which can bias the comparison. Treat the significance verdict as a guide and keep the test running until the leader stays clear.</p>
            )}
            <p className="text-xs text-zinc-500">
                Method: sequential test of each variant against the control (safe to check at any time, 5% split across {seq?.comparisons ?? 1} {seq?.comparisons === 1 ? 'comparison' : 'comparisons'}), chance to beat control from Beta posteriors, Wilson score intervals. Sample size: {results.sample_size.toLocaleString()} visitors.
            </p>
            <SegmentsPanel experimentId={experiment.id} />
            <RevenuePanel experimentId={experiment.id} hasEventGoals={hasEventGoals} />
            <FunnelsPanel experimentId={experiment.id} goals={goalList.map((g) => ({ goal_id: g.goal_id, goal_name: g.goal_name }))} />
        </div>
    );
}

function SetupPanel({ experimentId, completed, variations, goals, targeting, pages, controlUrl }: { pages?: string | null; controlUrl?: string | null; targeting?: string | null; experimentId: string; completed: boolean; variations: Variation[]; goals: { id: string; name: string; type?: string; selector: string; match_type?: string | null; is_primary: boolean }[] }) {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader title="Who can enter" description="Checked before a new visitor joins. People already in the test keep their version." />
                <CardBody className="text-sm text-zinc-700">{describeTargeting(parseTargeting(targeting))}</CardBody>
            </Card>
            {parsePages(pages).length > 0 && (
                <Card data-testid="setup-pages">
                    <CardHeader title="Pages in this test" description="Visual changes apply on the control page and on every page that matches a rule." />
                    <CardBody className="space-y-1 text-sm text-zinc-700">
                        {controlUrl && <p>Control page: {controlUrl}</p>}
                        {parsePages(pages).map((r, i) => <p key={i}>{describePageRule(r)}</p>)}
                    </CardBody>
                </Card>
            )}
            <Card>
                <CardHeader title="Variations" description="Weights split the visitors who enter the experiment." />
                <Table>
                    <THead><tr><TH>Name</TH><TH>Page</TH><TH align="right">Weight</TH></tr></THead>
                    <TBody>
                        {variations.map((v) => (
                            <TR key={v.id}>
                                <TD>
                                    <span className="flex items-center gap-2 font-medium text-zinc-900">{v.name}{v.is_control && <Badge>Control</Badge>}{v.paused && <Badge tone="warning">Paused</Badge>}</span>
                                    {v.description && <p className="text-xs text-zinc-500">{v.description}</p>}
                                </TD>
                                <TD className="max-w-xs truncate">{v.url ? <a href={v.url} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">{v.url}</a> : !v.is_control ? <span className="text-zinc-600">Same page, visual changes</span> : <span className="text-zinc-400">None</span>}</TD>
                                <TD numeric>{v.weight}%</TD>
                            </TR>
                        ))}
                    </TBody>
                </Table>
            </Card>
            <PreviewLinks experimentId={experimentId} variations={variations} completed={completed} />
            {goals.length > 0 && (
            <Card>
                <CardHeader title="Goals" description="What counts as a conversion in this test." />
                <Table>
                    <THead><tr><TH>Name</TH><TH>Target</TH><TH>Primary</TH></tr></THead>
                    <TBody>{goals.map((g) => (
                        <TR key={g.id}><TD className="font-medium">{g.name}</TD><TD><span className="mr-2 text-xs text-zinc-500">{GOAL_TYPE_LABELS[(g.type || 'click') as GoalType]}</span><Kbd>{describeGoal(g)}</Kbd></TD><TD>{g.is_primary ? 'Yes' : ''}</TD></TR>
                    ))}</TBody>
                </Table>
            </Card>
            )}
            <Card>
                <CardHeader title="Install" description="One line in the head of the control and every variation page. Your public SDK key is already filled in." />
                <CardBody>
                    <InstallSnippet />
                </CardBody>
            </Card>
        </div>
    );
}

function SettingsPanel({ experiment, busy, onSave, onDelete }: { experiment: Experiment; busy: boolean; onSave: (b: Record<string, unknown>) => void; onDelete: () => void }) {
    const [name, setName] = useState(experiment.name);
    const [description, setDescription] = useState(experiment.description ?? '');
    const [traffic, setTraffic] = useState(experiment.traffic_allocation);
    const locked = experiment.status === 'completed';
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader title="General" description={locked ? 'Completed experiments are read only.' : undefined} />
                <CardBody>
                    <form
                        className="space-y-5"
                        onSubmit={(e) => {
                            e.preventDefault();
                            onSave({ name, description, traffic_allocation: traffic });
                        }}
                    >
                        <Field label="Name">{(id) => <Input id={id} required value={name} disabled={locked} onChange={(e) => setName(e.target.value)} />}</Field>
                        <Field label="Hypothesis or description">{(id) => <Textarea id={id} rows={3} value={description} disabled={locked} onChange={(e) => setDescription(e.target.value)} />}</Field>
                        <Field
                            label={`Traffic allocation: ${traffic}%`}
                            hint={experiment.status === 'running' ? 'Raising allocation keeps existing visitors in their variation. Lowering it removes some visitors from the experiment.' : undefined}
                        >
                            {(id) => <input id={id} type="range" min={0} max={100} step={5} value={traffic} disabled={locked} onChange={(e) => setTraffic(Number(e.target.value))} className="w-full accent-brand-600" />}
                        </Field>
                        <div className="flex justify-end"><Button type="submit" disabled={busy || locked}>Save changes</Button></div>
                    </form>
                </CardBody>
            </Card>
            {experiment.status === 'draft' && (
                <Card className="border-red-200">
                    <CardHeader title="Delete experiment" description="Only drafts can be deleted. Started experiments are kept for their history." actions={<Button variant="danger" onClick={onDelete}>Delete draft</Button>} />
                </Card>
            )}
        </div>
    );
}
