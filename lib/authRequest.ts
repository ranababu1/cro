import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * NextAuth callbacks do not receive the request. The auth route runs each request inside this store
 * so the sign-in callback can read the bot-check pass cookie and the client IP.
 */
export interface AuthRequestInfo {
    ip: string;
    cookies: Record<string, string>;
}

const store = new AsyncLocalStorage<AuthRequestInfo>();

export function runWithAuthRequest<T>(info: AuthRequestInfo, fn: () => T): T {
    return store.run(info, fn);
}

export function currentAuthRequest(): AuthRequestInfo | null {
    return store.getStore() ?? null;
}
