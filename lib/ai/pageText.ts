import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { checkHost, isPrivateAddress, pinnedLookup, type Pin, type Resolver } from '../webhooks';

/**
 * Reads a public page on the server so the AI can suggest tests for it. Same protection as webhooks: the host must
 * resolve to public addresses only, the connection goes to the checked address, and every redirect is checked again.
 * The body is capped and only readable text is kept (title, description, headings, buttons and body text).
 */
export const PAGE_TIMEOUT_MS = 8000;
export const PAGE_MAX_BYTES = 1_500_000;
export const PAGE_MAX_REDIRECTS = 3;
export const PAGE_TEXT_CHARS = 6000;

export class PageError extends Error {
    constructor(message: string) { super(message); this.name = 'PageError'; }
}

export interface PageResponse { status: number; location?: string; contentType?: string; body: string }
export type PageGetter = (url: string, pin: Pin, signal: AbortSignal) => Promise<PageResponse>;

const dnsResolver: Resolver = async (host) => (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);

/** Checks an address the user enters: http or https, no credentials, not a local or private host. */
export function pageUrlError(raw: string): string | null {
    let u: URL;
    try { u = new URL(raw); } catch { return 'Enter a full URL, starting with https://'; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return 'The URL must start with https:// or http://';
    if (u.username || u.password) return 'Remove the user name and password from the URL.';
    if (u.port && u.port !== '80' && u.port !== '443') return 'Use the normal web port for the page.';
    const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || (!host.includes('.') && !isIP(host))) return 'Use a public page. Local and internal hosts are not allowed.';
    if (isIP(host) && isPrivateAddress(host)) return 'Use a public page. Private IP addresses are not allowed.';
    if (raw.length > 2000) return 'The URL is too long.';
    return null;
}

/** The real reader: one GET to the pinned address, no automatic redirects, body capped. */
export const pinnedGet: PageGetter = (url, pin, signal) => new Promise((resolve, reject) => {
    const u = new URL(url);
    const request = u.protocol === 'http:' ? httpRequest : httpsRequest;
    const req = request({
        protocol: u.protocol, hostname: u.hostname, port: u.port || (u.protocol === 'http:' ? 80 : 443), path: `${u.pathname}${u.search}`,
        method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FreeABTestPageReader/1.0; +https://freeabtest.com)', Accept: 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity' },
        lookup: pinnedLookup(pin), signal, agent: false,
    }, (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        const finish = () => resolve({ status: res.statusCode ?? 0, location: res.headers.location, contentType: res.headers['content-type'], body: Buffer.concat(chunks).toString('utf8') });
        res.on('data', (c: Buffer) => {
            size += c.length;
            if (size > PAGE_MAX_BYTES) { chunks.push(c.subarray(0, Math.max(0, PAGE_MAX_BYTES - (size - c.length)))); res.destroy(); finish(); return; }
            chunks.push(c);
        });
        res.on('end', finish);
        res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
});

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (ENTITIES[k]) return ENTITIES[k];
    if (k.startsWith('#x')) return String.fromCodePoint(parseInt(k.slice(2), 16) || 32);
    if (k.startsWith('#')) return String.fromCodePoint(Number(k.slice(1)) || 32);
    return m;
});
const clean = (s: string) => decode(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

export interface PageText { url: string; title: string; description: string; headings: string[]; buttons: string[]; text: string }

/** Readable parts of an HTML page. Exported for tests. */
export function extractPageText(html: string, url: string): PageText {
    const h = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1\s*>/gi, ' ');
    const title = clean(h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').slice(0, 200);
    const metaTag = h.match(/<meta[^>]+name=["']description["'][^>]*>/i)?.[0] ?? h.match(/<meta[^>]+property=["']og:description["'][^>]*>/i)?.[0] ?? '';
    const description = decode(metaTag.match(/content=["']([^"']*)["']/i)?.[1] ?? '').trim().slice(0, 400);
    const uniq = (list: string[], max: number) => [...new Set(list.filter((x) => x && x.length <= 160))].slice(0, max);
    const headings = uniq([...h.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => `H${m[1]}: ${clean(m[2])}`).filter((x) => x.length > 4), 30);
    const buttons = uniq([...h.matchAll(/<(button)\b[^>]*>([\s\S]*?)<\/button>|<a\b[^>]*class=["'][^"']*(?:btn|button|cta)[^"']*["'][^>]*>([\s\S]*?)<\/a>|<input\b[^>]*type=["']submit["'][^>]*value=["']([^"']*)["'][^>]*>/gi)].map((m) => clean(m[2] ?? m[3] ?? m[4] ?? '')), 20);
    const body = h.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? h;
    const text = clean(body.replace(/<\/(p|div|li|h\d|section|header|footer|tr)>/gi, '. ')).slice(0, PAGE_TEXT_CHARS);
    return { url, title, description, headings, buttons, text };
}

/** Fetches a public page and returns its readable text. Throws PageError with a message for the user. */
export async function fetchPageText(raw: string, opts: { get?: PageGetter; resolve?: Resolver; timeoutMs?: number } = {}): Promise<PageText> {
    const get = opts.get ?? pinnedGet;
    const resolve = opts.resolve ?? dnsResolver;
    const signal = AbortSignal.timeout(opts.timeoutMs ?? PAGE_TIMEOUT_MS);
    let url = raw;
    for (let hop = 0; hop <= PAGE_MAX_REDIRECTS; hop++) {
        const err = pageUrlError(url);
        if (err) throw new PageError(err);
        const checked = await checkHost(url, resolve);
        if ('error' in checked) throw new PageError(`Could not read the page: ${checked.error}`);
        let res: PageResponse;
        try {
            res = await get(url, checked.pin, signal);
        } catch (e) {
            const name = (e as { name?: string })?.name;
            throw new PageError(name === 'TimeoutError' || name === 'AbortError' ? 'The page took too long to load.' : 'Could not connect to the page.');
        }
        if (res.status >= 300 && res.status < 400 && res.location) {
            url = new URL(res.location, url).toString();
            continue;
        }
        if (res.status === 401 || res.status === 403) throw new PageError('The page is private or blocks readers. Try a public page.');
        if (res.status < 200 || res.status >= 300) throw new PageError(`The page answered with an error (${res.status}).`);
        if (res.contentType && !/html|xml|text\/plain/i.test(res.contentType)) throw new PageError('That address is not a web page.');
        const page = extractPageText(res.body, url);
        if (!page.title && !page.text) throw new PageError('The page has no readable text. Pages that only load with scripts cannot be read yet.');
        return page;
    }
    throw new PageError('The page redirects too many times.');
}
