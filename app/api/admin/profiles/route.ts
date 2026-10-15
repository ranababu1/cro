import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { db } from '@/lib/db';
import { csvCell } from '@/lib/profile';

const COLUMNS = ['user_id', 'email', 'first_name', 'last_name', 'country', 'phone', 'company', 'job_role', 'company_size', 'heard_from', 'primary_goal', 'marketing_opt_in', 'profile_completed_at', 'signed_up_at', 'org_id', 'org_name', 'plan'] as const;

// GET /api/admin/profiles - CSV export of user profiles. Platform admins only.
export async function GET() {
    const admin = await requirePlatformAdmin();
    if (admin instanceof NextResponse) return admin;
    const rows = await db.listUserProfiles();
    const lines = [COLUMNS.join(',')];
    for (const { user: u, org_id, org_name, plan } of rows) {
        const rec: Record<(typeof COLUMNS)[number], unknown> = {
            user_id: u.id, email: u.email, first_name: u.first_name, last_name: u.last_name, country: u.country, phone: u.phone,
            company: u.company, job_role: u.job_role, company_size: u.company_size, heard_from: u.heard_from, primary_goal: u.primary_goal,
            marketing_opt_in: u.marketing_opt_in ? 'yes' : 'no', profile_completed_at: u.profile_completed_at, signed_up_at: u.created_at,
            org_id, org_name, plan,
        };
        lines.push(COLUMNS.map((c) => csvCell(rec[c])).join(','));
    }
    return new NextResponse(lines.join('\r\n') + '\r\n', {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="profiles-${new Date().toISOString().slice(0, 10)}.csv"`,
            'Cache-Control': 'no-store',
        },
    });
}
