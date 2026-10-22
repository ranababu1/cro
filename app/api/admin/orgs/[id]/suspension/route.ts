import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { setOrgSuspended } from '@/lib/suspension';

type Params = { params: Promise<{ id: string }> };

const Body = z.object({
    suspend: z.boolean(),
    reason: z.string().trim().max(500).nullable().optional(),
    group: z.string().trim().max(200).nullable().optional(),
});

// POST /api/admin/orgs/[id]/suspension - One-click suspend or unsuspend (duplicates view). Platform admins only.
export async function POST(request: NextRequest, { params }: Params) {
    const admin = await requirePlatformAdmin();
    if (admin instanceof NextResponse) return admin;
    const { id } = await params;
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Send suspend: true or false' }, { status: 400 });
    const res = await setOrgSuspended(id, parsed.data.suspend, admin, { reason: parsed.data.reason ?? null, group: parsed.data.group ?? null, source: 'duplicates' });
    if (!res) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(res);
}
