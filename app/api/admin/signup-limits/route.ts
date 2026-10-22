import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { getSignupCaps, MAX_SIGNUP_CAP, setSignupCaps } from '@/lib/signupLimits';

const Body = z.object({
    perIp: z.number().int().min(1).max(MAX_SIGNUP_CAP),
    perRange: z.number().int().min(1).max(MAX_SIGNUP_CAP),
});

// GET /api/admin/signup-limits - Daily new-account caps. Platform admins only.
export async function GET() {
    const admin = await requirePlatformAdmin();
    if (admin instanceof NextResponse) return admin;
    return NextResponse.json({ caps: await getSignupCaps() });
}

// PUT /api/admin/signup-limits - Change the caps. Logged to the abuse log.
export async function PUT(request: NextRequest) {
    const admin = await requirePlatformAdmin();
    if (admin instanceof NextResponse) return admin;
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: `Caps must be whole numbers from 1 to ${MAX_SIGNUP_CAP}` }, { status: 400 });
    return NextResponse.json({ caps: await setSignupCaps(parsed.data, admin.userId) });
}
