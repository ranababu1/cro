import { NextRequest, NextResponse } from 'next/server';
import { teamContext } from '@/lib/team';
import { requireUserContext } from '@/lib/requestAuth';
import { formatZodError } from '@/lib/validation';
import { createTicket, listOrgTickets, newTicketSchema } from '@/lib/support';

/** GET /api/support/tickets: tickets of the caller's organizations, newest activity first. */
export async function GET(request: NextRequest) {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    if (ctx.via !== 'session') return NextResponse.json({ error: 'Open support from the dashboard' }, { status: 403 });
    return NextResponse.json({ tickets: await listOrgTickets(ctx.orgIds) });
}

/** POST /api/support/tickets { subject, category, body }: opens a ticket for the current organization. */
export async function POST(request: NextRequest) {
    const t = await teamContext(request);
    if (t instanceof NextResponse) return t;
    const parsed = newTicketSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    const r = await createTicket({ orgId: t.orgId, userId: t.userId, ...parsed.data });
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: 429 });
    return NextResponse.json({ id: r.id }, { status: 201 });
}
