import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Encryption for the AI provider keys customers bring. AES-256-GCM with a 32-byte server key from
 * AI_KEYS_ENCRYPTION_KEY (base64, for example from `openssl rand -base64 32`). The org id and provider are bound in as
 * associated data, so a stored value cannot be copied to another org or provider. Without the env var, AI features
 * report "not available yet" and nothing is stored.
 *
 * Stored format: `v1.<base64url iv (12 bytes)>.<base64url tag (16 bytes)>.<base64url ciphertext>`.
 */
export const AI_KEY_ENV = 'AI_KEYS_ENCRYPTION_KEY';

let warned = false;

/** The 32-byte key, or null when the env var is missing or not 32 bytes of base64. */
export function encryptionKey(env: Record<string, string | undefined> = process.env): Buffer | null {
    const raw = env[AI_KEY_ENV]?.trim();
    if (!raw) return null;
    const buf = Buffer.from(raw, 'base64');
    if (buf.length !== 32) {
        if (!warned) { warned = true; console.warn(`${AI_KEY_ENV} must be 32 bytes of base64. AI features stay off.`); }
        return null;
    }
    return buf;
}

export const aiConfigured = (env: Record<string, string | undefined> = process.env) => encryptionKey(env) !== null;

const aad = (orgId: string, provider: string) => Buffer.from(`ai-key:${orgId}:${provider}`);

export function encryptSecret(plain: string, orgId: string, provider: string, key = encryptionKey()): string {
    if (!key) throw new Error('AI key encryption is not configured');
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', key, iv);
    c.setAAD(aad(orgId, provider));
    const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}

/** Plain key, or null if the value is malformed, was made with another server key, or belongs to another org or provider. */
export function decryptSecret(stored: string, orgId: string, provider: string, key = encryptionKey()): string | null {
    if (!key) return null;
    const [v, iv, tag, ct] = stored.split('.');
    if (v !== 'v1' || !iv || !tag || !ct) return null;
    try {
        const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
        d.setAAD(aad(orgId, provider));
        d.setAuthTag(Buffer.from(tag, 'base64url'));
        return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
    } catch {
        return null;
    }
}

/** What the dashboard may show of a key: its last 4 characters. */
export const keyHint = (key: string) => key.trim().slice(-4);
