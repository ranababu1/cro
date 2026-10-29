import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment, orgIdForProject } from '@/lib/access';
import { canUseFeature, getOrgEntitlements, UPGRADE_NOTE } from '@/lib/entitlements';
import { AUDIT_PAGE_SIZE, auditRetentionDays, decodeCursor, encodeCursor, presentAudit } from '@/lib/audit';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/experiments/[id]/history?cursor=: this test's audit entries, newest first, 50 per page. Read-only.
 * Same rule as the audit log: paid plans, inside the plan's audit period.
 */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const experiment = await getAccessibleExperiment(ctx, (await params).id);
        if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
        const orgId = await orgIdForProject(experiment.project_id);
        if (!(await canUseFeature(orgId, 'audit_log'))) {
            return NextResponse.json({ error: 'Test history needs a paid plan', upgrade: UPGRADE_NOTE.audit_log, reason: 'audit_log' }, { status: 403 });
        }
        const days = auditRetentionDays((await getOrgEntitlements(orgId)).plan);
        const since = new Date(Date.now() - days * 86_400_000).toISOString();
        const rows = await db.listAuditForEntity(orgId, 'experiment', experiment.id, { since, before: decodeCursor(request.nextUrl.searchParams.get('cursor')), limit: AUDIT_PAGE_SIZE + 1 });
        const page = rows.slice(0, AUDIT_PAGE_SIZE);
        return NextResponse.json({
            retention_days: days,
            entries: page.map(presentAudit),
            next_cursor: rows.length > AUDIT_PAGE_SIZE ? encodeCursor(page[page.length - 1]) : null,
        });
    } catch (error) {
        console.error('Failed to load test history:', error);
        return NextResponse.json({ error: 'Failed to load the test history' }, { status: 500 });
    }
}
