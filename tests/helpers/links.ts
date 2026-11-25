import fs from 'node:fs';
import path from 'node:path';
import { docPages, headingId } from '@/lib/docs';
import { getAllPosts } from '@/lib/blog';
import { PRODUCT_ANCHORS } from '@/lib/site/product';

const root = path.join(__dirname, '..', '..');
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');

/** True when `pathname` is served by a page in app/ (static segments, docs slugs and blog slugs). */
export function routeExists(pathname: string): boolean {
    if (pathname === '/') return fs.existsSync(path.join(root, 'app/page.tsx'));
    const docs = pathname.match(/^\/docs\/([^/]+)$/);
    if (docs) return docPages.some((p) => p.slug === docs[1]);
    const blog = pathname.match(/^\/blog\/([^/]+)$/);
    if (blog) return getAllPosts().some((p) => p.slug === blog[1]);
    return fs.existsSync(path.join(root, 'app', pathname, 'page.tsx'));
}

/** True when the anchor is a docs heading, a literal id in the page source, or an id the page renders from lib/site data. */
export function anchorExists(pathname: string, hash: string): boolean {
    const docs = pathname.match(/^\/docs\/([^/]+)$/);
    if (docs) {
        const page = docPages.find((p) => p.slug === docs[1]);
        return !!page && page.blocks.some((b) => (b.type === 'h2' || b.type === 'h3') && headingId(b) === hash);
    }
    if (PRODUCT_ANCHORS[pathname]?.includes(hash)) return true;
    const file = pathname === '/' ? 'app/page.tsx' : `app${pathname}/page.tsx`;
    return read(file).includes(`id="${hash}"`);
}

/** Checks an internal href ("/path" or "/path#anchor"); returns an error message or null. */
export function checkHref(href: string): string | null {
    if (!href.startsWith('/')) return `${href} is not an internal path`;
    const [pathname, hash] = href.split('#');
    if (!routeExists(pathname)) return `${href}: no page`;
    if (hash && !anchorExists(pathname, hash)) return `${href}: no anchor`;
    return null;
}

/** Every literal internal href in a source file: href="/x", href: '/x' and href={`/x`} without interpolation. */
export function hrefsIn(src: string): string[] {
    const out = new Set<string>();
    for (const m of src.matchAll(/href(?:=|: )["'`](\/[^"'`$]*)["'`]/g)) out.add(m[1]);
    return [...out];
}
