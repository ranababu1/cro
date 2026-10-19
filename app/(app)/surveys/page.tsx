'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader, Card, CardHeader, CardBody, Table, THead, TBody, TR, TH, TD, Button, Input, Select, Field, StatusBadge, Alert, EmptyState } from '@/app/components/ui';
import { UpgradeNote } from '@/app/components/UpgradeNote';
import { DisplayRuleFields, rulesText } from '../popups/DisplayRules';
import { SURVEY_TEMPLATES, type NpsSummary, type SurveyConfig, type SurveyStats } from '@/lib/surveys';

interface Survey { id: string; name: string; status: 'draft' | 'active' | 'paused'; config: SurveyConfig | null; stats: SurveyStats }
interface Data { surveys: Survey[]; max: number }
interface Results {
    range: number;
    stats: SurveyStats;
    answers: { total: number; breakdown: Array<{ answer: string; count: number; share: number }>; average: number | null; nps: NpsSummary | null };
    recent: Array<{ created_at: string; answer: string; comment: string | null; path: string }>;
}

const BLANK: SurveyConfig = {
    question: 'What almost stopped you from signing up today?', type: 'choice', options: ['The price', 'Not sure it fits my site', 'Missing a feature', 'Nothing, it was easy'],
    comment: true, comment_label: 'Anything else you want to tell us?', button_text: 'Send', thanks: 'Thanks for your answer!',
    position: 'bottom-right', color: '#2563eb', trigger: 'delay', trigger_value: 10, frequency: 'once', device: 'all', match: 'all', match_value: '',
};
const TYPE: Record<SurveyConfig['type'], string> = { choice: 'Pick one answer', rating: 'Rating from 1 to 5', nps: 'Net Promoter Score (0 to 10)', text: 'Short written answer' };
const POSITION: Record<SurveyConfig['position'], string> = { 'bottom-right': 'Bottom right corner', 'bottom-left': 'Bottom left corner', center: 'Center of the page' };
const pct = (n: number | null) => (n === null ? '-' : `${(n * 100).toFixed(1)}%`);

export default function SurveysPage() {
    const [state, setState] = useState<{ status: 'loading' | 'ok' | 'locked' | 'error'; data?: Data }>({ status: 'loading' });
    const [editing, setEditing] = useState<{ id: string | null; name: string; config: SurveyConfig } | null>(null);
    const [viewing, setViewing] = useState<Survey | null>(null);
    const [tick, setTick] = useState(0);
    const reload = useCallback(() => setTick((t) => t + 1), []);

    useEffect(() => {
        let live = true;
        fetch('/api/surveys').then(async (res) => {
            if (!live) return;
            if (res.status === 403) return setState({ status: 'locked' });
            if (!res.ok) return setState({ status: 'error' });
            setState({ status: 'ok', data: await res.json() });
        }).catch(() => live && setState({ status: 'error' }));
        return () => { live = false; };
    }, [tick]);

    const patch = async (id: string, body: object) => {
        await fetch(`/api/surveys/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        reload();
    };
    const remove = async (p: Survey) => {
        if (!window.confirm(`Delete "${p.name}" and all its answers?`)) return;
        await fetch(`/api/surveys/${p.id}`, { method: 'DELETE' });
        reload();
    };

    const d = state.data;
    const full = !!d && d.surveys.length >= d.max;
    const idle = !editing && !viewing;
    return (
        <div className="space-y-6">
            <PageHeader
                title="Surveys"
                description="Ask visitors one question on the pages you choose: pick an answer, a rating, a Net Promoter Score or a short written answer. Works on any page with the install snippet."
                actions={state.status === 'ok' && idle ? <Button onClick={() => setEditing({ id: null, name: 'Signup feedback', config: BLANK })} disabled={full}>New survey</Button> : undefined}
            />
            {state.status === 'locked' && <UpgradeNote>Surveys are part of the paid plans. Upgrade to Starter or above to ask visitors a question on your site and see their answers.</UpgradeNote>}
            {state.status === 'error' && <p className="text-sm text-red-600">Could not load surveys. Try again in a moment.</p>}
            {editing && <Editor key={editing.id ?? 'new'} initial={editing} onDone={() => { setEditing(null); reload(); }} />}
            {viewing && <ResultsView survey={viewing} onBack={() => { setViewing(null); reload(); }} />}
            {state.status === 'ok' && d && idle && (
                <Card>
                    <CardHeader title="Your surveys" description={`Numbers are for the last 30 days. Up to ${d.max} surveys per project.`} />
                    {d.surveys.length === 0 ? (
                        <EmptyState title="No surveys yet" description="Create one, check the preview, then turn it on." />
                    ) : (
                        <Table>
                            <THead><TR><TH>Name</TH><TH>Status</TH><TH>Shows</TH><TH className="text-right">Views</TH><TH className="text-right">Answers</TH><TH className="text-right">Answer rate</TH><TH /></TR></THead>
                            <TBody>
                                {d.surveys.map((p) => (
                                    <TR key={p.id}>
                                        <TD className="font-medium">{p.name}</TD>
                                        <TD><StatusBadge status={p.status} /></TD>
                                        <TD className="text-sm text-zinc-600">{p.config ? rulesText(p.config) : '-'}</TD>
                                        <TD className="text-right tabular-nums">{p.stats.views.toLocaleString()}</TD>
                                        <TD className="text-right tabular-nums">{p.stats.responses.toLocaleString()}</TD>
                                        <TD className="text-right tabular-nums">{pct(p.stats.rate)}</TD>
                                        <TD className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="secondary" onClick={() => setViewing(p)}>Answers</Button>
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

function ResultsView({ survey, onBack }: { survey: Survey; onBack: () => void }) {
    const [days, setDays] = useState(30);
    const [state, setState] = useState<{ status: 'loading' | 'ok' | 'error'; data?: Results }>({ status: 'loading' });
    useEffect(() => {
        let live = true;
        fetch(`/api/surveys/${survey.id}?days=${days}`).then(async (res) => {
            if (!live) return;
            if (!res.ok) return setState({ status: 'error' });
            setState({ status: 'ok', data: await res.json() });
        }).catch(() => live && setState({ status: 'error' }));
        return () => { live = false; };
    }, [survey.id, days]);
    const r = state.data;
    const c = survey.config;
    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={onBack}>Back to surveys</Button>
                <div className="w-40">
                    <Select aria-label="Date range" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                        <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
                    </Select>
                </div>
                <a className="ml-auto text-sm font-medium text-blue-700 hover:underline" href={`/api/surveys/${survey.id}/export?days=${days}`}>Download answers (CSV)</a>
            </div>
            {state.status === 'error' && <p className="text-sm text-red-600">Could not load the answers. Try again in a moment.</p>}
            {r && c && (
                <Card>
                    <CardHeader title={c.question} description={`${survey.name}. ${r.stats.views.toLocaleString()} views, ${r.stats.responses.toLocaleString()} answers (${pct(r.stats.rate)}).${r.answers.average !== null ? ` Average rating ${r.answers.average.toFixed(2)} of 5.` : ''}`} />
                    <CardBody className="space-y-3">
                        {r.answers.total === 0 && <p className="text-sm text-zinc-500">No answers in this period yet.</p>}
                        {r.answers.nps && <NpsCard nps={r.answers.nps} />}
                        {r.answers.breakdown.map((b) => (
                            <div key={b.answer}>
                                <div className="mb-1 flex justify-between text-sm"><span className="text-zinc-800">{c.type === 'rating' ? `${b.answer} of 5` : c.type === 'nps' ? `${b.answer} of 10` : b.answer}</span><span className="tabular-nums text-zinc-600">{b.count.toLocaleString()} ({pct(b.share)})</span></div>
                                <div className="h-2 rounded bg-zinc-100"><div className="h-2 rounded bg-gradient-to-r from-blue-600 to-teal-500" style={{ width: `${b.share * 100}%` }} /></div>
                            </div>
                        ))}
                        {r.stats.responses > r.answers.total && <p className="text-xs text-zinc-500">The answer total counts every answer. Up to 500 answers per survey per day are kept for the breakdown and the download.</p>}
                    </CardBody>
                </Card>
            )}
            {r && c && r.recent.length > 0 && (
                <Card>
                    <CardHeader title={c.type === 'text' ? 'Latest answers' : 'Latest comments'} description="Newest first, up to 50. Download the CSV for all of them." />
                    <Table>
                        <THead><TR><TH>Time (UTC)</TH>{c.type !== 'text' && <TH>Answer</TH>}<TH>{c.type === 'text' ? 'Answer' : 'Comment'}</TH><TH>Page</TH></TR></THead>
                        <TBody>
                            {r.recent.map((x, i) => (
                                <TR key={i}>
                                    <TD className="whitespace-nowrap text-sm text-zinc-600">{x.created_at.slice(0, 16).replace('T', ' ')}</TD>
                                    {c.type !== 'text' && <TD className="text-sm">{x.answer}</TD>}
                                    <TD className="text-sm whitespace-pre-line">{c.type === 'text' ? x.answer : x.comment}</TD>
                                    <TD className="text-sm text-zinc-600">{x.path || '-'}</TD>
                                </TR>
                            ))}
                        </TBody>
                    </Table>
                </Card>
            )}
        </div>
    );
}

function NpsCard({ nps }: { nps: NpsSummary }) {
    const total = nps.promoters + nps.passives + nps.detractors;
    const part = (n: number) => `${Math.round((n / total) * 100)}%`;
    return (
        <div data-testid="nps-score" className="mb-2 grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 p-3"><p className="text-xs text-zinc-500">Net Promoter Score</p><p className="text-2xl font-semibold tabular-nums text-zinc-900">{nps.score > 0 ? `+${nps.score}` : nps.score}</p></div>
            <div className="rounded-lg border border-zinc-200 p-3"><p className="text-xs text-zinc-500">Promoters (9 to 10)</p><p className="text-lg font-semibold tabular-nums text-emerald-700">{part(nps.promoters)}</p></div>
            <div className="rounded-lg border border-zinc-200 p-3"><p className="text-xs text-zinc-500">Passives (7 to 8)</p><p className="text-lg font-semibold tabular-nums text-zinc-700">{part(nps.passives)}</p></div>
            <div className="rounded-lg border border-zinc-200 p-3"><p className="text-xs text-zinc-500">Detractors (0 to 6)</p><p className="text-lg font-semibold tabular-nums text-red-700">{part(nps.detractors)}</p></div>
        </div>
    );
}

function Editor({ initial, onDone }: { initial: { id: string | null; name: string; config: SurveyConfig }; onDone: () => void }) {
    const [name, setName] = useState(initial.name);
    const [c, setC] = useState<SurveyConfig>(initial.config);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const set = <K extends keyof SurveyConfig>(k: K, v: SurveyConfig[K]) => setC((x) => ({ ...x, [k]: v }));
    const setOption = (i: number, v: string) => set('options', c.options.map((o, j) => (j === i ? v : o)));

    const save = async () => {
        setSaving(true);
        setError('');
        const config = { ...c, options: c.type === 'choice' ? c.options.map((o) => o.trim()).filter(Boolean) : [] };
        const res = await fetch(initial.id ? `/api/surveys/${initial.id}` : '/api/surveys', {
            method: initial.id ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, config }),
        }).catch(() => null);
        setSaving(false);
        if (!res || !res.ok) return setError((await res?.json().catch(() => null))?.error ?? 'Could not save the survey.');
        onDone();
    };

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <Card>
                <CardHeader title={initial.id ? 'Edit survey' : 'New survey'} description={initial.id ? 'Changes reach your site within a minute.' : 'New surveys start as drafts. Turn them on from the list.'} />
                <CardBody className="space-y-4">
                    <Field label="Name" hint="Only you see this.">{(id) => <Input id={id} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />}</Field>
                    {!initial.id && (
                        <Field label="Start from a template" hint="Fills in the question and answers. You can change them after.">{(id) => (
                            <Select id={id} defaultValue="" onChange={(e) => { const t = SURVEY_TEMPLATES.find((x) => x.id === e.target.value); if (t) setC((x) => ({ ...x, ...t.fields })); }}>
                                <option value="" disabled>Choose a template</option>
                                {SURVEY_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </Select>
                        )}</Field>
                    )}
                    <Field label="Question">{(id) => <Input id={id} value={c.question} maxLength={200} onChange={(e) => set('question', e.target.value)} />}</Field>
                    <Field label="Answer type">{(id) => <Select id={id} value={c.type} onChange={(e) => set('type', e.target.value as SurveyConfig['type'])}>{Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
                    {c.type === 'choice' && (
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-zinc-800">Answers</p>
                            {c.options.map((o, i) => (
                                <div key={i} className="flex gap-2">
                                    <Input aria-label={`Answer ${i + 1}`} value={o} maxLength={60} onChange={(e) => setOption(i, e.target.value)} />
                                    <Button variant="ghost" size="sm" aria-label={`Remove answer ${i + 1}`} disabled={c.options.length <= 2} onClick={() => set('options', c.options.filter((_, j) => j !== i))}>Remove</Button>
                                </div>
                            ))}
                            {c.options.length < 6 && <Button variant="secondary" size="sm" onClick={() => set('options', [...c.options, ''])}>Add an answer</Button>}
                        </div>
                    )}
                    {c.type !== 'text' && (
                        <label className="flex items-center gap-2 text-sm text-zinc-700"><input type="checkbox" checked={c.comment} onChange={(e) => set('comment', e.target.checked)} /> Add an optional comment box</label>
                    )}
                    {c.type !== 'text' && c.comment && <Field label="Comment box label">{(id) => <Input id={id} value={c.comment_label} maxLength={80} onChange={(e) => set('comment_label', e.target.value)} />}</Field>}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Button text">{(id) => <Input id={id} value={c.button_text} maxLength={30} onChange={(e) => set('button_text', e.target.value)} />}</Field>
                        <Field label="Thank you message">{(id) => <Input id={id} value={c.thanks} maxLength={120} onChange={(e) => set('thanks', e.target.value)} />}</Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Where on the page">{(id) => <Select id={id} value={c.position} onChange={(e) => set('position', e.target.value as SurveyConfig['position'])}>{Object.entries(POSITION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
                        <Field label="Color">{(id) => <Input id={id} type="color" value={c.color} onChange={(e) => set('color', e.target.value)} className="p-1" />}</Field>
                    </div>
                    <DisplayRuleFields c={c} onChange={(patch) => setC((x) => ({ ...x, ...patch }))} />
                    <p className="text-sm text-zinc-500">A visitor who answers never sees this survey again.</p>
                    {error && <Alert tone="danger">{error}</Alert>}
                    <div className="flex gap-2">
                        <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save survey'}</Button>
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

function Preview({ c }: { c: SurveyConfig }) {
    const scale = c.type === 'rating' || c.type === 'nps';
    const values = c.type === 'rating' ? ['1', '2', '3', '4', '5'] : c.type === 'nps' ? Array.from({ length: 11 }, (_, i) => String(i)) : c.options.filter((o) => o.trim());
    const box = (
        <div className="relative w-full max-w-[340px] rounded-xl bg-white p-5 text-left shadow-xl">
            <span aria-hidden className="absolute right-3 top-2 text-lg text-zinc-400">×</span>
            <p className="mb-3 pr-4 text-base font-bold text-zinc-900">{c.question || 'Question'}</p>
            {c.type === 'text' ? (
                <div className="mb-3 h-16 rounded-lg border border-zinc-300" />
            ) : (
                <div className={`mb-3 flex ${c.type === 'nps' ? 'gap-0.5' : 'gap-2'} ${scale ? '' : 'flex-col'}`}>
                    {values.map((v, i) => <span key={i} className={`rounded-lg border border-zinc-300 py-2 text-sm text-zinc-800 ${scale ? 'flex-1 text-center' : 'px-3'} ${c.type === 'nps' ? 'text-xs' : ''}`}>{v}</span>)}
                </div>
            )}
            {c.type !== 'text' && c.comment && <><p className="mb-1 text-xs text-zinc-500">{c.comment_label}</p><div className="mb-3 h-12 rounded-lg border border-zinc-300" /></>}
            <span className="inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white opacity-60" style={{ background: c.color }}>{c.button_text || 'Send'}</span>
        </div>
    );
    return (
        <div data-testid="survey-preview" className="relative flex min-h-80 overflow-hidden rounded-lg border border-zinc-200 bg-[repeating-linear-gradient(0deg,#f4f4f5_0,#f4f4f5_12px,#fff_12px,#fff_24px)]">
            {c.position === 'center' ? (
                <div className="flex w-full items-center justify-center bg-slate-900/45 p-4">{box}</div>
            ) : (
                <div className={`flex w-full items-end p-4 pt-16 ${c.position === 'bottom-right' ? 'justify-end' : 'justify-start'}`}>{box}</div>
            )}
        </div>
    );
}
