import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/lib/requestAuth';
import { exportAccount } from '@/lib/dataRights';

/** GET /api/account/export: the signed-in user's account data as a JSON download. */
export async function GET(request: NextRequest) {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    if (ctx.via !== 'session' || !ctx.userId) return NextResponse.json({ error: 'Export your data from the dashboard' }, { status: 403 });
    const data = await exportAccount(ctx.userId);
    if (!data) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="freeabtest-account-${new Date().toISOString().slice(0, 10)}.json"`,
            'Cache-Control': 'no-store',
        },
    });
}
