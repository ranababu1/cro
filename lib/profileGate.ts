import { NextResponse } from 'next/server';
import { db } from './db';
import { isProfileComplete, PROFILE_REQUIRED_MESSAGE } from './profile';
import { isPlatformAdminEmail } from './platformAdmin';
import { isSuperAdminEmail } from './entitlements';

export function isProfileExempt(email: string | null | undefined): boolean {
    return isPlatformAdminEmail(email) || isSuperAdminEmail(email);
}

type Ctx = { userId: string | null; orgIds: string[] };

/**
 * Creating or starting an experiment needs a completed profile (first name, last name, country).
 * Session users are checked directly; platform admins are exempt. Secret-key calls pass when a
 * member of the key's org has a completed profile or is an admin.
 */
export async function profileGate(ctx: Ctx): Promise<NextResponse | null> {
    if (ctx.userId) {
        const u = await db.getUser(ctx.userId);
        if (u && (isProfileExempt(u.email) || isProfileComplete(u))) return null;
    } else {
        for (const orgId of ctx.orgIds) {
            const members = await db.getOrgMembers(orgId);
            if (members.some((m) => isProfileExempt(m.email) || isProfileComplete(m))) return null;
        }
    }
    return NextResponse.json({ error: PROFILE_REQUIRED_MESSAGE, reason: 'profile_incomplete', profile_url: '/settings/profile' }, { status: 403 });
}
