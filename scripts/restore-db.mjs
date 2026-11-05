#!/usr/bin/env node
/**
 * Restores a backup made by scripts/backup-db.mjs into an EMPTY database (a new Turso database or a new local file).
 * Reads DATABASE_URL and DATABASE_AUTH_TOKEN of the target. Refuses a database that already has tables.
 *
 *   DATABASE_URL=libsql://new-db... DATABASE_AUTH_TOKEN=... node scripts/restore-db.mjs backup.sql.gz
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import { createClient } from '@libsql/client';

const CHUNK = 500;

/** Splits a dump into statements. Each statement in a dump made by backup-db.mjs ends with ";\n". */
export function statements(dump) {
    const out = [];
    let cur = '';
    let inString = false;
    for (let i = 0; i < dump.length; i++) {
        const ch = dump[i];
        cur += ch;
        if (ch === "'") inString = !inString;
        else if (ch === ';' && !inString && (dump[i + 1] === '\n' || i + 1 === dump.length)) {
            const s = cur.trim();
            if (s && !s.startsWith('--')) out.push(s);
            else if (s.startsWith('--')) { const rest = s.split('\n').filter((l) => !l.startsWith('--')).join('\n').trim(); if (rest) out.push(rest); }
            cur = '';
        }
    }
    return out.filter((s) => !/^(BEGIN|COMMIT|PRAGMA foreign_keys=OFF);?$/i.test(s));
}

export async function restore(client, dump) {
    const existing = await client.execute("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%'");
    if (Number(existing.rows[0].n) > 0) throw new Error('The target database is not empty. Restore into a new database.');
    const list = statements(dump);
    for (let i = 0; i < list.length; i += CHUNK) await client.batch(list.slice(i, i + CHUNK), 'write');
    return { statements: list.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const file = process.argv[2];
    if (!file) { console.error('Usage: node scripts/restore-db.mjs <backup.sql.gz>'); process.exit(1); }
    const raw = fs.readFileSync(file);
    const dump = (file.endsWith('.gz') ? zlib.gunzipSync(raw) : raw).toString('utf8');
    const client = createClient({ url: process.env.DATABASE_URL, authToken: process.env.DATABASE_AUTH_TOKEN });
    const r = await restore(client, dump);
    client.close();
    console.log(JSON.stringify(r));
}
