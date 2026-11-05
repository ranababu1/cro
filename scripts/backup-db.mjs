#!/usr/bin/env node
/**
 * Logical backup of the database to a gzipped SQL file: schema first, then every row as INSERT statements.
 * Works against a local file or a remote libSQL database. Reads DATABASE_URL and DATABASE_AUTH_TOKEN.
 *
 *   node scripts/backup-db.mjs [out.sql.gz]
 *
 * Restore with scripts/restore-db.mjs. See docs/operations.md for the schedule and the restore drill.
 * The file holds customer data: store it encrypted, with access limited like the database itself.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createClient } from '@libsql/client';

const PAGE = 2000;
const url = process.env.DATABASE_URL || 'file:./data/cro.db';
const out = process.argv[2] || `backups/cro-${new Date().toISOString().replace(/[:.]/g, '-')}.sql.gz`;

export function sqlValue(v) {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
    if (typeof v === 'bigint') return v.toString();
    if (typeof v === 'boolean') return v ? '1' : '0';
    if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) return `X'${Buffer.from(v instanceof ArrayBuffer ? v : v.buffer).toString('hex')}'`;
    return `'${String(v).replace(/'/g, "''")}'`;
}

/** Orders tables so every table comes after the tables its foreign keys point to (restores work with checks on). */
async function parentsFirst(client, tables) {
    const names = new Set(tables.map((t) => String(t.name)));
    const parents = new Map();
    for (const t of tables) {
        const fk = await client.execute(`PRAGMA foreign_key_list("${String(t.name).replace(/"/g, '""')}")`);
        parents.set(String(t.name), new Set(fk.rows.map((r) => String(r.table)).filter((p) => p !== String(t.name) && names.has(p))));
    }
    const done = new Set();
    const ordered = [];
    const visit = (name, path = new Set()) => {
        if (done.has(name) || path.has(name)) return;
        path.add(name);
        for (const p of parents.get(name) ?? []) visit(p, path);
        done.add(name);
        ordered.push(tables.find((t) => String(t.name) === name));
    };
    for (const t of tables) visit(String(t.name));
    return ordered;
}

export async function backup(client, write) {
    const objects = (await client.execute("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%' AND name NOT LIKE 'libsql_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name")).rows;
    const tables = await parentsFirst(client, objects.filter((o) => o.type === 'table'));
    write(`-- freeabtest backup ${new Date().toISOString()}\nPRAGMA foreign_keys=OFF;\nBEGIN;\n`);
    for (const t of tables) write(`${t.sql};\n`);
    let rows = 0;
    for (const t of tables) {
        const name = String(t.name).replace(/"/g, '""');
        let last = null;
        for (;;) {
            const r = await client.execute({
                sql: last === null ? `SELECT rowid AS __rowid, * FROM "${name}" ORDER BY rowid LIMIT ${PAGE}` : `SELECT rowid AS __rowid, * FROM "${name}" WHERE rowid > ? ORDER BY rowid LIMIT ${PAGE}`,
                args: last === null ? [] : [last],
            });
            if (!r.rows.length) break;
            const cols = r.columns.filter((c) => c !== '__rowid');
            const colList = cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(',');
            for (const row of r.rows) write(`INSERT INTO "${name}" (${colList}) VALUES (${cols.map((c) => sqlValue(row[c])).join(',')});\n`);
            rows += r.rows.length;
            last = r.rows[r.rows.length - 1].__rowid;
            if (r.rows.length < PAGE) break;
        }
    }
    for (const o of objects.filter((x) => x.type !== 'table')) write(`${o.sql};\n`);
    write('COMMIT;\n');
    return { tables: tables.length, rows };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    const gz = zlib.createGzip({ level: 9 });
    const file = fs.createWriteStream(out, { mode: 0o600 });
    gz.pipe(file);
    const started = Date.now();
    const r = await backup(client, (s) => gz.write(s));
    gz.end();
    await new Promise((res, rej) => { file.on('finish', res); file.on('error', rej); });
    client.close();
    console.log(JSON.stringify({ out, ...r, bytes: fs.statSync(out).size, seconds: Math.round((Date.now() - started) / 100) / 10 }));
}
