import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from './db/client';
import * as s from './db/schema';
import { generateId } from './ids';
import { notifyOps } from './alerts';

/**
 * Support tickets. A signed-in user opens a ticket for their organization; members of that organization see and
 * answer its tickets; platform admins answer every ticket from /admin/support. Status: open (waiting for us),
 * waiting (we answered, waiting for the customer), closed. A customer reply reopens a ticket.
 * New tickets and customer replies are announced on the operations webhook when OPS_ALERT_WEBHOOK_URL is set.
 */
export const TICKET_CATEGORIES = ['question', 'bug', 'billing', 'privacy', 'security', 'other'] as const;
export const TICKET_STATUSES = ['open', 'waiting', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const CATEGORY_LABELS: Record<(typeof TICKET_CATEGORIES)[number], string> = {
    question: 'Question', bug: 'Something is broken', billing: 'Plans and billing', privacy: 'Privacy or data request', security: 'Security', other: 'Other',
};
/** Open tickets per organization, so one account cannot flood the queue. */
export const MAX_OPEN_TICKETS = 10;
export const MAX_BODY = 5000;

export const newTicketSchema = z.object({
    subject: z.string().trim().min(3, 'Add a short subject').max(150),
    category: z.enum(TICKET_CATEGORIES).default('question'),
    body: z.string().trim().min(10, 'Describe the problem in a sentence or two').max(MAX_BODY),
}).strict();

export const replySchema = z.object({
    body: z.string().trim().min(1, 'Write a reply').max(MAX_BODY),
    status: z.enum(TICKET_STATUSES).optional(),
}).strict();

const nowIso = () => new Date().toISOString();

export async function createTicket(input: { orgId: string; userId: string; subject: string; category: (typeof TICKET_CATEGORIES)[number]; body: string }) {
    const d = await getDb();
    const open = await d.select({ n: sql<number>`count(*)` }).from(s.supportTickets).where(and(eq(s.supportTickets.org_id, input.orgId), inArray(s.supportTickets.status, ['open', 'waiting'])));
    if (Number(open[0]?.n) >= MAX_OPEN_TICKETS) return { error: `Your organization has ${MAX_OPEN_TICKETS} open tickets. Close one, or reply on an existing ticket.` } as const;
    const id = generateId('tkt');
    const at = nowIso();
    await d.batch([
        d.insert(s.supportTickets).values({ id, org_id: input.orgId, user_id: input.userId, subject: input.subject, category: input.category, status: 'open', created_at: at, updated_at: at }),
        d.insert(s.supportMessages).values({ id: generateId('tkm'), ticket_id: id, author_id: input.userId, from_staff: false, body: input.body, created_at: at }),
    ]);
    void notifyOps(`New support ticket (${input.category}): ${input.subject}`, { ticket_id: id, org_id: input.orgId });
    return { id } as const;
}

export async function listOrgTickets(orgIds: string[]) {
    if (!orgIds.length) return [];
    const d = await getDb();
    return d.select().from(s.supportTickets).where(inArray(s.supportTickets.org_id, orgIds)).orderBy(desc(s.supportTickets.updated_at)).limit(200);
}

/** Every ticket for the admin queue, open first, then waiting, then closed; newest activity first within each. */
export async function listAllTickets(status?: TicketStatus) {
    const d = await getDb();
    const q = d.select({
        id: s.supportTickets.id, subject: s.supportTickets.subject, category: s.supportTickets.category, status: s.supportTickets.status,
        created_at: s.supportTickets.created_at, updated_at: s.supportTickets.updated_at, org_id: s.supportTickets.org_id,
        org_name: s.organizations.name, org_plan: s.organizations.plan, user_email: s.users.email,
    }).from(s.supportTickets)
        .innerJoin(s.organizations, eq(s.organizations.id, s.supportTickets.org_id))
        .leftJoin(s.users, eq(s.users.id, s.supportTickets.user_id));
    const rows = await (status ? q.where(eq(s.supportTickets.status, status)) : q).orderBy(desc(s.supportTickets.updated_at)).limit(500);
    const rank: Record<string, number> = { open: 0, waiting: 1, closed: 2 };
    return rows.sort((a, b) => rank[a.status] - rank[b.status]);
}

export async function getTicket(id: string) {
    const d = await getDb();
    const ticket = (await d.select().from(s.supportTickets).where(eq(s.supportTickets.id, id)).limit(1))[0];
    if (!ticket) return null;
    const messages = await d.select({
        id: s.supportMessages.id, body: s.supportMessages.body, from_staff: s.supportMessages.from_staff, created_at: s.supportMessages.created_at,
        author_name: s.users.name, author_email: s.users.email,
    }).from(s.supportMessages).leftJoin(s.users, eq(s.users.id, s.supportMessages.author_id))
        .where(eq(s.supportMessages.ticket_id, id)).orderBy(asc(s.supportMessages.created_at));
    return { ticket, messages };
}

/**
 * Adds a message. A staff reply sets the ticket to waiting (or the status given); a customer reply sets it to open,
 * or closed when the customer closes it.
 */
export async function addReply(input: { ticketId: string; authorId: string | null; fromStaff: boolean; body: string; status?: TicketStatus }) {
    const d = await getDb();
    const at = nowIso();
    const status: TicketStatus = input.status ?? (input.fromStaff ? 'waiting' : 'open');
    await d.batch([
        d.insert(s.supportMessages).values({ id: generateId('tkm'), ticket_id: input.ticketId, author_id: input.authorId, from_staff: input.fromStaff, body: input.body, created_at: at }),
        d.update(s.supportTickets).set({ status, updated_at: at }).where(eq(s.supportTickets.id, input.ticketId)),
    ]);
    if (!input.fromStaff && status === 'open') void notifyOps('Customer replied on a support ticket', { ticket_id: input.ticketId });
    return status;
}

export async function setTicketStatus(ticketId: string, status: TicketStatus) {
    const d = await getDb();
    await d.update(s.supportTickets).set({ status, updated_at: nowIso() }).where(eq(s.supportTickets.id, ticketId));
}
