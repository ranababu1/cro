import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/lib/requestAuth';
import { formatZodError } from '@/lib/validation';
import { addReply, getTicket, replySchema } from '@/lib/support';

type Params = { params: Promise<{ id: string }> };

async function load(request: NextRequest, id: string) {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    if (ctx.via !== 'session' || !ctx.userId) return NextResponse.json({ error: 'Open support from the dashboard' }, { status: 403 });
    const t = await getTicket(id);
    // Tickets of other organizations answer 404, so ids cannot be probed.
    if (!t || !ctx.orgIds.includes(t.ticket.org_id)) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    return { userId: ctx.userId, ...t };
}

/** GET /api/support/tickets/[id]: the ticket and its messages. Members of the ticket's organization only. */
export async function GET(request: NextRequest, { params }: Params) {
    const r = await load(request, (await params).id);
    if (r instanceof NextResponse) return r;
    return NextResponse.json({ ticket: r.ticket, messages: r.messages.map((m) => ({ ...m, author_email: m.from_staff ? null : m.author_email, author_name: m.from_staff ? 'Support' : m.author_name })) });
}

/** POST /api/support/tickets/[id] { body, status? }: replies (reopens the ticket), or closes it with status "closed". */
export async function POST(request: NextRequest, { params }: Params) {
    const r = await load(request, (await params).id);
    if (r instanceof NextResponse) return r;
    const parsed = replySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    if (parsed.data.status && parsed.data.status !== 'closed') return NextResponse.json({ error: 'You can only close a ticket' }, { status: 400 });
    const status = await addReply({ ticketId: r.ticket.id, authorId: r.userId, fromStaff: false, body: parsed.data.body, status: parsed.data.status });
    return NextResponse.json({ status });
}
