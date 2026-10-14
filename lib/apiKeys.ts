import { createHash, randomBytes } from 'node:crypto';
import type { EnvironmentKey } from './db/schema';

export type ApiKeyType = 'sdk' | 'secret';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const KEY_PATTERN = /^cro_(pk|sk)_(dev|staging|prod)_[0-9A-Za-z]{32}$/;

/**
 * Builds a new key. Format: cro_pk_<env>_<32 chars> for SDK keys, cro_sk_<env>_<32 chars> for secret keys.
 * Only the SHA-256 hash is stored. The plaintext is shown to the user once.
 */
export function generateApiKey(type: ApiKeyType, env: EnvironmentKey): { key: string; hash: string; prefix: string } {
    const bytes = randomBytes(32);
    let body = '';
    for (const b of bytes) body += BASE62[b % 62];
    const key = `cro_${type === 'sdk' ? 'pk' : 'sk'}_${env}_${body}`;
    return { key, hash: hashApiKey(key), prefix: key.slice(0, key.length - 28) };
}

export function hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
}

export function isWellFormedApiKey(key: string): boolean {
    return KEY_PATTERN.test(key);
}

export function apiKeyType(key: string): ApiKeyType | null {
    const m = KEY_PATTERN.exec(key);
    if (!m) return null;
    return m[1] === 'pk' ? 'sdk' : 'secret';
}
