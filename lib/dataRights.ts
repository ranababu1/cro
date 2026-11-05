import { createHash } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from './db/client';
import * as s from './db/schema';
import { db } from './db';
import { clearConfigCache } from './configCache';

/**
 * Data rights: export a user's account data, delete a user's account, delete a project and erase one website visitor.
 * Rows below an organization or project go with it through ON DELETE CASCADE, as for experiment deletion.
 */

/** A short hash of a visitor id, so the audit log records an erasure without keeping the id it erased. */
export const visitorRef = (visitorId: string) => createHash('sha256').update(`visitor:${visitorId}`).digest('hex').slice(0, 16);

/** Everything the account holds about the user, plus the organizations they own, as one JSON document. */
export async function exportAccount(userId: string) {
    const d = await getDb();
    const user = await db.getUser(userId);
    if (!user) return null;
    const { signup_ip_hash: _ip, ...profile } = user;
    void _ip;
    const memberships = await d.select({ org_id: s.memberships.org_id, role: s.memberships.role, joined_at: s.memberships.created_at, org_name: s.organizations.name, plan: s.organizations.plan })
        .from(s.memberships).innerJoin(s.organizations, eq(s.organizations.id, s.memberships.org_id)).where(eq(s.memberships.user_id, userId));
    const organizations = [];
    for (const m of memberships) {
        const projects = await d.select().from(s.projects).where(eq(s.projects.org_id, m.org_id));
        const projectIds = projects.map((p) => p.id);
        const experiments = projectIds.length ? await d.select().from(s.experiments).where(inArray(s.experiments.project_id, projectIds)) : [];
        const expIds = experiments.map((e) => e.id);
        organizations.push({
            id: m.org_id, name: m.org_name, plan: m.plan, role: m.role, joined_at: m.joined_at,
            members: m.role === 'owner' ? (await db.getOrgMembers(m.org_id)).map((x) => ({ email: x.email, name: x.name, role: x.role, joined_at: x.joined_at })) : undefined,
            projects: projects.map((p) => ({ id: p.id, name: p.name, created_at: p.created_at })),
            domains: projectIds.length ? (await d.select({ project_id: s.projectDomains.project_id, host: s.projectDomains.host }).from(s.projectDomains).where(inArray(s.projectDomains.project_id, projectIds))) : [],
            experiments: experiments.map((e) => ({ id: e.id, project_id: e.project_id, name: e.name, status: e.status, control_url: e.control_url, created_at: e.created_at })),
            variations: expIds.length ? await d.select({ id: s.variations.id, experiment_id: s.variations.experiment_id, name: s.variations.name, url: s.variations.url, weight: s.variations.weight, is_control: s.variations.is_control }).from(s.variations).where(inArray(s.variations.experiment_id, expIds)) : [],
            goals: expIds.length ? await d.select({ id: s.goals.id, experiment_id: s.goals.experiment_id, name: s.goals.name, type: s.goals.type, selector: s.goals.selector }).from(s.goals).where(inArray(s.goals.experiment_id, expIds)) : [],
        });
    }
    const tickets = await d.select().from(s.supportTickets).where(eq(s.supportTickets.user_id, userId));
    const messages = tickets.length ? await d.select().from(s.supportMessages).where(inArray(s.supportMessages.ticket_id, tickets.map((t) => t.id))) : [];
    const activity = await d.select({ at: s.productEvents.occurred_at, action: s.productEvents.action }).from(s.productEvents).where(eq(s.productEvents.user_id, userId)).limit(5000);
    return {
        exported_at: new Date().toISOString(),
        note: 'Account data for this user. Results data (visitor counts and conversions) is available per test as CSV from the results page.',
        profile,
        organizations,
        support_tickets: tickets.map((t) => ({ ...t, messages: messages.filter((m) => m.ticket_id === t.id).map((m) => ({ from_staff: m.from_staff, body: m.body, created_at: m.created_at })) })),
        activity,
    };
}

export type DeleteAccountCheck = { ok: true; deleteOrgs: string[]; keepOrgs: string[] } | { ok: false; error: string };

/**
 * What deleting the account would do. Organizations where the user is the only member are deleted with all their data.
 * Where others remain, the user leaves; if they are the last owner there, they must make someone else owner first.
 */
export async function planAccountDeletion(userId: string): Promise<DeleteAccountCheck> {
    const d = await getDb();
    const orgIds = (await d.select({ org_id: s.memberships.org_id }).from(s.memberships).where(eq(s.memberships.user_id, userId))).map((r) => r.org_id);
    const deleteOrgs: string[] = [];
    const keepOrgs: string[] = [];
    for (const orgId of orgIds) {
        const members = await db.getOrgMembers(orgId);
        if (members.length <= 1) { deleteOrgs.push(orgId); continue; }
        const owners = members.filter((m) => m.role === 'owner');
        if (owners.length === 1 && owners[0].user_id === userId) {
            const org = await db.getOrganization(orgId);
            return { ok: false, error: `You are the only owner of ${org?.name ?? 'an organization'} and it has other members. Make another member an owner in Team and projects first, or remove the other members.` };
        }
        keepOrgs.push(orgId);
    }
    return { ok: true, deleteOrgs, keepOrgs };
}

/** Deletes the user. Returns an error when an organization would be left without an owner. */
export async function deleteAccount(userId: string): Promise<{ ok: true; deletedOrgs: number } | { ok: false; error: string }> {
    const plan = await planAccountDeletion(userId);
    if (!plan.ok) return plan;
    const d = await getDb();
    for (const orgId of plan.keepOrgs) {
        // Tests the user created stay with the organization; they now belong to one of its owners.
        const heir = (await db.getOrgMembers(orgId)).find((m) => m.role === 'owner' && m.user_id !== userId);
        if (heir) {
            await d.run(sql`update experiments set user_id = ${heir.user_id} where user_id = ${userId} and project_id in (select id from projects where org_id = ${orgId})`);
        }
        await db.audit({ orgId, actorId: null, entity: 'member', entityId: userId, action: 'account_deleted' });
    }
    if (plan.deleteOrgs.length) await d.delete(s.organizations).where(inArray(s.organizations.id, plan.deleteOrgs));
    await d.delete(s.productEvents).where(eq(s.productEvents.user_id, userId));
    await d.delete(s.telemetryDaily).where(and(eq(s.telemetryDaily.scope_type, 'user'), eq(s.telemetryDaily.scope_id, userId)));
    await d.delete(s.users).where(eq(s.users.id, userId));
    clearConfigCache();
    return { ok: true, deletedOrgs: plan.deleteOrgs.length };
}

/** Deletes a project and everything in it. The last project of an organization cannot be deleted. */
export async function deleteProject(orgId: string, projectId: string): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
    const projects = await db.getOrgProjects(orgId);
    if (!projects.some((p) => p.id === projectId)) return { ok: false, error: 'Project not found', status: 404 };
    if (projects.length <= 1) return { ok: false, error: 'An organization keeps at least one project. Delete your account instead to remove everything.', status: 400 };
    const d = await getDb();
    await d.delete(s.projects).where(and(eq(s.projects.id, projectId), eq(s.projects.org_id, orgId)));
    clearConfigCache();
    return { ok: true };
}

/**
 * Erases one website visitor from a project: their test assignments, events and monthly visitor record.
 * Aggregated results (daily totals) hold no visitor ids and stay as they are.
 */
export async function eraseVisitor(orgId: string, projectId: string, visitorId: string): Promise<{ assignments: number; events: number }> {
    const d = await getDb();
    const inProject = sql`(select id from experiments where project_id = ${projectId})`;
    const a = await d.run(sql`delete from assignments where user_id = ${visitorId} and experiment_id in ${inProject}`);
    const e = await d.run(sql`delete from events where user_id = ${visitorId} and experiment_id in ${inProject}`);
    await d.run(sql`delete from org_visitors_monthly where org_id = ${orgId} and user_id = ${visitorId}`);
    return { assignments: Number(a.rowsAffected) || 0, events: Number(e.rowsAffected) || 0 };
}
