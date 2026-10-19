'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader, Card, CardHeader, CardBody, Button, Spinner, Table, THead, TBody, TR, TH, TD, Badge, Alert, Input, Field, CodeBlock } from '@/app/components/ui';
import { UpgradeNote } from '@/app/components/UpgradeNote';
import { setProjectCookie } from '@/lib/currentProject';

type Member = { user_id: string; name: string | null; email: string; role: 'owner' | 'member'; joined_at: string; you: boolean };
type Invite = { id: string; role: 'owner' | 'member'; created_at: string; expires_at: string; created_by: string | null };
type Project = { id: string; name: string; created_at: string; current: boolean };
type Team = {
    organization: string | null; role: 'owner' | 'member'; members: Member[]; invites: Invite[];
    seats: { used: number; limit: number | null }; projects: { used: number; limit: number | null; list: Project[] };
};

const selectClass = 'h-8 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const of = (used: number, limit: number | null) => (limit === null ? `${used}` : `${used} of ${limit}`);

async function call(url: string, method: string, body?: unknown) {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error ?? 'Something went wrong');
    return j;
}

/** Team and projects of the current organization. Owners invite, change roles and add projects; members see the list. */
export default function TeamPage() {
    const router = useRouter();
    const [team, setTeam] = useState<Team | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [link, setLink] = useState<string | null>(null);
    const [inviteRole, setInviteRole] = useState<'member' | 'owner'>('member');
    const [projectName, setProjectName] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try { setTeam(await call('/api/team', 'GET')); } catch (e) { setError((e as Error).message); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const run = async (fn: () => Promise<unknown>) => {
        setBusy(true); setError(null);
        try { await fn(); await load(); router.refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };

    if (!team) return <div className="flex h-40 items-center justify-center">{error ? <Alert tone="danger">{error}</Alert> : <Spinner />}</div>;
    const owner = team.role === 'owner';
    const seatsFull = team.seats.limit !== null && team.seats.used >= team.seats.limit;
    const projectsFull = team.projects.limit !== null && team.projects.used >= team.projects.limit;

    return (
        <div className="space-y-6">
            <PageHeader title="Team and projects" description={`People and projects in ${team.organization ?? 'your organization'}. Owners invite people, change roles and add projects. Members can use everything else.`} />
            {error && <Alert tone="danger">{error}</Alert>}

            <Card>
                <CardHeader title="Members" description={`Seats used: ${of(team.seats.used, team.seats.limit)}. Open invites hold a seat until they are used, cancelled or expire.`} />
                <Table>
                    <THead><tr><TH>Name</TH><TH>Role</TH><TH>Joined</TH><TH align="right"><span className="sr-only">Actions</span></TH></tr></THead>
                    <TBody>
                        {team.members.map((m) => (
                            <TR key={m.user_id}>
                                <TD><div className="font-medium text-zinc-900">{m.name || m.email}{m.you && <span className="ml-2 text-xs text-zinc-500">(you)</span>}</div><div className="text-xs text-zinc-500">{m.email}</div></TD>
                                <TD>
                                    {owner ? (
                                        <select aria-label={`Role of ${m.email}`} className={selectClass} value={m.role} disabled={busy} onChange={(e) => run(() => call(`/api/team/members/${m.user_id}`, 'PATCH', { role: e.target.value }))}>
                                            <option value="owner">Owner</option><option value="member">Member</option>
                                        </select>
                                    ) : <Badge tone={m.role === 'owner' ? 'brand' : 'neutral'}>{m.role === 'owner' ? 'Owner' : 'Member'}</Badge>}
                                </TD>
                                <TD numeric>{day(m.joined_at)}</TD>
                                <TD align="right">
                                    {(owner || m.you) && !(m.role === 'owner' && team.members.filter((x) => x.role === 'owner').length === 1) && (
                                        <Button variant="danger" size="sm" disabled={busy} onClick={() => { if (window.confirm(m.you ? 'Leave this organization? You lose access at once.' : `Remove ${m.email}? They lose access at once.`)) run(() => call(`/api/team/members/${m.user_id}`, 'DELETE')); }}>
                                            {m.you ? 'Leave' : 'Remove'}
                                        </Button>
                                    )}
                                </TD>
                            </TR>
                        ))}
                    </TBody>
                </Table>
            </Card>

            <Card>
                <CardHeader title="Invite people" description="Create a link and send it yourself, for example in chat. Each link works once, for 7 days. Whoever opens it signs in with Google and joins with the role you picked." />
                <CardBody>
                    {!owner ? <p className="text-sm text-zinc-600">Ask an owner to invite people.</p>
                        : seatsFull ? <UpgradeNote>{team.seats.limit === 1 ? 'Your plan includes 1 seat. Upgrade to Starter for 5 seats, or Growth for 15.' : `All ${team.seats.limit} seats are in use. Remove a member or cancel an invite, or upgrade for more.`}</UpgradeNote>
                            : (
                                <div className="flex flex-wrap items-end gap-3">
                                    <label className="text-sm text-zinc-700">Role
                                        <select aria-label="Role for the invite" className={`${selectClass} ml-2`} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as 'member' | 'owner')}>
                                            <option value="member">Member</option><option value="owner">Owner</option>
                                        </select>
                                    </label>
                                    <Button disabled={busy} onClick={() => run(async () => { const j = await call('/api/team/invites', 'POST', { role: inviteRole }); setLink(j.url); })}>Create invite link</Button>
                                </div>
                            )}
                    {link && (
                        <div className="mt-4" data-testid="invite-link">
                            <p className="mb-2 text-sm text-zinc-700">Copy this link now. It is not shown again.</p>
                            <CodeBlock code={link} />
                        </div>
                    )}
                    {team.invites.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-sm font-medium text-zinc-900">Open invites</h3>
                            <ul className="mt-2 divide-y divide-zinc-100">
                                {team.invites.map((i) => (
                                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                                        <span className="text-zinc-700">{i.role === 'owner' ? 'Owner' : 'Member'} invite{i.created_by ? ` by ${i.created_by}` : ''}, expires {day(i.expires_at)}</span>
                                        {owner && <Button variant="secondary" size="sm" disabled={busy} onClick={() => run(() => call(`/api/team/invites/${i.id}`, 'DELETE'))}>Cancel</Button>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </CardBody>
            </Card>

            <Card>
                <CardHeader title="Projects" description={`Projects used: ${of(team.projects.used, team.projects.limit)}. Each project has its own Development, Staging and Production keys, domains and tests.`} />
                <CardBody>
                    <ul className="divide-y divide-zinc-100">
                        {team.projects.list.map((p) => (
                            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                                <span className="font-medium text-zinc-900">{p.name}{p.current && <span className="ml-2 text-xs font-normal text-zinc-500">(selected)</span>}</span>
                                <span className="flex gap-2">
                                    {!p.current && <Button variant="secondary" size="sm" onClick={() => { setProjectCookie(p.id); router.refresh(); load(); }}>Open</Button>}
                                    {owner && <Button variant="secondary" size="sm" disabled={busy} onClick={() => { const name = window.prompt('New name for the project', p.name); if (name && name.trim() !== p.name) run(() => call(`/api/projects/${p.id}`, 'PATCH', { name })); }}>Rename</Button>}
                                </span>
                            </li>
                        ))}
                    </ul>
                    {owner && (projectsFull
                        ? <div className="mt-4"><UpgradeNote>{team.projects.limit === 1 ? 'Your plan includes 1 project. Upgrade to Starter for 3 projects, or Growth for 10.' : `Your plan includes ${team.projects.limit} projects. Upgrade for more.`}</UpgradeNote></div>
                        : (
                            <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { const j = await call('/api/projects', 'POST', { name: projectName }); setProjectName(''); setProjectCookie(j.project.id); }); }}>
                                <Field label="New project" className="min-w-0 flex-1">
                                    {(id) => <Input id={id} placeholder="Marketing site" value={projectName} maxLength={80} onChange={(e) => setProjectName(e.target.value)} required />}
                                </Field>
                                <Button type="submit" disabled={busy}>Add project</Button>
                            </form>
                        ))}
                </CardBody>
            </Card>
        </div>
    );
}
