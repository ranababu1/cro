import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { profileSchema, isProfileComplete } from '@/lib/profile';
import { isProfileExempt } from '@/lib/profileGate';
import { formatZodError } from '@/lib/validation';

export async function PUT(request: NextRequest) {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    if (!ctx.userId) return NextResponse.json({ error: 'Sign in to edit your profile' }, { status: 401 });
    const parsed = profileSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    await db.updateUserProfile(ctx.userId, parsed.data);
    return NextResponse.json({ ok: true, profile: parsed.data });
}

export async function GET(request: NextRequest) {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    if (!ctx.userId) return NextResponse.json({ error: 'Sign in to view your profile' }, { status: 401 });
    const u = await db.getUser(ctx.userId);
    if (!u) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { first_name, last_name, country, phone, company, job_role, company_size, heard_from, primary_goal, marketing_opt_in } = u;
    const complete = isProfileComplete(u) || isProfileExempt(u.email);
    return NextResponse.json({ complete, profile: { first_name, last_name, country, phone, company, job_role, company_size, heard_from, primary_goal, marketing_opt_in } });
}
