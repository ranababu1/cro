import { SITE_URL } from '@/lib/blog';
import { organizationJsonLd } from '@/lib/legal';

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/** Canonical Organization node. Pages should reference it by @id instead of repeating the object. */
export function organizationNode() {
    return {
        ...organizationJsonLd(),
        '@id': ORGANIZATION_ID,
        logo: `${SITE_URL}/icon-512.png`,
    };
}

/** Canonical WebSite node, with publisher pointing at the Organization @id. */
export function websiteNode() {
    return {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        url: `${SITE_URL}/`,
        name: 'freeabtest.com',
        publisher: { '@id': ORGANIZATION_ID },
    };
}

type JsonLdNode = Record<string, unknown>;

/** Drop @context (the graph already has one) and flatten a nested @graph if present. */
export function normalizeNodes(input: unknown): JsonLdNode[] {
    if (input == null) return [];
    if (Array.isArray(input)) return input.flatMap(normalizeNodes);
    if (typeof input !== 'object') return [];
    const node = { ...(input as JsonLdNode) };
    delete node['@context'];
    if (Array.isArray(node['@graph'])) {
        const graph = node['@graph'];
        delete node['@graph'];
        const rest = Object.keys(node).length > 0 && node['@type'] ? [node] : [];
        return [...rest, ...graph.flatMap(normalizeNodes)];
    }
    return [node];
}

/** Parse a JSON-LD string from blog frontmatter into graph nodes. */
export function parseSchema(json?: string | null): JsonLdNode[] {
    if (!json) return [];
    return normalizeNodes(JSON.parse(json));
}

export function breadcrumbListNode(items: { href: string; label: string }[]): JsonLdNode {
    const all = [{ href: '/', label: 'Home' }, ...items];
    const current = all[all.length - 1]!;
    return {
        '@type': 'BreadcrumbList',
        '@id': `${SITE_URL}${current.href === '/' ? '/' : current.href}#breadcrumb`,
        itemListElement: all.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: c.label,
            item: `${SITE_URL}${c.href === '/' ? '/' : c.href}`,
        })),
    };
}

export function faqPageNode(faqs: { q: string; a: string }[], url?: string): JsonLdNode {
    return {
        '@type': 'FAQPage',
        ...(url ? { url } : {}),
        mainEntity: faqs.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
    };
}

/**
 * One schema.org @graph for a page: Organization, WebSite, then any page-specific nodes.
 * Extra Organization or WebSite nodes with the same @id are merged so the graph stays valid.
 */
export function siteGraph(extra: unknown[] = []): { '@context': 'https://schema.org'; '@graph': JsonLdNode[] } {
    const extras = extra.flatMap(normalizeNodes);
    const org = organizationNode() as JsonLdNode;
    const site = websiteNode() as JsonLdNode;
    const graph: JsonLdNode[] = [org, site];
    for (const node of extras) {
        const id = typeof node['@id'] === 'string' ? node['@id'] : '';
        const type = node['@type'];
        if (id === ORGANIZATION_ID || type === 'Organization') {
            Object.assign(org, node, { '@id': ORGANIZATION_ID, '@type': 'Organization' });
            continue;
        }
        if (id === WEBSITE_ID || type === 'WebSite') {
            Object.assign(site, node, { '@id': WEBSITE_ID, '@type': 'WebSite', publisher: { '@id': ORGANIZATION_ID } });
            continue;
        }
        graph.push(node);
    }
    return { '@context': 'https://schema.org', '@graph': graph };
}
