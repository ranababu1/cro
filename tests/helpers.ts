import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { resetDbForTests } from '@/lib/db/client';
import { db } from '@/lib/db';

/** Points the app at a fresh SQLite file for the current test file. */
export function useTempDatabase(): () => void {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cro-test-'));
    process.env.DATABASE_URL = `file:${path.join(dir, 'test.db')}`;
    process.env.DB_AUTO_MIGRATE = 'true';
    resetDbForTests();
    return () => {
        resetDbForTests();
        fs.rmSync(dir, { recursive: true, force: true });
    };
}

/** Registers a domain for tests that exercise the URL-split flow. */
export async function seedProjectDomain(projectId: string, host = 'localhost') {
    return db.addDomain(projectId, host);
}

export function flowExperimentBody(overrides: Record<string, unknown> = {}) {
    return {
        name: 'Homepage CTA',
        control_url: 'http://localhost/demo/control.html',
        traffic_allocation: 100,
        variations: [
            { name: 'Control', url: 'http://localhost/demo/control.html', weight: 50, is_control: true },
            { name: 'Variation 1', url: 'http://localhost/demo/variation.html', weight: 50, is_control: false },
        ],
        goals: [{ name: 'CTA click', selector: '#headerCTA', is_primary: true }],
        ...overrides,
    };
}

/** Free accounts create 1 test a month: clears the monthly counters so a test can create several. */
export async function resetFreeTestUsage() {
    const { getDb } = await import('@/lib/db/client');
    const { sql } = await import('drizzle-orm');
    await (await getDb()).run(sql`delete from free_test_usage`);
}

/** Puts an org on a paid plan, for tests of features the free plan does not include (custom conversions, more goals). */
export async function makePaid(orgId: string, plan = 'starter') {
    await db.updateOrganization(orgId, { plan });
    const { clearConfigCache } = await import('@/lib/configCache');
    clearConfigCache();
}
