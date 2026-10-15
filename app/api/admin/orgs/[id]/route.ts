import { clearPageviewCache } from '@/lib/pageviewQuota';
import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { getTenantSummary } from '@/lib/admin';
import { db } from '@/lib/db';
import { adminUpdateOrgSchema, formatZodError } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/orgs/[id] - Tenant details. Platform admins only.
export async function GET(_request: NextRequest, { params }: Params) {
    const admin = await requirePlatformAdmin();
    if (admin instanceof NextResponse) return admin;
    const { id } = await params;
    const tenant = await getTenantSummary(id);
    if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const audit = await db.getAuditLog(id, 50);
    return NextResponse.json({ tenant, audit });
}

// PATCH /api/admin/orgs/[id] - Suspend, reactivate, or change plan and limits. Platform admins only.
export async function PATCH(request: NextRequest, { params }: Params) {
    const admin = await requirePlatformAdmin();
    if (admin instanceof NextResponse) return admin;
    const { id } = await params;
    const org = await db.getOrganization(id);
    if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const parsed = adminUpdateOrgSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    const update = parsed.data;

    await db.updateOrganization(id, update);
    clearPageviewCache();

    const before = {
        status: org.status,
        plan: org.plan,
        monthly_visitor_limit: org.monthly_visitor_limit,
        monthly_experiment_limit: org.monthly_experiment_limit,
        monthly_pageview_limit: org.monthly_pageview_limit,
    };
    let action = 'admin:update';
    if (update.status && update.status !== org.status) action = update.status === 'suspended' ? 'admin:suspend' : 'admin:reactivate';
    await db.audit({ orgId: id, actorId: admin.userId, entity: 'organization', entityId: id, action, diff: { before, after: update, by: admin.email } });

    return NextResponse.json({ tenant: await getTenantSummary(id) });
}
