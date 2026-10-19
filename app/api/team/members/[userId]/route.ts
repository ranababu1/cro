import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatZodError } from '@/lib/validation';
import { isLastOwner, roleSchema, teamContext } from '@/lib/team';

type Params = { params: Promise<{ userId: string }> };

/** PATCH /api/team/members/[userId] { role }: make someone an owner or a member. Owners only; the last owner stays. */
export async function PATCH(request: NextRequest, { params }: Params) {
    const t = await teamContext(request, { owner: true });
    if (t instanceof NextResponse) return t;
    const { userId } = await params;
    const parsed = roleSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    const m = await db.getMembership(t.orgId, userId);
    const email = (await db.getUser(userId))?.email ?? null;
    if (!m) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    if (m.role === parsed.data.role) return NextResponse.json({ ok: true });
    if (parsed.data.role === 'member' && (await isLastOwner(t.orgId, userId))) {
        return NextResponse.json({ error: 'An organization needs at least one owner. Make someone else an owner first.' }, { status: 400 });
    }
    await db.setMemberRole(t.orgId, userId, parsed.data.role);
    await db.audit({ orgId: t.orgId, actorId: t.userId, entity: 'member', entityId: userId, action: 'role', diff: { email, from: m.role, to: parsed.data.role } });
    return NextResponse.json({ ok: true });
}

/** DELETE /api/team/members/[userId]: owners remove anyone; anyone may leave. They lose access at once. */
export async function DELETE(request: NextRequest, { params }: Params) {
    const t = await teamContext(request);
    if (t instanceof NextResponse) return t;
    const { userId } = await params;
    const self = userId === t.userId;
    if (!self && t.role !== 'owner') return NextResponse.json({ error: 'Only owners can do this' }, { status: 403 });
    if (!(await db.getMembership(t.orgId, userId))) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    if (await isLastOwner(t.orgId, userId)) return NextResponse.json({ error: 'An organization needs at least one owner. Make someone else an owner first.' }, { status: 400 });
    const email = (await db.getUser(userId))?.email ?? null;
    await db.removeMember(t.orgId, userId);
    await db.audit({ orgId: t.orgId, actorId: t.userId, entity: 'member', entityId: userId, action: self ? 'leave' : 'remove', diff: { email } });
    return NextResponse.json({ ok: true });
}
