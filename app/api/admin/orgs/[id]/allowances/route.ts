import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { db } from '@/lib/db';
import { adminSpecialFriendSchema, parseAllowances } from '@/lib/allowances';
import { formatZodError } from '@/lib/validation';
import { clearPageviewCache } from '@/lib/pageviewQuota';
import { clearVisitorCache } from '@/lib/quotas';
import { getOrgEntitlements } from '@/lib/entitlements';

type Params = { params: Promise<{ id: string }> };

// PUT /api/admin/orgs/[id]/allowances - Special friend flag and custom allowances. Platform admins only. Audited.
export async function PUT(request: NextRequest, { params }: Params) {
    const admin = await requirePlatformAdmin();
    if (admin instanceof NextResponse) return admin;
    const { id } = await params;
    const org = await db.getOrganization(id);
    if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const parsed = adminSpecialFriendSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    const { special_friend, allowances } = parsed.data;
    const before = { special_friend: org.special_friend, allowances: parseAllowances(org.custom_allowances) };
    await db.updateOrganization(id, { special_friend, custom_allowances: JSON.stringify(allowances) });
    clearPageviewCache();
    clearVisitorCache();
    await db.audit({
        orgId: id, actorId: admin.userId, entity: 'organization', entityId: id, action: 'admin:special_friend',
        diff: { before, after: { special_friend, allowances }, by: admin.email },
    });
    return NextResponse.json({ special_friend, allowances, effective: await getOrgEntitlements(id) });
}
