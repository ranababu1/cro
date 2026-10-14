import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTenantSummary } from '@/lib/admin';
import { db } from '@/lib/db';
import TenantControls from './TenantControls';

export default async function TenantDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const tenant = await getTenantSummary(id);
    if (!tenant) notFound();
    const audit = await db.getAuditLog(id, 50);
    const { org, members, projects, usage } = tenant;

    return (
        <div className="space-y-6">
            <Link href="/admin" className="link">All tenants</Link>
            <h1 className="text-3xl font-bold">{org.name}</h1>
            <div className="stats bg-base-200">
                <div className="stat"><div className="stat-title">Status</div><div className="stat-value text-lg">{org.status}</div>
                    {org.suspended_reason && <div className="stat-desc">{org.suspended_reason}</div>}</div>
                <div className="stat"><div className="stat-title">Visitors this month</div><div className="stat-value text-lg">{usage.month.visitors}</div></div>
                <div className="stat"><div className="stat-title">Events this month</div><div className="stat-value text-lg">{usage.month.events}</div></div>
                <div className="stat"><div className="stat-title">Experiments</div><div className="stat-value text-lg">{usage.total.experiments}</div><div className="stat-desc">{usage.total.running} running</div></div>
                <div className="stat"><div className="stat-title">All-time visitors / events</div><div className="stat-value text-lg">{usage.total.visitors} / {usage.total.events}</div></div>
            </div>

            <TenantControls org={org} />

            <div className="grid md:grid-cols-2 gap-6">
                <div className="card bg-base-200"><div className="card-body">
                    <h2 className="card-title">Members</h2>
                    <ul>{members.map((m) => <li key={m.user_id}>{m.email} <span className="badge badge-sm">{m.role}</span></li>)}</ul>
                </div></div>
                <div className="card bg-base-200"><div className="card-body">
                    <h2 className="card-title">Projects</h2>
                    <ul>{projects.map((p) => <li key={p.id}>{p.name} <span className="text-xs opacity-60">{p.id}</span></li>)}</ul>
                </div></div>
            </div>

            <div className="card bg-base-200"><div className="card-body">
                <h2 className="card-title">Audit log</h2>
                <table className="table table-sm">
                    <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th></tr></thead>
                    <tbody>{audit.map((a) => (
                        <tr key={a.id}><td>{new Date(a.created_at).toLocaleString()}</td><td>{a.actor_id ?? 'system'}</td><td>{a.action}</td><td>{a.entity} {a.entity_id}</td></tr>
                    ))}</tbody>
                </table>
            </div></div>
        </div>
    );
}
