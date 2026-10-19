import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatZodError } from '@/lib/validation';
import { hashInviteToken, inviteExpiry, inviteSchema, inviteUrl, newInviteToken, seatLimitMessage, seatUsage, teamContext } from '@/lib/team';

/** Open invites per organization, whatever the plan, so links cannot pile up. */
export const MAX_OPEN_INVITES = 50;

/** POST /api/team/invites { role }: a single-use invite link, valid 7 days. Owners only. The link is shown once. */
export async function POST(request: NextRequest) {
    try {
        const t = await teamContext(request, { owner: true });
        if (t instanceof NextResponse) return t;
        const parsed = inviteSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        const seats = await seatUsage(t.orgId);
        if (seats.limit !== null && seats.used >= seats.limit) return NextResponse.json({ error: seatLimitMessage(seats.limit), reason: 'seat_limit' }, { status: 403 });
        if (seats.invites.length >= MAX_OPEN_INVITES) return NextResponse.json({ error: `Up to ${MAX_OPEN_INVITES} invites can be open at once. Cancel some first.` }, { status: 400 });
        const token = newInviteToken();
        const invite = await db.createInvite({ orgId: t.orgId, tokenHash: hashInviteToken(token), role: parsed.data.role, createdBy: t.userId, expiresAt: inviteExpiry() });
        await db.audit({ orgId: t.orgId, actorId: t.userId, entity: 'member', entityId: invite.id, action: 'invite:create', diff: { role: invite.role } });
        return NextResponse.json({ url: inviteUrl(token), invite: { id: invite.id, role: invite.role, created_at: invite.created_at, expires_at: invite.expires_at } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Failed to create invite:', error);
        return NextResponse.json({ error: 'Failed to create the invite' }, { status: 500 });
    }
}
