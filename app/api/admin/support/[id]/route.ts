import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { formatZodError } from '@/lib/validation';
import { addReply, getTicket, replySchema, setTicketStatus, TICKET_STATUSES } from '@/lib/support';

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/support/[id] { body, status? }: a staff reply (status defaults to waiting). Platform admins only. */
export async function POST(request: NextRequest, { params }: Params) {
    const admin = await requirePlatformAdmin();
    if (admin instanceof NextResponse) return admin;
    const t = await getTicket((await params).id);
    if (!t) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    const parsed = replySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    const status = await addReply({ ticketId: t.ticket.id, authorId: admin.userId, fromStaff: true, body: parsed.data.body, status: parsed.data.status });
    return NextResponse.json({ status });
}

/** PATCH /api/admin/support/[id] { status }: changes the status without a message. */
export async function PATCH(request: NextRequest, { params }: Params) {
    const admin = await requirePlatformAdmin();
    if (admin instanceof NextResponse) return admin;
    const t = await getTicket((await params).id);
    if (!t) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    const body = await request.json().catch(() => null) as { status?: unknown } | null;
    if (!TICKET_STATUSES.includes(body?.status as never)) return NextResponse.json({ error: 'status must be open, waiting or closed' }, { status: 400 });
    await setTicketStatus(t.ticket.id, body!.status as (typeof TICKET_STATUSES)[number]);
    return NextResponse.json({ status: body!.status });
}
