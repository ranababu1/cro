import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { listTenants } from '@/lib/admin';

// GET /api/admin/orgs - All tenants with members, projects and usage. Platform admins only.
export async function GET() {
    const admin = await requirePlatformAdmin();
    if (admin instanceof NextResponse) return admin;
    return NextResponse.json({ tenants: await listTenants() });
}
