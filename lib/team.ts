import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from './db';
import { requireUserContext } from './requestAuth';
import { orgIdForProject } from './access';
import { getOrgEntitlements } from './entitlements';
import { PROJECT_COOKIE } from './currentProject';
import { publicAppOrigin } from './publicOrigin';

/**
 * Teams: owners invite people with a single-use secret link (no email is sent) and manage roles and projects.
 * Members use everything else. Seats count members plus open invites, so an invite always has a seat waiting.
 * Downgrades keep existing members and projects; only new invites and projects are blocked above the plan.
 */
export const INVITE_TTL_DAYS = 7;
export const ROLES = ['owner', 'member'] as const;
export type Role = (typeof ROLES)[number];

export const inviteSchema = z.object({ role: z.enum(ROLES).default('member') });
export const roleSchema = z.object({ role: z.enum(ROLES) });
export const projectNameSchema = z.object({ name: z.string().trim().min(1, 'Give the project a name').max(80, 'Use up to 80 characters') });
export const acceptSchema = z.object({ token: z.string().min(20).max(200) });

export const hashInviteToken = (token: string) => createHash('sha256').update(`invite:${token}`).digest('hex');
export function newInviteToken(): string {
    return `inv_${randomBytes(24).toString('base64url')}`;
}
export const inviteUrl = (token: string) => `${publicAppOrigin()}/invite/${token}`;
export const inviteExpiry = (now = Date.now()) => new Date(now + INVITE_TTL_DAYS * 86_400_000).toISOString();

export async function seatUsage(orgId: string) {
    const [members, invites, ent] = await Promise.all([db.getOrgMembers(orgId), db.listPendingInvites(orgId), getOrgEntitlements(orgId)]);
    return { members, invites, used: members.length + invites.length, limit: ent.limits.seats };
}

export function seatLimitMessage(limit: number): string {
    return limit === 1
        ? 'Your plan includes 1 seat. Upgrade to Starter for 5 seats, or Growth for 15.'
        : `Your plan includes ${limit} seats, and members plus open invites use them all. Remove a member or an invite, or upgrade for more.`;
}
export function projectLimitMessage(limit: number): string {
    return limit === 1
        ? 'Your plan includes 1 project. Upgrade to Starter for 3 projects, or Growth for 10.'
        : `Your plan includes ${limit} projects. Upgrade for more.`;
}

/** Status of an invite for the invite page. */
export type InviteState = 'open' | 'used' | 'revoked' | 'expired' | 'unknown';
export function inviteState(inv: { accepted_at: string | null; revoked_at: string | null; expires_at: string } | null, nowIso = new Date().toISOString()): InviteState {
    if (!inv) return 'unknown';
    if (inv.accepted_at) return 'used';
    if (inv.revoked_at) return 'revoked';
    if (inv.expires_at <= nowIso) return 'expired';
    return 'open';
}

export interface TeamContext { userId: string; orgId: string; role: Role; projectId: string; projectIds: string[] }

/** Signed-in dashboard user (not a secret key) in the organization of the current project, with their role. */
export async function teamContext(request: NextRequest, opts: { owner?: boolean } = {}): Promise<TeamContext | NextResponse> {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    if (ctx.via !== 'session' || !ctx.userId) return NextResponse.json({ error: 'Manage your team from the dashboard' }, { status: 403 });
    const selected = request.cookies.get(PROJECT_COOKIE)?.value;
    const projectId = selected && ctx.projectIds.includes(selected) ? selected : ctx.projectIds[0];
    if (!projectId) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    const orgId = await orgIdForProject(projectId);
    const m = await db.getMembership(orgId, ctx.userId);
    if (!m) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    if (opts.owner && m.role !== 'owner') return NextResponse.json({ error: 'Only owners can do this' }, { status: 403 });
    return { userId: ctx.userId, orgId, role: m.role, projectId, projectIds: ctx.projectIds };
}

/** An owner may not remove or demote the last owner, so every organization keeps one. */
export async function isLastOwner(orgId: string, userId: string): Promise<boolean> {
    const members = await db.getOrgMembers(orgId);
    const owners = members.filter((m) => m.role === 'owner');
    return owners.length === 1 && owners[0].user_id === userId;
}
