/** Normalize a hostname or URL into a lowercase host without port or trailing dots. */
export function normalizeHost(input: string): string | null {
    const raw = input.trim().toLowerCase();
    if (!raw) return null;
    try {
        const withProto = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
        const u = new URL(withProto);
        const host = u.hostname.replace(/\.$/, '');
        if (!host || host.includes(' ')) return null;
        return host;
    } catch {
        return null;
    }
}

/** Extract the request's origin host from Origin or Referer. */
export function hostFromRequestHeaders(origin: string | null, referer: string | null): string | null {
    if (origin) {
        const h = normalizeHost(origin);
        if (h) return h;
    }
    if (referer) {
        const h = normalizeHost(referer);
        if (h) return h;
    }
    return null;
}

/** True when the request host is listed for the project (exact match). */
export function isHostAllowed(host: string | null, allowed: string[]): boolean {
    if (!host) return false;
    return allowed.includes(host);
}

/** Strip query and hash; keep origin + pathname without trailing slash (except root). */
export function normalizePageUrl(input: string): string | null {
    try {
        const u = new URL(input);
        let path = u.pathname || '/';
        if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
        return `${u.origin}${path}`;
    } catch {
        return null;
    }
}

/** True when two page URLs match after normalization. */
export function urlsMatch(a: string, b: string): boolean {
    const na = normalizePageUrl(a);
    const nb = normalizePageUrl(b);
    return !!na && na === nb;
}
