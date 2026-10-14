import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

/**
 * Platform super-admins run the hosted service. This role is separate from org roles (owner, member)
 * and is granted only through the PLATFORM_ADMIN_EMAILS env var (comma separated). Removing an email
 * from the variable removes access on the next request.
 */
export function platformAdminEmails(): string[] {
    return (process.env.PLATFORM_ADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
    return !!email && platformAdminEmails().includes(email.toLowerCase());
}

export interface PlatformAdmin {
    userId: string;
    email: string;
}

/** Returns the signed-in platform admin, or null. Secret keys never grant platform admin. */
export async function getPlatformAdmin(): Promise<PlatformAdmin | null> {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    const userId = session?.user?.id;
    if (!email || !userId || !isPlatformAdminEmail(email)) return null;
    return { userId, email };
}

/** For API routes: the admin, or a 404 response so the console's existence is not revealed. */
export async function requirePlatformAdmin(): Promise<PlatformAdmin | NextResponse> {
    const admin = await getPlatformAdmin();
    return admin ?? NextResponse.json({ error: 'Not found' }, { status: 404 });
}
