import Link from 'next/link';
import { listTenants } from '@/lib/admin';

const fmt = (n: number | null) => (n === null ? 'Unlimited' : n.toLocaleString());

export default async function AdminHome() {
    const tenants = await listTenants();
    return (
        <div className="space-y-4">
            <h1 className="text-3xl font-bold">Tenants ({tenants.length})</h1>
            <div className="overflow-x-auto">
                <table className="table table-zebra">
                    <thead>
                        <tr>
                            <th>Organization</th><th>Status</th><th>Plan</th><th>Members</th><th>Projects</th>
                            <th>Experiments (running)</th><th>Visitors this month / limit</th><th>Events this month</th><th>Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tenants.map(({ org, members, projects, usage }) => (
                            <tr key={org.id}>
                                <td><Link className="link" href={`/admin/orgs/${org.id}`}>{org.name}</Link><div className="text-xs opacity-60">{org.slug}</div></td>
                                <td><span className={`badge ${org.status === 'active' ? 'badge-success' : 'badge-error'}`}>{org.status}</span></td>
                                <td>{org.plan}</td>
                                <td>{members.map((m) => m.email).join(', ')}</td>
                                <td>{projects.length}</td>
                                <td>{usage.total.experiments} ({usage.total.running})</td>
                                <td>{usage.month.visitors.toLocaleString()} / {fmt(org.monthly_visitor_limit)}</td>
                                <td>{usage.month.events.toLocaleString()}</td>
                                <td>{new Date(org.created_at).toLocaleDateString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
