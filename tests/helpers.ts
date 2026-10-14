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
