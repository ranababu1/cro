import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';

export async function POST(request: NextRequest) {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    if (!ctx.userId) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
    await db.dismissProfilePrompt(ctx.userId);
    return NextResponse.json({ ok: true });
}
