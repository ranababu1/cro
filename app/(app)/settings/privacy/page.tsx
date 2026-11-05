'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { publicAppOrigin } from '@/lib/publicOrigin';
import { PageHeader, Card, CardHeader, CardBody, Button, ButtonLink, Input, Field, Alert, Spinner, CodeBlock } from '@/app/components/ui';

type Team = { organization: string | null; role: 'owner' | 'member'; projects: { list: { id: string; name: string; current: boolean }[] } };
type AccountPlan = { can_delete: boolean; error?: string; deletes?: string[]; leaves?: string[] };

async function call(url: string, method: string, body?: unknown) {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error ?? 'Something went wrong');
    return j;
}

/** Privacy and data: export account data, erase one website visitor, delete a project, delete the account. */
export default function PrivacyPage() {
    const router = useRouter();
    const [team, setTeam] = useState<Team | null>(null);
    const [account, setAccount] = useState<AccountPlan | null>(null);
    const [visitor, setVisitor] = useState('');
    const [projectConfirm, setProjectConfirm] = useState('');
    const [emailConfirm, setEmailConfirm] = useState('');
    const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const [t, a] = await Promise.all([call('/api/team', 'GET'), call('/api/account', 'GET')]);
            setTeam(t); setAccount(a);
        } catch (e) { setMsg({ tone: 'danger', text: (e as Error).message }); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const run = async (fn: () => Promise<string | void>) => {
        setBusy(true); setMsg(null);
        try { const text = await fn(); if (text) setMsg({ tone: 'success', text }); } catch (e) { setMsg({ tone: 'danger', text: (e as Error).message }); } finally { setBusy(false); }
    };

    if (!team || !account) return <div className="flex h-40 items-center justify-center">{msg ? <Alert tone="danger">{msg.text}</Alert> : <Spinner />}</div>;
    const owner = team.role === 'owner';
    const project = team.projects.list.find((p) => p.current) ?? team.projects.list[0];
    const lastProject = team.projects.list.length <= 1;

    return (
        <div className="max-w-3xl space-y-6">
            <PageHeader title="Privacy and data" description="Download your data, handle a deletion request from one of your visitors, or delete a project or your account." />
            {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

            <Card>
                <CardHeader title="Download your data" description="Your profile, organizations, projects, tests and support tickets as one JSON file. Results per test are on each results page as CSV." />
                <CardBody><ButtonLink href="/api/account/export" variant="secondary">Download JSON</ButtonLink></CardBody>
            </Card>

            <Card>
                <CardHeader title="Erase a website visitor" description={`Removes one visitor's test assignments and events from ${project?.name ?? 'this project'}. Daily totals hold no visitor ids and stay. Find the id in the visitor's browser: ABTest.getUserId().`} />
                <CardBody className="space-y-3">
                    {!owner ? <p className="text-sm text-zinc-500">Only owners can erase visitors.</p> : (
                        <>
                            <Field label="Visitor id">{(id) => <Input id={id} value={visitor} placeholder="user_1730000000000_ab12cd34e" onChange={(e) => setVisitor(e.target.value)} />}</Field>
                            <Button variant="secondary" disabled={busy || !visitor.trim()} onClick={() => run(async () => {
                                const r = await call('/api/privacy/visitors', 'DELETE', { visitor_id: visitor.trim() });
                                setVisitor('');
                                return `Erased: ${r.assignments} assignment${r.assignments === 1 ? '' : 's'} and ${r.events} event${r.events === 1 ? '' : 's'}.`;
                            })}>Erase visitor</Button>
                            <p className="text-sm text-zinc-500">From your own backend, with a secret key:</p>
                            <CodeBlock code={`curl -X DELETE ${publicAppOrigin()}/api/privacy/visitors \\\n  -H "Authorization: Bearer cro_sk_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"visitor_id":"user_1730000000000_ab12cd34e"}'`} />
                        </>
                    )}
                </CardBody>
            </Card>

            <Card>
                <CardHeader title="Delete this project" description={`Deletes ${project?.name ?? 'the project'} with its tests, results, domains, API keys, heatmaps, popups and surveys. This cannot be undone.`} />
                <CardBody className="space-y-3">
                    {!owner ? <p className="text-sm text-zinc-500">Only owners can delete projects.</p> : lastProject ? <p className="text-sm text-zinc-500">This is the only project in {team.organization ?? 'your organization'}. Delete your account below to remove everything.</p> : (
                        <>
                            <Field label={`Type ${project?.name} to confirm`}>{(id) => <Input id={id} value={projectConfirm} onChange={(e) => setProjectConfirm(e.target.value)} />}</Field>
                            <Button variant="danger" disabled={busy || projectConfirm.trim() !== project?.name} onClick={() => run(async () => {
                                await call(`/api/projects/${project!.id}`, 'DELETE', { confirm: projectConfirm.trim() });
                                setProjectConfirm('');
                                await load();
                                router.refresh();
                                return 'Project deleted.';
                            })}>Delete project</Button>
                        </>
                    )}
                </CardBody>
            </Card>

            <Card>
                <CardHeader title="Delete your account" description="Signs you out and deletes your account. This cannot be undone." />
                <CardBody className="space-y-3">
                    {!account.can_delete ? <Alert tone="warning">{account.error}</Alert> : (
                        <>
                            {!!account.deletes?.length && <p className="text-sm text-zinc-700">Deleted with all their data: <strong>{account.deletes.join(', ')}</strong>.</p>}
                            {!!account.leaves?.length && <p className="text-sm text-zinc-700">You leave, and they keep their data: <strong>{account.leaves.join(', ')}</strong>.</p>}
                            <Field label="Type your email address to confirm">{(id) => <Input id={id} type="email" value={emailConfirm} onChange={(e) => setEmailConfirm(e.target.value)} />}</Field>
                            <Button variant="danger" disabled={busy || !emailConfirm.includes('@')} onClick={() => run(async () => {
                                await call('/api/account', 'DELETE', { confirm: emailConfirm.trim() });
                                await signOut({ callbackUrl: '/' });
                            })}>Delete my account</Button>
                        </>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
