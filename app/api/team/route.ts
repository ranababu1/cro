import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getOrgEntitlements } from '@/lib/entitlements';
import { seatUsage, teamContext } from '@/lib/team';

/** GET /api/team: the current organization's members, open invites, projects and the plan's seat and project limits. */
export async function GET(request: NextRequest) {
    try {
        const t = await teamContext(request);
        if (t instanceof NextResponse) return t;
        const [org, seats, projects, ent] = await Promise.all([db.getOrganization(t.orgId), seatUsage(t.orgId), db.getOrgProjects(t.orgId), getOrgEntitlements(t.orgId)]);
        const owner = t.role === 'owner';
        return NextResponse.json({
            organization: org?.name ?? null,
            role: t.role,
            members: seats.members.map((m) => ({ user_id: m.user_id, name: m.name, email: m.email, role: m.role, joined_at: m.joined_at, you: m.user_id === t.userId })),
            // Members see that invites exist; only owners see who made them.
            invites: seats.invites.map((i) => ({ id: i.id, role: i.role, created_at: i.created_at, expires_at: i.expires_at, created_by: owner ? (i.created_by_name || i.created_by_email) : null })),
            seats: { used: seats.used, limit: seats.limit },
            projects: { used: projects.length, limit: ent.limits.projects, list: projects.map((p) => ({ id: p.id, name: p.name, created_at: p.created_at, current: p.id === t.projectId })) },
        });
    } catch (error) {
        console.error('Failed to load team:', error);
        return NextResponse.json({ error: 'Failed to load your team' }, { status: 500 });
    }
}
