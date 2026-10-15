/**
 * Short-lived in-memory cache for hot SDK config reads (API keys, domains, running tests).
 * Each serverless instance keeps its own copy for up to CONFIG_TTL_MS. Writes made through
 * lib/db clear this instance's cache at once; other instances pick up changes within the TTL.
 */
export const CONFIG_TTL_MS = 45_000;

const store = new Map<string, { at: number; value: Promise<unknown> }>();

export async function cached<T>(key: string, load: () => Promise<T>, ttl = CONFIG_TTL_MS): Promise<T> {
    const hit = store.get(key);
    if (hit && Date.now() - hit.at < ttl) return hit.value as Promise<T>;
    const value = load();
    store.set(key, { at: Date.now(), value });
    value.catch(() => store.delete(key));
    return value;
}

export function clearConfigCache(): void {
    store.clear();
}

export function configCacheSize(): number {
    return store.size;
}
