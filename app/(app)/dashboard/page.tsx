import Link from 'next/link';
import type { Metadata } from 'next';
import { getAppContext } from '@/lib/appContext';
import { db, monthStartIso } from '@/lib/db';
import { PageHeader, Card, CardHeader, ButtonLink, Stat, StatusBadge, Table, THead, TBody, TR, TH, TD, EmptyState } from '@/app/components/ui';
import { CheckIcon, PlusIcon, FlaskIcon } from '@/app/components/shell/icons';
import { InstallSnippet } from '@/app/components/InstallSnippet';
import { WordPressCard } from '@/app/components/WordPressCard';
import { PageviewUsage } from '@/app/components/PageviewUsage';
import { getPageviewStatus } from '@/lib/pageviewQuota';
import { PlanUsage, type UsageRow } from '@/app/components/PlanUsage';
import { getOrgEntitlements } from '@/lib/entitlements';
import { getVisitorUsage } from '@/lib/quotas';

export const metadata: Metadata = { title: 'Overview' };

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-');

export default async function Dashboard() {
    const ctx = (await getAppContext())!;
    const project = ctx.current;
    const experiments = project ? await db.getExperiments([project.id]) : [];
    if (project) await db.ensureProjectSdkKeys(project.id, ctx.user.id);
    const keys = project ? (await db.listApiKeys(project.id)).filter((k) => !k.revoked_at) : [];
    const usage = project ? await db.getOrgUsage(project.org_id, monthStartIso()) : { visitors: 0, events: 0 };
    const pageviews = project ? await getPageviewStatus(project.org_id, { fresh: true }) : null;
    const org = project ? await db.getOrganization(project.org_id) : null;
    const count = (s: string) => experiments.filter((e) => e.status === s).length;
    let usageRows: UsageRow[] = [];
    if (project && org) {
        const { limits } = await getOrgEntitlements(org.id);
        const v = await getVisitorUsage(org.id);
        const running = await db.countRunningExperiments(org.id);
        const projects = (await db.getOrgProjects(org.id)).length;
        usageRows = [
            { label: 'Tested visitors this month', used: v.month, limit: limits.monthlyVisitors, atLimit: 'New visitors see your original page and are not counted until next month. Visitors already in a test keep their version.' },
            { label: 'Tested visitors today', used: v.day, limit: limits.dailyVisitors, atLimit: 'New visitors see your original page and are not counted until tomorrow (UTC). Visitors already in a test keep their version.' },
            { label: 'Running tests', used: running, limit: limits.activeExperiments, atLimit: 'Pause or complete it before you start another.', capacity: true },
            { label: 'Tests used (all time)', used: org.experiments_started_total, limit: limits.lifetimeExperiments, atLimit: 'You have started every test the free plan includes. Deleting tests does not free them up.' },
            { label: 'Projects', used: projects, limit: limits.projects, atLimit: limits.projects === 1 ? 'Your plan includes one project. Upgrade to add more.' : `Your plan includes ${limits.projects} projects. Upgrade to add more.`, capacity: true },
        ];
    }

    const steps = [
        { done: keys.some((k) => k.type === 'sdk' && k.key_plaintext), title: 'SDK key ready', body: 'A production public SDK key is created for you automatically.', href: '/settings/keys', cta: 'View API keys' },
        { done: experiments.length > 0, title: 'Create your first experiment', body: 'Define a control and one or more variants with traffic weights.', href: '/experiments/new', cta: 'New experiment' },
        { done: experiments.some((e) => e.status !== 'draft'), title: 'Install the snippet and start it', body: 'Copy the pre-filled snippet below onto your site, then start the experiment.', href: '/experiments', cta: 'View experiments' },
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

            <PlanUsage rows={usageRows} plan={org?.plan || 'free'} />
            {pageviews && pageviews.limit !== null && <PageviewUsage status={pageviews} plan={org?.plan || 'free'} />}

            {project && (
                <Card className="mt-6">
                    <CardHeader title="Install your snippet" description="Already filled with your production public SDK key. Switch to Development if you want a separate key." />
                    <div className="px-5 pb-5"><InstallSnippet /><WordPressCard /></div>
                </Card>
            )}

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
