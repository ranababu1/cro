import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

const journal = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json', 'utf8')) as {
    entries: { idx: number; when: number; tag: string }[];
};

describe('drizzle migrations', () => {
    it('new migrations have a timestamp newer than every earlier one', () => {
        // Drizzle skips a migration whose "when" is not greater than the newest applied one.
        // 0002 and 0003 are legacy out-of-order entries already applied in production.
        for (const e of journal.entries.filter((x) => x.idx >= 4)) {
            const maxPrior = Math.max(...journal.entries.filter((x) => x.idx < e.idx).map((x) => x.when));
            expect(e.when, e.tag).toBeGreaterThan(maxPrior);
        }
    });

    it('upgrades a database on the pre-#13 schema (adds api_keys.key_plaintext)', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cro-mig-'));
        const client = createClient({ url: `file:${path.join(dir, 'old.db')}` });
        // Build the production state: 0000-0003 applied with their journal timestamps.
        await client.execute(
            'CREATE TABLE "__drizzle_migrations" (id INTEGER PRIMARY KEY AUTOINCREMENT, hash text NOT NULL, created_at numeric)',
        );
        for (const e of journal.entries.filter((x) => x.idx <= 3)) {
            const sql = fs.readFileSync(`drizzle/${e.tag}.sql`, 'utf8');
            for (const stmt of sql.split('--> statement-breakpoint')) if (stmt.trim()) await client.execute(stmt);
            const hash = crypto.createHash('sha256').update(sql).digest('hex');
            await client.execute({ sql: 'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)', args: [hash, e.when] });
        }
        await migrate(drizzle(client), { migrationsFolder: './drizzle' });
        const cols = await client.execute("SELECT name FROM pragma_table_info('api_keys')");
        expect(cols.rows.map((r) => r.name)).toContain('key_plaintext');
        client.close();
    });
});
