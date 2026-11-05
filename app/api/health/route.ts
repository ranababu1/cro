import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

const DB_TIMEOUT_MS = 3000;

/**
 * GET /api/health: for uptime monitors and status pages. 200 {"status":"ok"} when the app answers and the database
 * replies to a trivial query within 3 seconds, else 503 {"status":"degraded"}. No secrets or internals in the body.
 */
export async function GET() {
    const started = Date.now();
    let db: 'ok' | 'error' = 'ok';
    try {
        const d = await getDb();
        await Promise.race([
            d.run(sql`select 1`),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), DB_TIMEOUT_MS)),
        ]);
    } catch {
        db = 'error';
    }
    const body = {
        status: db === 'ok' ? 'ok' : 'degraded',
        checks: { app: 'ok', database: db },
        latency_ms: Date.now() - started,
        version: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || undefined,
        time: new Date().toISOString(),
    };
    return Response.json(body, { status: db === 'ok' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
