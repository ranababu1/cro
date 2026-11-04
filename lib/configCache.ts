/**
 * Short-lived in-memory cache for hot SDK config reads (API keys, domains, running tests).
 * Each serverless instance keeps its own copy for up to CONFIG_TTL_MS. Writes made through
 * lib/db clear this instance's cache at once; other instances pick up changes within the TTL.
 */
export const CONFIG_TTL_MS = 45_000;

/** Most entries kept. Lookups for ids that do not exist are cached too, so this bounds what made-up ids can use. */
export const CONFIG_MAX_ENTRIES = 10_000;

const store = new Map<string, { at: number; ttl: number; value: Promise<unknown> }>();

const SWEEP_EVERY_MS = 60_000;
let nextSweep = 0;

/** Drops expired entries, then the oldest tenth if the cache is still at its cap. */
function trim(now: number): void {
    nextSweep = now + SWEEP_EVERY_MS;
    for (const [k, e] of store) if (now - e.at >= e.ttl) store.delete(k);
    if (store.size < CONFIG_MAX_ENTRIES) return;
    let drop = Math.ceil(CONFIG_MAX_ENTRIES / 10);
    for (const k of store.keys()) {
        if (drop-- <= 0) break;
        store.delete(k);
    }
}

export async function cached<T>(key: string, load: () => Promise<T>, ttl = CONFIG_TTL_MS): Promise<T> {
    const now = Date.now();
    const hit = store.get(key);
    if (hit && now - hit.at < ttl) return hit.value as Promise<T>;
    if (now >= nextSweep || store.size >= CONFIG_MAX_ENTRIES) trim(now);
    const value = load();
    // A refreshed key moves to the end, which keeps the oldest-first order the trim relies on.
    store.delete(key);
    store.set(key, { at: now, ttl, value });
    value.catch(() => { if (store.get(key)?.value === value) store.delete(key); });
    return value;
}

export function clearConfigCache(): void {
    store.clear();
    nextSweep = 0;
}

export function configCacheSize(): number {
    return store.size;
}
