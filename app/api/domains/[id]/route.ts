import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { orgIdForProject } from '@/lib/access';
import { releaseDomainIfUnused } from '@/lib/domainLedger';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    const { id } = await params;
    // Find domain among caller's projects
    for (const projectId of ctx.projectIds) {
        const domains = await db.listDomains(projectId);
        const domain = domains.find((d) => d.id === id);
        if (domain) {
            await db.deleteDomain(id);
            const orgId = await orgIdForProject(projectId);
            // Free claims are released so the domain can move; its used free tests stay on the ledger.
            await releaseDomainIfUnused(orgId, domain.host);
            await db.audit({ orgId, actorId: ctx.userId, entity: 'domain', entityId: id, action: 'delete', diff: { host: domain.host } });
            return NextResponse.json({ ok: true });
        }
    }
    return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
}
