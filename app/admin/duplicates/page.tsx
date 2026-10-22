import Link from 'next/link';
import type { Metadata } from 'next';
import { findDuplicateGroups, type DuplicateKind } from '@/lib/duplicates';
import { PageHeader, Card, CardHeader, CardBody, ButtonLink, Badge, StatusBadge } from '@/app/components/ui';
import SuspendButton from './SuspendButton';

export const metadata: Metadata = { title: 'Duplicate accounts' };
export const dynamic = 'force-dynamic';

const KIND: Record<DuplicateKind, string> = { phone: 'Same phone', signup_ip: 'Same sign-up IP', domain: 'Same domain' };

export default async function DuplicatesPage() {
    const groups = await findDuplicateGroups();
    return (
        <>
            <PageHeader
                title="Duplicate accounts"
                description="Organizations whose members share a phone number, a sign-up IP (compared as salted hashes) or a domain. Nothing is blocked automatically. Suspending stops the org's SDK and dashboard at once; every change is written to the audit and abuse logs."
                actions={<div className="flex gap-2"><ButtonLink href="/admin/abuse" variant="secondary" size="sm">Abuse log</ButtonLink><ButtonLink href="/admin" variant="secondary" size="sm">Back to tenants</ButtonLink></div>}
            />
            {groups.length === 0 ? (
                <Card><CardBody><p className="text-sm text-zinc-500">No shared phone numbers, sign-up IPs or domains.</p></CardBody></Card>
            ) : (
                <div className="space-y-4" data-testid="duplicate-groups">
                    {groups.map((g) => (
                        <Card key={g.key}>
                            <CardHeader title={<span className="flex flex-wrap items-center gap-2"><Badge tone="warning">{KIND[g.kind]}</Badge><span className="font-mono text-sm">{g.label}</span><span className="text-sm font-normal text-zinc-500">{g.orgs.length} organizations</span></span>} />
                            <CardBody>
                                <ul className="divide-y divide-zinc-100">
                                    {g.orgs.map((o) => (
                                        <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                                            <span className="min-w-0">
                                                <Link className="font-medium text-zinc-900 hover:underline" href={`/admin/orgs/${o.id}`}>{o.name}</Link>
                                                <span className="ml-2 capitalize text-zinc-500">{o.plan}</span>
                                                <span className="block truncate text-zinc-500">{o.emails.join(', ') || 'No members'}</span>
                                            </span>
                                            <span className="flex items-center gap-3"><StatusBadge status={o.status} /><SuspendButton orgId={o.id} suspended={o.status === 'suspended'} group={g.key.startsWith('phone:') ? `phone ${g.label}` : g.key.startsWith('signup_ip:') ? g.label : `domain ${g.label}`} name={o.name} /></span>
                                        </li>
                                    ))}
                                </ul>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}
        </>
    );
}
