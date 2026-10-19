import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { teamContext } from '@/lib/team';

/** DELETE /api/team/invites/[id]: cancel an open invite. The link stops working at once. Owners only. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const t = await teamContext(request, { owner: true });
    if (t instanceof NextResponse) return t;
    const { id } = await params;
    if (!(await db.revokeInvite(t.orgId, id))) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    await db.audit({ orgId: t.orgId, actorId: t.userId, entity: 'member', entityId: id, action: 'invite:revoke' });
    return NextResponse.json({ ok: true });
}
