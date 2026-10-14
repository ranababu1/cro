import path from 'node:path';
import fs from 'node:fs';
import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './schema';

export type DB = LibSQLDatabase<typeof schema>;

const DEFAULT_URL = 'file:./data/cro.db';

interface DbState {
    client: Client;
    db: DB;
    ready: Promise<void>;
}

// Cache on globalThis so dev hot reload does not open a new connection per edit.
const globalForDb = globalThis as unknown as { __croDb?: DbState };

function open(): DbState {
    const url = process.env.DATABASE_URL || DEFAULT_URL;
    if (url.startsWith('file:') && !url.includes(':memory:')) {
        const filePath = url.slice('file:'.length);
        fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
    }
    const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
    const db = drizzle(client, { schema });
    const ready = (async () => {
        if (url.startsWith('file:')) {
            await client.execute('PRAGMA foreign_keys = ON');
        }
        if (process.env.DB_AUTO_MIGRATE !== 'false') {
            await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
        }
    })();
    return { client, db, ready };
}

/** Returns a ready database. Runs pending migrations once per process unless DB_AUTO_MIGRATE=false. */
export async function getDb(): Promise<DB> {
    if (!globalForDb.__croDb) {
        globalForDb.__croDb = open();
    }
    await globalForDb.__croDb.ready;
    return globalForDb.__croDb.db;
}

/** Test helper: close and forget the current connection. */
export function resetDbForTests(): void {
    globalForDb.__croDb?.client.close();
    globalForDb.__croDb = undefined;
}
