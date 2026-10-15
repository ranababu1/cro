import fs from 'node:fs';
import path from 'node:path';
import { zipSync, strToU8 } from 'fflate';

/** Plugin source lives outside /public so it can only be served by the signed-in download route. */
export const WP_PLUGIN_DIR = path.join(process.cwd(), 'integrations', 'wordpress', 'freeabtest');
export const WP_PLUGIN_SLUG = 'freeabtest';

function walk(dir: string, base = ''): [string, Uint8Array][] {
    const out: [string, Uint8Array][] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const rel = base ? `${base}/${entry.name}` : entry.name;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full, rel));
        else if (entry.isFile()) out.push([rel, new Uint8Array(fs.readFileSync(full))]);
    }
    return out;
}

export function wordpressPluginVersion(): string {
    const main = fs.readFileSync(path.join(WP_PLUGIN_DIR, 'freeabtest.php'), 'utf8');
    return /^\s*\*\s*Version:\s*([0-9.]+)/m.exec(main)?.[1] ?? '0.0.0';
}

let cached: { zip: Uint8Array; version: string } | null = null;

/** Builds freeabtest.zip with a top-level freeabtest/ folder, as WordPress expects. */
export function buildWordpressZip(): { zip: Uint8Array; version: string } {
    if (cached) return cached;
    const files: Record<string, Uint8Array> = {};
    for (const [rel, data] of walk(WP_PLUGIN_DIR)) files[`${WP_PLUGIN_SLUG}/${rel}`] = data;
    if (!files[`${WP_PLUGIN_SLUG}/freeabtest.php`]) files[`${WP_PLUGIN_SLUG}/MISSING`] = strToU8('');
    cached = { zip: zipSync(files, { level: 9, mtime: new Date('2026-01-01T00:00:00Z') }), version: wordpressPluginVersion() };
    return cached;
}
