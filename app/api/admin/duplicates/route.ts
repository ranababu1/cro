import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { findDuplicateGroups } from '@/lib/duplicates';

// GET /api/admin/duplicates - Accounts that share a phone, a hashed sign-up IP or a domain. Platform admins only.
export async function GET() {
    const admin = await requirePlatformAdmin();
    if (admin instanceof NextResponse) return admin;
    return NextResponse.json({ groups: await findDuplicateGroups() });
}
