// Applies pending migrations in ./drizzle to DATABASE_URL.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

const url = process.env.DATABASE_URL || 'file:./data/cro.db';
if (url.startsWith('file:') && !url.includes(':memory:')) {
    fs.mkdirSync(path.dirname(path.resolve(url.slice(5))), { recursive: true });
}
const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
await migrate(drizzle(client), { migrationsFolder: './drizzle' });
client.close();
console.log('Migrations applied');
