import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { orgIdForProject } from '@/lib/access';
import { canUseFeature, UPGRADE_NOTE } from '@/lib/entitlements';
import { PROJECT_COOKIE } from '@/lib/currentProject';
import { AUDIT_ENTITIES, AUDIT_PAGE_SIZE, auditRetentionDays, decodeCursor, encodeCursor, presentAudit } from '@/lib/audit';

/**
 * GET /api/audit?entity=&cursor= - the current organization's audit log, newest first, 50 per page. Read-only, paid plans.
 * Only entries inside the plan's audit period are returned.
 */
export async function GET(request: NextRequest) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const selected = request.cookies.get(PROJECT_COOKIE)?.value;
        const projectId = selected && ctx.projectIds.includes(selected) ? selected : ctx.projectIds[0];
        if (!projectId) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        const orgId = await orgIdForProject(projectId);
        if (!orgId || !(await canUseFeature(orgId, 'audit_log'))) {
            return NextResponse.json({ error: 'The audit log needs a paid plan', upgrade: UPGRADE_NOTE.audit_log }, { status: 403 });
        }
        const org = await db.getOrganization(orgId);
        const days = auditRetentionDays(org?.plan);
        const since = new Date(Date.now() - days * 86_400_000).toISOString();
        const sp = request.nextUrl.searchParams;
        const e = sp.get('entity');
        const entity = e && (AUDIT_ENTITIES as readonly string[]).includes(e) ? e : null;
        const rows = await db.listAuditForOrg(orgId, { since, before: decodeCursor(sp.get('cursor')), entity, limit: AUDIT_PAGE_SIZE + 1 });
        const page = rows.slice(0, AUDIT_PAGE_SIZE);
        return NextResponse.json({
            organization: org?.name ?? null,
            retention_days: days,
            entity,
            entries: page.map(presentAudit),
            next_cursor: rows.length > AUDIT_PAGE_SIZE ? encodeCursor(page[page.length - 1]) : null,
        });
    } catch (error) {
        console.error('Failed to load audit log:', error);
        return NextResponse.json({ error: 'Failed to load the audit log' }, { status: 500 });
    }
}
