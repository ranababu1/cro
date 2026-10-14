import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Random id with a type prefix, for example exp_k3j2h4g5f6d7s8a9. */
export function generateId(prefix: string = ''): string {
    const bytes = randomBytes(16);
    let out = '';
    for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
    return prefix ? `${prefix}_${out}` : out;
}
