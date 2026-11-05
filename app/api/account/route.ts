import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/lib/requestAuth';
import { db } from '@/lib/db';
import { deleteAccount, planAccountDeletion } from '@/lib/dataRights';

async function sessionUser(request: NextRequest) {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    if (ctx.via !== 'session' || !ctx.userId) return NextResponse.json({ error: 'Manage your account from the dashboard' }, { status: 403 });
    return ctx.userId;
}

/** GET /api/account: what deleting the account would remove (organizations deleted or left). */
export async function GET(request: NextRequest) {
    const userId = await sessionUser(request);
    if (userId instanceof NextResponse) return userId;
    const plan = await planAccountDeletion(userId);
    if (!plan.ok) return NextResponse.json({ can_delete: false, error: plan.error });
    const names = async (ids: string[]) => (await Promise.all(ids.map((id) => db.getOrganization(id)))).map((o) => o?.name ?? '');
    return NextResponse.json({ can_delete: true, deletes: await names(plan.deleteOrgs), leaves: await names(plan.keepOrgs) });
}

/** DELETE /api/account { confirm: "<your email>" }: deletes the account. Signed-in session only. Cannot be undone. */
export async function DELETE(request: NextRequest) {
    const userId = await sessionUser(request);
    if (userId instanceof NextResponse) return userId;
    const user = await db.getUser(userId);
    if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    const body = await request.json().catch(() => null) as { confirm?: unknown } | null;
    if (typeof body?.confirm !== 'string' || body.confirm.trim().toLowerCase() !== user.email.toLowerCase()) {
        return NextResponse.json({ error: 'Type your email address to confirm' }, { status: 400 });
    }
    const r = await deleteAccount(userId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });
    return NextResponse.json({ deleted: true, organizations_deleted: r.deletedOrgs });
}
