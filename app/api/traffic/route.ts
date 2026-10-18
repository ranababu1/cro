import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { orgIdForProject } from '@/lib/access';
import { canUseFeature, UPGRADE_NOTE } from '@/lib/entitlements';
import { PROJECT_COOKIE } from '@/lib/currentProject';
import { flushTelemetry } from '@/lib/telemetry';
import { lastDays, summarizeTraffic, TRAFFIC_RANGES } from '@/lib/traffic';

/** GET /api/traffic?days=7|30|90&environment=prod: traffic overview for the current project. Paid only. */
export async function GET(request: NextRequest) {
    try {
        const ctx = await requireUserContext(request);
        if (ctx instanceof NextResponse) return ctx;
        const selected = request.cookies.get(PROJECT_COOKIE)?.value;
        const projectId = selected && ctx.projectIds.includes(selected) ? selected : ctx.projectIds[0];
        if (!projectId) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        const orgId = await orgIdForProject(projectId);
        if (!orgId || !(await canUseFeature(orgId, 'traffic'))) {
            return NextResponse.json({ error: 'The traffic overview needs a paid plan', upgrade: UPGRADE_NOTE.traffic }, { status: 403 });
        }
        const n = Number(request.nextUrl.searchParams.get('days') || 30);
        const range = (TRAFFIC_RANGES as readonly number[]).includes(n) ? n : 30;
        const envKey = request.nextUrl.searchParams.get('environment') || 'prod';
        const envs = await db.getEnvironments(projectId);
        const env = envs.find((e) => e.key === envKey);
        if (!env) return NextResponse.json({ error: 'Unknown environment' }, { status: 400 });
        // Counters written by this instance but not flushed yet should show up too.
        await flushTelemetry();
        const days = lastDays(range);
        const { daily, grouped } = await db.getTraffic(env.id, days[0], days[days.length - 1]);
        return NextResponse.json({ project_id: projectId, environment: env.key, environments: envs.map((e) => ({ key: e.key, name: e.name })), range, ...summarizeTraffic(daily, grouped, days) });
    } catch (error) {
        console.error('Failed to load traffic:', error);
        return NextResponse.json({ error: 'Failed to load traffic' }, { status: 500 });
    }
}
