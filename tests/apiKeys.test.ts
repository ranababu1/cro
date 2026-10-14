import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey, isWellFormedApiKey, apiKeyType } from '@/lib/apiKeys';

describe('api keys', () => {
    it('generates well formed SDK and secret keys', () => {
        const sdk = generateApiKey('sdk', 'prod');
        expect(sdk.key).toMatch(/^cro_pk_prod_[0-9A-Za-z]{32}$/);
        expect(apiKeyType(sdk.key)).toBe('sdk');
        const secret = generateApiKey('secret', 'dev');
        expect(secret.key).toMatch(/^cro_sk_dev_[0-9A-Za-z]{32}$/);
        expect(apiKeyType(secret.key)).toBe('secret');
    });

    it('stores a hash, not the key, and the prefix hides the secret part', () => {
        const k = generateApiKey('sdk', 'staging');
        expect(k.hash).toBe(hashApiKey(k.key));
        expect(k.hash).not.toContain(k.key);
        expect(k.key.startsWith(k.prefix)).toBe(true);
        expect(k.key.length - k.prefix.length).toBe(28);
    });

    it('generates unique keys', () => {
        const keys = new Set(Array.from({ length: 200 }, () => generateApiKey('sdk', 'prod').key));
        expect(keys.size).toBe(200);
    });

    it('rejects malformed keys', () => {
        expect(isWellFormedApiKey('cro_pk_prod_short')).toBe(false);
        expect(isWellFormedApiKey('cro_xx_prod_' + 'a'.repeat(32))).toBe(false);
        expect(apiKeyType('nope')).toBeNull();
    });
});
