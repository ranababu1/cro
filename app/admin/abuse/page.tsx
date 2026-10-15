import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { listLedger, DOMAIN_FREE_TESTS } from '@/lib/domainLedger';
import { PageHeader, Card, CardHeader, CardBody, ButtonLink } from '@/app/components/ui';

export const metadata: Metadata = { title: 'Abuse and domain ledger' };
export const dynamic = 'force-dynamic';

const LABELS: Record<string, string> = {
    'abuse:domain_taken': 'Domain already on another free account',
    'abuse:domain_exhausted': 'Domain used all free tests',
    'abuse:domain_limit': 'Free domain limit reached',
    'abuse:origin_mismatch': 'SDK call from unregistered domain',
    'abuse:origin_missing': 'SDK call without Origin or Referer',
};

const when = (iso: string) => new Date(iso.endsWith('Z') || iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST';

function detail(diff: string | null): string {
    if (!diff) return '';
    try {
        const o = JSON.parse(diff) as Record<string, unknown>;
        return Object.entries(o).map(([k, v]) => `${k}: ${String(v)}`).join(', ');
    } catch {
        return '';
    }
}

export default async function AbusePage() {
    const [events, ledger] = await Promise.all([db.getAbuseLog(200), listLedger(200)]);
    return (
        <>
            <PageHeader
                title="Abuse and domain ledger"
                description={`Free accounts get one domain and ${DOMAIN_FREE_TESTS} lifetime tests per domain. Blocked attempts are listed here.`}
                actions={<ButtonLink href="/admin" variant="secondary" size="sm">Back to tenants</ButtonLink>}
            />
            <Card className="mb-6">
                <CardHeader title={`Abuse attempts (${events.length})`} />
                <CardBody>
                    {events.length === 0 ? <p className="text-sm text-zinc-500">No blocked attempts yet.</p> : (
                        <table className="w-full text-sm" data-testid="abuse-table">
                            <thead><tr className="text-left text-zinc-500"><th className="py-2">When</th><th>Type</th><th>Org</th><th>Details</th></tr></thead>
                            <tbody>
                                {events.map((e) => (
                                    <tr key={e.id} className="border-t border-zinc-100">
                                        <td className="py-2 whitespace-nowrap">{when(e.created_at)}</td>
                                        <td>{LABELS[e.action] ?? e.action}</td>
                                        <td>{e.org_id ? <Link className="text-blue-700 hover:underline" href={`/admin/orgs/${e.org_id}`}>{e.org_id.slice(0, 8)}</Link> : '-'}</td>
                                        <td className="text-zinc-600">{detail(e.diff)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardBody>
            </Card>
            <Card>
                <CardHeader title={`Domain ledger (${ledger.length})`} />
                <CardBody>
                    {ledger.length === 0 ? <p className="text-sm text-zinc-500">No free domains claimed yet.</p> : (
                        <table className="w-full text-sm" data-testid="ledger-table">
                            <thead><tr className="text-left text-zinc-500"><th className="py-2">Domain</th><th>Claimed by</th><th>Free tests used</th><th>Updated</th></tr></thead>
                            <tbody>
                                {ledger.map((l) => (
                                    <tr key={l.domain} className="border-t border-zinc-100">
                                        <td className="py-2 font-medium">{l.domain}</td>
                                        <td>{l.org_id ? <Link className="text-blue-700 hover:underline" href={`/admin/orgs/${l.org_id}`}>{l.org_id.slice(0, 8)}</Link> : 'Released'}</td>
                                        <td>{l.experiments_used} / {DOMAIN_FREE_TESTS}</td>
                                        <td>{when(l.updated_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardBody>
            </Card>
        </>
    );
}
