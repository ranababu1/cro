import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { PROJECT_COOKIE } from '@/lib/currentProject';
import { acceptSchema, hashInviteToken, inviteState, seatLimitMessage, seatUsage } from '@/lib/team';

const GONE: Record<string, string> = {
    used: 'This invite link was already used. Ask an owner for a new one.',
    revoked: 'This invite was cancelled. Ask an owner for a new one.',
    expired: 'This invite link expired. Ask an owner for a new one.',
    unknown: 'This invite link is not valid.',
};

/** POST /api/invites/accept { token }: join the organization as the signed-in user. */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const userId = session?.user?.id;
        if (!userId) return NextResponse.json({ error: 'Sign in to accept the invite' }, { status: 401 });
        const parsed = acceptSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: GONE.unknown }, { status: 400 });
        const invite = await db.getInviteByHash(hashInviteToken(parsed.data.token));
        const state = inviteState(invite);
        if (!invite || state !== 'open') return NextResponse.json({ error: GONE[state] }, { status: 410 });
        const org = await db.getOrganization(invite.org_id);
        if (!org || org.status !== 'active') return NextResponse.json({ error: 'This organization is not available' }, { status: 403 });
        const projects = await db.getOrgProjects(invite.org_id);
        const res = (body: unknown) => {
            const r = NextResponse.json(body);
            if (projects[0]) r.cookies.set(PROJECT_COOKIE, projects[0].id, { path: '/', maxAge: 31_536_000, sameSite: 'lax' });
            return r;
        };
        if (await db.getMembership(invite.org_id, userId)) return res({ ok: true, already_member: true, organization: org.name });
        // The invite holds a seat; it is released as the member takes it. Only the open-invite check guards a race.
        const seats = await seatUsage(invite.org_id);
        if (seats.limit !== null && seats.members.length >= seats.limit) return NextResponse.json({ error: seatLimitMessage(seats.limit) }, { status: 403 });
        if (!(await db.claimInvite(invite.id, userId))) return NextResponse.json({ error: GONE.used }, { status: 410 });
        await db.addMember(invite.org_id, userId, invite.role);
        await db.audit({ orgId: invite.org_id, actorId: userId, entity: 'member', entityId: userId, action: 'join', diff: { role: invite.role, invite: invite.id } });
        return res({ ok: true, organization: org.name });
    } catch (error) {
        console.error('Failed to accept invite:', error);
        return NextResponse.json({ error: 'Failed to accept the invite' }, { status: 500 });
    }
}
