import Link from 'next/link';
import type { Metadata } from 'next';
import { getAppContext } from '@/lib/appContext';
import { db, monthStartIso } from '@/lib/db';
import { PageHeader, Card, CardHeader, ButtonLink, Stat, StatusBadge, Table, THead, TBody, TR, TH, TD, EmptyState } from '@/app/components/ui';
import { CheckIcon, PlusIcon, FlaskIcon } from '@/app/components/shell/icons';

export const metadata: Metadata = { title: 'Overview' };

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-');

export default async function Dashboard() {
    const ctx = (await getAppContext())!;
    const project = ctx.current;
    const experiments = project ? await db.getExperiments([project.id]) : [];
    const keys = project ? (await db.listApiKeys(project.id)).filter((k) => !k.revoked_at) : [];
    const usage = project ? await db.getOrgUsage(project.org_id, monthStartIso()) : { visitors: 0, events: 0 };
    const count = (s: string) => experiments.filter((e) => e.status === s).length;

    const steps = [
        { done: keys.some((k) => k.type === 'sdk'), title: 'Create an SDK key', body: 'Each environment has its own keys.', href: '/settings/keys', cta: 'Open API keys' },
        { done: experiments.length > 0, title: 'Create your first experiment', body: 'Define a control and one or more variants with traffic weights.', href: '/experiments/new', cta: 'New experiment' },
        { done: experiments.some((e) => e.status !== 'draft'), title: 'Install the snippet and start it', body: 'Add the SDK to your site, then start the experiment to begin assigning visitors.', href: '/experiments', cta: 'View experiments' },
    ];
    const allDone = steps.every((s) => s.done);
    const firstName = ctx.user.name.split(' ')[0];

    return (
        <>
            <PageHeader
                title={firstName ? `Welcome back, ${firstName}` : 'Overview'}
                description={project ? `${project.org_name} / ${project.name}` : undefined}
                actions={<ButtonLink href="/experiments/new"><PlusIcon />New experiment</ButtonLink>}
            />

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Running" value={count('running')} hint="Assigning visitors now" />
                <Stat label="Drafts" value={count('draft')} />
                <Stat label="Completed" value={count('completed')} />
                <Stat label="Visitors this month" value={usage.visitors.toLocaleString()} hint="Across your organization" />
            </div>

            {!allDone && (
                <Card className="mt-6">
                    <CardHeader title="Get started" description="Three steps to your first result." />
                    <ol className="divide-y divide-zinc-100">
                        {steps.map((s, i) => (
                            <li key={s.title} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${s.done ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-zinc-100 text-zinc-600'}`}>
                                    {s.done ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className={`text-sm font-medium ${s.done ? 'text-zinc-500 line-through' : 'text-zinc-900'}`}>{s.title}</p>
                                    <p className="text-sm text-zinc-500">{s.body}</p>
                                </div>
                                {!s.done && <ButtonLink href={s.href} variant="secondary" size="sm">{s.cta}</ButtonLink>}
                            </li>
                        ))}
                    </ol>
                </Card>
            )}

            <Card className="mt-6">
                <CardHeader title="Recent experiments" actions={experiments.length > 0 && <ButtonLink href="/experiments" variant="ghost" size="sm">View all</ButtonLink>} />
                {experiments.length === 0 ? (
                    <EmptyState
                        icon={<FlaskIcon />}
                        title="No experiments yet"
                        description="Experiments compare a control against one or more variants and report which converts better."
                        action={<ButtonLink href="/experiments/new" size="sm"><PlusIcon />New experiment</ButtonLink>}
                    />
                ) : (
                    <Table>
                        <THead><tr><TH>Name</TH><TH>Status</TH><TH align="right">Traffic</TH><TH align="right">Started</TH></tr></THead>
                        <TBody>
                            {experiments.slice(0, 5).map((e) => (
                                <TR key={e.id}>
                                    <TD><Link href={`/experiments/${e.id}`} className="font-medium text-zinc-900 hover:underline">{e.name}</Link></TD>
                                    <TD><StatusBadge status={e.status} /></TD>
                                    <TD numeric>{e.traffic_allocation}%</TD>
                                    <TD numeric>{date(e.started_at)}</TD>
                                </TR>
                            ))}
                        </TBody>
                    </Table>
                )}
            </Card>
        </>
    );
}
