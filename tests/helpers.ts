import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { resetDbForTests } from '@/lib/db/client';

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
