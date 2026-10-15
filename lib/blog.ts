import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { Marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export const SITE_URL = 'https://www.freeabtest.com';
const DIR = path.join(process.cwd(), 'content/blog');

export type Post = {
    slug: string; title: string; description: string; date: string; updated: string; author: string;
    /** Name shown on the page, e.g. "Imraan" from "Imraan, freeabtest.com". */
    authorName: string; category: string;
    keywords: string[]; readingMinutes: number; markdown: string; articleSchema?: string; faqSchema?: string;
};

const iso = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ''));

/** Parse and re-serialise a JSON-LD string so only valid JSON is ever injected. */
function json(v: unknown): string | undefined {
    if (!v) return undefined;
    return JSON.stringify(typeof v === 'string' ? JSON.parse(v) : v);
}

/** BlogPosting JSON-LD built from frontmatter, used when a post has no article_schema. */
export function defaultArticleSchema(p: { slug: string; title: string; description: string; date: string; updated: string; author: string; keywords: string[] }) {
    const url = `${SITE_URL}/blog/${p.slug}`;
    return {
        '@context': 'https://schema.org', '@type': 'BlogPosting',
        headline: p.title, description: p.description, url, mainEntityOfPage: url,
        datePublished: p.date, dateModified: p.updated || p.date,
        author: { '@type': 'Person', name: p.author.split(',')[0].trim() || 'Imraan' },
        publisher: { '@type': 'Organization', name: 'freeabtest.com', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } },
        ...(p.keywords.length ? { keywords: p.keywords.join(', ') } : {}),
    };
}

/** Category from frontmatter, else guessed from keywords, else "Guides". */
export function deriveCategory(category: unknown, keywords: string[]): string {
    if (typeof category === 'string' && category.trim()) return category.trim();
    const k = keywords.join(' ').toLowerCase();
    if (/\b(tools?|software|comparison|alternative|vs)\b/.test(k)) return 'Tools';
    if (/sample size|significance|statistic|how long|duration|confidence/.test(k)) return 'Statistics';
    return 'Guides';
}

export function parsePost(file: string, raw: string): Post {
    const { data, content } = matter(raw);
    const slug = String(data.slug || path.basename(file, '.md'));
    const words = content.split(/\s+/).filter(Boolean).length;
    const keywords = Array.isArray(data.keywords) ? data.keywords.map(String) : [];
    const author = String(data.author ?? 'Imraan');
    const base = {
        slug, title: String(data.title), description: String(data.meta_description ?? data.description ?? ''),
        date: iso(data.date), updated: iso(data.updated ?? data.date), author, keywords,
    };
    return {
        ...base, authorName: author.split(',')[0].trim(), category: deriveCategory(data.category, keywords),
        readingMinutes: Math.max(1, Math.round(words / 220)), markdown: content,
        articleSchema: json(data.article_schema) ?? JSON.stringify(defaultArticleSchema(base)), faqSchema: json(data.faq_schema),
    };
}

export function getAllPosts(): Post[] {
    if (!fs.existsSync(DIR)) return [];
    return fs.readdirSync(DIR).filter((f) => f.endsWith('.md'))
        .map((f) => parsePost(f, fs.readFileSync(path.join(DIR, f), 'utf8')))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));
}

export const getPost = (slug: string) => getAllPosts().find((p) => p.slug === slug);

/** Up to `n` other posts, same category first, then newest. */
export function relatedPosts(post: Post, all: Post[], n = 3): Post[] {
    const others = all.filter((p) => p.slug !== post.slug);
    return [...others.filter((p) => p.category === post.category), ...others.filter((p) => p.category !== post.category)].slice(0, n);
}

export const slugify = (s: string) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const SANITIZE: sanitizeHtml.IOptions = {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'h1', 'h2'],
    allowedAttributes: { a: ['href', 'title'], img: ['src', 'alt', 'title'], th: ['align'], td: ['align'], h2: ['id'], h3: ['id'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
        a: (tag, attribs) => (/^https?:/.test(attribs.href ?? '') && !attribs.href.startsWith(SITE_URL)
            ? { tagName: 'a', attribs: { ...attribs, rel: 'noopener', target: '_blank' } }
            : { tagName: tag, attribs }),
    },
};

function toHtml(md: string): string {
    const m = new Marked({ gfm: true });
    m.use({ renderer: { heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        return depth <= 3 ? `<h${depth} id="${slugify(inner)}">${inner}</h${depth}>\n` : `<h${depth}>${inner}</h${depth}>\n`;
    } } });
    const clean = sanitizeHtml(m.parse(md, { async: false }) as string, SANITIZE);
    // Presentation only, applied to already sanitized HTML with fixed strings.
    return clean
        .replace(/<table>/g, '<div class="table-wrap" tabindex="0" role="region" aria-label="Table"><table>').replace(/<\/table>/g, '</table></div>')
        .replace(/<blockquote>\s*<p><strong>(Note|Tip|Warning|Important):<\/strong>/g, (_, k: string) => `<blockquote class="callout callout-${k.toLowerCase()}"><p><strong>${k}:</strong>`);
}

/** Back-compat helper: sanitized HTML for any markdown. */
export const renderMarkdown = (md: string) => toHtml(md);

export type Faq = { q: string; a: string };
export type RenderedPost = { html: string; afterFaqHtml: string; toc: { id: string; text: string }[]; faq: Faq[]; faqHeading?: string };

const FAQ_HEADING = /^##\s+(frequently asked questions|faq)\s*$/im;

/**
 * Renders a post. The "Frequently asked questions" section becomes data for an accordion:
 * each "**Question?**" line followed by its answer is one item, any later paragraphs render after it.
 */
export function renderPost(md: string): RenderedPost {
    let body = md, faqMd = '', after = '', faqHeading: string | undefined;
    const m = FAQ_HEADING.exec(md);
    if (m) {
        faqHeading = m[0].replace(/^##\s+/, '').trim();
        body = md.slice(0, m.index);
        const rest = md.slice(m.index + m[0].length);
        const next = /^##\s/m.exec(rest);
        faqMd = next ? rest.slice(0, next.index) : rest;
        after = next ? rest.slice(next.index) : '';
    }
    const faq: Faq[] = []; const trailing: string[] = [];
    for (const block of faqMd.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)) {
        const qa = /^\*\*(.+?)\*\*\s*\n([\s\S]+)$/.exec(block);
        if (qa && trailing.length === 0) faq.push({ q: qa[1].trim(), a: toHtml(qa[2].trim()) });
        else trailing.push(block);
    }
    const html = toHtml(body);
    const toc = [...html.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)].map((x) => ({ id: x[1], text: x[2].replace(/<[^>]+>/g, '') }));
    if (faq.length && faqHeading) toc.push({ id: 'faq', text: faqHeading });
    return { html, afterFaqHtml: toHtml([trailing.join('\n\n'), after].filter(Boolean).join('\n\n')), toc, faq, faqHeading };
}

/** Safe for a script tag: blocks </script> breakouts and HTML comment tricks. */
export const ldJson = (s: string) => s.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

export const formatDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildRss(posts: Post[]): string {
    const items = posts.map((p) => `<item><title>${esc(p.title)}</title><link>${SITE_URL}/blog/${p.slug}</link><guid>${SITE_URL}/blog/${p.slug}</guid><pubDate>${new Date(`${p.date}T00:00:00Z`).toUTCString()}</pubDate><description>${esc(p.description)}</description><category>${esc(p.category)}</category></item>`).join('');
    return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>freeabtest.com blog</title><link>${SITE_URL}/blog</link><description>Practical guides to A/B testing.</description>${items}</channel></rss>`;
}
