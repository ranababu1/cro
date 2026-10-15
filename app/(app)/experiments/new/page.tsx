'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader, Card, CardHeader, CardBody, Button, ButtonLink, Input, Field, Alert } from '@/app/components/ui';
import { GOAL_TYPES, GOAL_TYPE_LABELS, describeGoal, type GoalType, type PageMatchType } from '@/lib/goals';
import { evenWeights, redistributeWeights } from '@/lib/weights';
import { InstallSnippet } from '@/app/components/InstallSnippet';
import { TargetingFields } from '@/app/components/TargetingFields';
import { describeTargeting, type Targeting } from '@/lib/targeting';

type Step = 'domain' | 'control' | 'variations' | 'goals' | 'traffic' | 'review';

interface Domain { id: string; host: string }
interface VarDraft { name: string; url: string; weight: number; is_control: boolean }
interface GoalDraft { name: string; type: GoalType; selector: string; match_type: PageMatchType; is_primary: boolean }

const GOAL_PLACEHOLDER: Record<GoalType, string> = { click: '#headerCTA', form: 'form#signup', page: 'https://www.example.com/thank-you', event: 'signup' };
const selectClass = 'h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

const STEPS: { id: Step; label: string }[] = [
    { id: 'domain', label: 'Domain' },
    { id: 'control', label: 'Control URL' },
    { id: 'variations', label: 'Variations' },
    { id: 'goals', label: 'Goals' },
    { id: 'traffic', label: 'Traffic' },
    { id: 'review', label: 'Review' },
];


export default function NewExperimentWizard() {
    const router = useRouter();
    const [step, setStep] = useState<Step>('domain');
    const [domains, setDomains] = useState<Domain[]>([]);
    const [plan, setPlan] = useState('free');
    const [maxVars, setMaxVars] = useState(1);
    const [name, setName] = useState('');
    const [controlUrl, setControlUrl] = useState('');
    const [vars, setVars] = useState<VarDraft[]>([
        { name: 'Control', url: '', weight: 50, is_control: true },
        { name: 'Variation 1', url: '', weight: 50, is_control: false },
    ]);
    const [goals, setGoals] = useState<GoalDraft[]>([{ name: 'Primary CTA click', type: 'click', selector: '#headerCTA', match_type: 'equals', is_primary: true }]);
    const [traffic, setTraffic] = useState(100);
    const [targeting, setTargeting] = useState<Targeting>({});
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [newHost, setNewHost] = useState('');

    useEffect(() => {
        void (async () => {
            const [dRes] = await Promise.all([fetch('/api/domains'), fetch('/api/keys')]);
            const d = await dRes.json();
            setDomains(d.domains || []);
            // Plan from admin isn't on keys; default free. Dashboard may expose later - fetch org via a lightweight approach:
            try {
                const dashboard = await fetch('/api/experiments');
                void dashboard;
            } catch { /* ignore */ }
            // Read plan limit from a small endpoint embedded in domains response later; for now call a helper via experiments create error. Soft-fetch from settings:
            const planRes = await fetch('/api/plan').catch(() => null);
            if (planRes && planRes.ok) {
                const p = await planRes.json();
                setPlan(p.plan || 'free');
                setMaxVars(p.max_variations === null ? 25 : p.max_variations || 1);
            }
        })();
    }, []);

    const nonControlCount = vars.filter((v) => !v.is_control).length;
    const stepIndex = STEPS.findIndex((s) => s.id === step);

    function setWeightsEqual() {
        const w = evenWeights(vars.length);
        setVars((vs) => vs.map((v, i) => ({ ...v, weight: w[i] })));
    }

    function setWeight(index: number, raw: string) {
        const value = raw === '' ? 0 : Number(raw);
        setVars((vs) => {
            const nextWeights = redistributeWeights(vs.map((v) => v.weight), index, value);
            return vs.map((v, i) => ({ ...v, weight: nextWeights[i] }));
        });
    }

    function addVariation() {
        if (nonControlCount >= maxVars) return;
        const next = [...vars, { name: `Variation ${nonControlCount + 1}`, url: '', weight: 0, is_control: false }];
        const w = evenWeights(next.length);
        setVars(next.map((v, i) => ({ ...v, weight: w[i] })));
    }

    function removeVariation(i: number) {
        if (vars[i].is_control || vars.length <= 2) return;
        const next = vars.filter((_, j) => j !== i);
        const w = evenWeights(next.length);
        setVars(next.map((v, i) => ({ ...v, weight: w[i] })));
    }

    async function addDomain(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true); setError('');
        const res = await fetch('/api/domains', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host: newHost }) });
        const data = await res.json();
        setBusy(false);
        if (!res.ok) { setError(data.error || 'Could not add domain'); return; }
        setDomains((d) => [...d, data.domain]);
        setNewHost('');
    }

    function syncControlUrl(url: string) {
        setControlUrl(url);
        setVars((vs) => vs.map((v) => (v.is_control ? { ...v, url } : v)));
    }

    async function create(start: boolean) {
        setBusy(true); setError('');
        const payload = {
            name: name || 'Untitled test',
            control_url: controlUrl,
            traffic_allocation: traffic,
            targeting,
            variations: vars,
            goals,
        };
        const res = await fetch('/api/experiments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) {
            setBusy(false);
            setError(data.error || 'Could not create the test');
            return;
        }
        if (start) {
            const startRes = await fetch(`/api/experiments/${data.experiment.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'running' }),
            });
            if (!startRes.ok) {
                const err = await startRes.json();
                setBusy(false);
                setError(err.error || 'Created as draft, but could not start');
                router.push(`/experiments/${data.experiment.id}`);
                return;
            }
        }
        router.push(`/experiments/${data.experiment.id}`);
    }

    const canNext = useMemo(() => {
        if (step === 'domain') return domains.length > 0;
        if (step === 'control') return !!controlUrl && !!name;
        if (step === 'variations') return vars.every((v) => v.url && v.name) && Math.abs(vars.reduce((a, v) => a + v.weight, 0) - 100) < 0.05;
        if (step === 'goals') return goals.length > 0 && goals.every((g) => g.name && g.selector) && goals.filter((g) => g.is_primary).length === 1;
        if (step === 'traffic') return traffic >= 0 && traffic <= 100;
        return true;
    }, [step, domains, controlUrl, name, vars, goals, traffic]);

    function goNext() {
        if (!canNext) return;
        const i = stepIndex + 1;
        if (i < STEPS.length) setStep(STEPS[i].id);
    }
    function goBack() {
        const i = stepIndex - 1;
        if (i >= 0) setStep(STEPS[i].id);
    }

    return (
        <div>
            <PageHeader
                title="New test"
                description="URL split test: one control page, variation pages, and click goals."
                breadcrumb={<Link href="/experiments" className="hover:text-zinc-800">Experiments</Link>}
            />

            <ol className="mb-8 flex flex-wrap gap-2">
                {STEPS.map((s, i) => (
                    <li key={s.id}>
                        <button
                            type="button"
                            onClick={() => i <= stepIndex && setStep(s.id)}
                            className={`rounded-full px-3 py-1 text-sm font-medium ${s.id === step ? 'bg-brand-600 text-white' : i < stepIndex ? 'bg-brand-50 text-brand-700' : 'bg-zinc-100 text-zinc-500'}`}
                        >
                            {i + 1}. {s.label}
                        </button>
                    </li>
                ))}
            </ol>

            {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

            {step === 'domain' && (
                <Card>
                    <CardHeader title="Domain" description="Tests only run on domains you register for this project." />
                    <CardBody className="space-y-4">
                        {domains.length > 0 ? (
                            <ul className="space-y-2">{domains.map((d) => <li key={d.id} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium">{d.host}</li>)}</ul>
                        ) : (
                            <Alert tone="warning" title="Add a domain first">You need at least one domain before creating a test.</Alert>
                        )}
                        <form onSubmit={addDomain} className="flex flex-wrap gap-2">
                            <Input placeholder="www.example.com" value={newHost} onChange={(e) => setNewHost(e.target.value)} className="max-w-sm" />
                            <Button type="submit" disabled={busy || !newHost}>Add domain</Button>
                        </form>
                        <ButtonLink href="/settings/domains" variant="secondary" size="sm">Manage domains</ButtonLink>
                    </CardBody>
                </Card>
            )}

            {step === 'control' && (
                <Card>
                    <CardHeader title="Control URL" description="The original page you want to test against. Must be on a registered domain." />
                    <CardBody className="space-y-4">
                        <Field label="Test name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Homepage headline" required />}</Field>
                        <Field label="Control URL" hint="Full URL, for example https://www.example.com/pricing">
                            {(id) => <Input id={id} type="url" value={controlUrl} onChange={(e) => syncControlUrl(e.target.value)} placeholder="https://www.example.com/" required />}
                        </Field>
                    </CardBody>
                </Card>
            )}

            {step === 'variations' && (
                <Card>
                    <CardHeader
                        title="Variation URLs"
                        description={`Free plan: 1 variation. Paid plans: up to ${maxVars === 1 ? 10 : maxVars}. Your plan: ${plan} (max ${maxVars}).`}
                        actions={<Button variant="secondary" size="sm" onClick={addVariation} disabled={nonControlCount >= maxVars}>Add variation</Button>}
                    />
                    <CardBody className="space-y-4">
                        {nonControlCount >= maxVars && plan === 'free' && (
                            <Alert tone="info" title="Upgrade to add more variations">The free plan allows 1 variation. Paid plans allow up to 10.</Alert>
                        )}
                        {vars.map((v, i) => (
                            <div key={i} className="grid gap-3 rounded-xl border border-zinc-200 p-4 sm:grid-cols-[1fr_2fr_6rem_auto]">
                                <Input aria-label="Name" value={v.name} onChange={(e) => setVars((vs) => vs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                                <Input aria-label="URL" type="url" value={v.url} onChange={(e) => setVars((vs) => vs.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder={v.is_control ? controlUrl : 'https://www.example.com/b'} disabled={v.is_control} />
                                <Input aria-label="Weight" type="number" min={0} max={100} value={v.weight} onChange={(e) => setWeight(i, e.target.value)} />
                                <div className="flex items-center gap-2">
                                    {v.is_control ? <span className="text-xs font-medium text-zinc-500">Control</span> : <Button variant="ghost" size="sm" onClick={() => removeVariation(i)}>Remove</Button>}
                                </div>
                            </div>
                        ))}
                        <Button variant="secondary" size="sm" onClick={setWeightsEqual}>Equal weights</Button>
                        <p className="text-sm text-zinc-500">Weights always total 100. Change one and the others adjust automatically.</p>
                    </CardBody>
                </Card>
            )}

            {step === 'goals' && (
                <Card>
                    <CardHeader title="Goals" description="What counts as a conversion: a click on an element (#headerCTA, .bodyCTA), a form submit, a visit to a page, or a custom event from your code." actions={<Button variant="secondary" size="sm" onClick={() => setGoals((g) => [...g, { name: '', type: 'click', selector: '', match_type: 'equals', is_primary: false }])}>Add goal</Button>} />
                    <CardBody className="space-y-4">
                        {goals.map((g, i) => (
                            <div key={i} className="grid gap-3 rounded-xl border border-zinc-200 p-4 sm:grid-cols-[1fr_9rem_auto_1.4fr_auto_auto]">
                                <Input aria-label="Goal name" placeholder="Primary CTA" value={g.name} onChange={(e) => setGoals((gs) => gs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                                <select aria-label="Goal type" className={selectClass} value={g.type} onChange={(e) => setGoals((gs) => gs.map((x, j) => j === i ? { ...x, type: e.target.value as GoalType } : x))}>
                                    {GOAL_TYPES.map((t) => <option key={t} value={t}>{GOAL_TYPE_LABELS[t]}</option>)}
                                </select>
                                {g.type === 'page' ? (
                                    <select aria-label="URL match" className={selectClass} value={g.match_type} onChange={(e) => setGoals((gs) => gs.map((x, j) => j === i ? { ...x, match_type: e.target.value as PageMatchType } : x))}>
                                        <option value="equals">URL is</option>
                                        <option value="contains">URL contains</option>
                                        <option value="regex">URL matches regex</option>
                                    </select>
                                ) : <span className="hidden sm:block" />}
                                <Input aria-label={g.type === 'page' ? 'Page URL' : g.type === 'event' ? 'Event name' : 'CSS selector'} placeholder={GOAL_PLACEHOLDER[g.type]} value={g.selector} onChange={(e) => setGoals((gs) => gs.map((x, j) => j === i ? { ...x, selector: e.target.value } : x))} />
                                <label className="flex items-center gap-2 text-sm"><input type="radio" name="primary" checked={g.is_primary} onChange={() => setGoals((gs) => gs.map((x, j) => ({ ...x, is_primary: j === i })))} /> Primary</label>
                                <Button variant="ghost" size="sm" disabled={goals.length <= 1} onClick={() => setGoals((gs) => {
                                    const next = gs.filter((_, j) => j !== i);
                                    if (!next.some((x) => x.is_primary) && next[0]) next[0] = { ...next[0], is_primary: true };
                                    return next;
                                })}>Remove</Button>
                            </div>
                        ))}
                        {goals.some((g) => g.type === 'event') && (
                            <p className="text-sm text-zinc-500">For custom events, call <code className="rounded bg-zinc-100 px-1">ABTest.track(&apos;{goals.find((g) => g.type === 'event')?.selector || 'signup'}&apos;)</code> on your page when the action happens.</p>
                        )}
                        {goals.some((g) => g.type === 'page') && (
                            <p className="text-sm text-zinc-500">Page visit goals need the install snippet on that page too.</p>
                        )}
                    </CardBody>
                </Card>
            )}

            {step === 'traffic' && (
                <Card>
                    <CardHeader title="Traffic" description="Share of visitors who enter the test. The rest see the control page and are not counted." />
                    <CardBody className="space-y-6">
                        <Field label={`Traffic allocation: ${traffic}%`}>
                            {(id) => <input id={id} type="range" min={0} max={100} step={5} value={traffic} onChange={(e) => setTraffic(Number(e.target.value))} className="w-full accent-brand-600" />}
                        </Field>
                        <TargetingFields value={targeting} onChange={setTargeting} />
                    </CardBody>
                </Card>
            )}

            {step === 'review' && (
                <div className="space-y-6">
                    <Card>
                        <CardHeader title="Review and start" />
                        <CardBody className="space-y-3 text-sm text-zinc-700">
                            <p><span className="font-medium text-zinc-900">Name:</span> {name}</p>
                            <p><span className="font-medium text-zinc-900">Control:</span> {controlUrl}</p>
                            <p><span className="font-medium text-zinc-900">Variations:</span> {vars.filter((v) => !v.is_control).map((v) => `${v.name} (${v.weight}%) → ${v.url}`).join('; ')}</p>
                            <p><span className="font-medium text-zinc-900">Goals:</span> {goals.map((g) => `${g.name} (${GOAL_TYPE_LABELS[g.type]}: ${describeGoal(g)})${g.is_primary ? ' (primary)' : ''}`).join('; ')}</p>
                            <p><span className="font-medium text-zinc-900">Traffic:</span> {traffic}%</p>
                            <p><span className="font-medium text-zinc-900">Who can enter:</span> {describeTargeting(targeting)}</p>
                        </CardBody>
                    </Card>
                    <Card>
                        <CardHeader title="Install" description="One line in the &lt;head&gt; of the control and every variation page. Your public SDK key is already filled in." />
                        <CardBody>
                            <InstallSnippet />
                        </CardBody>
                    </Card>
                </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
                {stepIndex > 0 && <Button variant="secondary" onClick={goBack}>Back</Button>}
                {step !== 'review' && <Button onClick={goNext} disabled={!canNext}>Continue</Button>}
                {step === 'review' && (
                    <>
                        <Button variant="secondary" disabled={busy} onClick={() => create(false)}>Save as draft</Button>
                        <Button disabled={busy} onClick={() => create(true)}>Start test</Button>
                    </>
                )}
            </div>
        </div>
    );
}
