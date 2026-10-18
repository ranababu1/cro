import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { PLUGIN_DOWNLOAD_LIMITS } from '@/lib/pluginDownload';
import { PageHeader, Card, CardHeader, CardBody, ButtonLink } from '@/app/components/ui';

export const metadata: Metadata = { title: 'Plugin downloads' };
export const dynamic = 'force-dynamic';

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST';

export default async function DownloadsPage() {
    const rows = await db.listPluginDownloads(300);
    return (
        <>
            <PageHeader
                title="Plugin downloads"
                description={`Every WordPress plugin zip served, newest first. Each zip carries its download id in license.txt. Limits: ${PLUGIN_DOWNLOAD_LIMITS.userPerHour} per user per hour, ${PLUGIN_DOWNLOAD_LIMITS.orgPerDay} per org per day.`}
                actions={<ButtonLink href="/admin" variant="secondary" size="sm">Back to tenants</ButtonLink>}
            />
            <Card>
                <CardHeader title={`Downloads (${rows.length})`} />
                <CardBody>
                    {rows.length === 0 ? <p className="text-sm text-zinc-500">No downloads yet.</p> : (
                        <table className="w-full text-sm" data-testid="downloads-table">
                            <thead><tr className="text-left text-zinc-500"><th className="py-2">When</th><th>Org</th><th>User</th><th>Version</th><th>Download id</th></tr></thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.id} className="border-t border-zinc-100">
                                        <td className="py-2 whitespace-nowrap">{when(r.created_at)}</td>
                                        <td><Link className="text-blue-700 hover:underline" href={`/admin/orgs/${r.org_id}`}>{r.org_name ?? r.org_id}</Link></td>
                                        <td>{r.user_email ?? '-'}</td>
                                        <td>{r.version}</td>
                                        <td className="font-mono text-xs text-zinc-600">{r.id}</td>
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
