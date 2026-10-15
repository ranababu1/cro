import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export const SITE_URL = 'https://www.freeabtest.com';
const DIR = path.join(process.cwd(), 'content/blog');

export type Post = {
    slug: string; title: string; description: string; date: string; updated: string; author: string;
    keywords: string[]; readingMinutes: number; markdown: string; articleSchema?: string; faqSchema?: string;
};

const iso = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ''));

/** Parse and re-serialise a JSON-LD string so only valid JSON is ever injected. */
function json(v: unknown): string | undefined {
    if (!v) return undefined;
    return JSON.stringify(typeof v === 'string' ? JSON.parse(v) : v);
}

export function parsePost(file: string, raw: string): Post {
    const { data, content } = matter(raw);
    const slug = String(data.slug || path.basename(file, '.md'));
    const words = content.split(/\s+/).filter(Boolean).length;
    return {
        slug, title: String(data.title), description: String(data.meta_description ?? data.description ?? ''),
        date: iso(data.date), updated: iso(data.updated ?? data.date), author: String(data.author ?? 'freeabtest.com'),
        keywords: Array.isArray(data.keywords) ? data.keywords.map(String) : [],
        readingMinutes: Math.max(1, Math.round(words / 220)), markdown: content,
        articleSchema: json(data.article_schema), faqSchema: json(data.faq_schema),
    };
}

export function getAllPosts(): Post[] {
    if (!fs.existsSync(DIR)) return [];
    return fs.readdirSync(DIR).filter((f) => f.endsWith('.md'))
        .map((f) => parsePost(f, fs.readFileSync(path.join(DIR, f), 'utf8')))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));
}

export const getPost = (slug: string) => getAllPosts().find((p) => p.slug === slug);

export function renderMarkdown(md: string): string {
    const html = marked.parse(md, { async: false, gfm: true }) as string;
    return sanitizeHtml(html, {
        allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'h1', 'h2'],
        allowedAttributes: { a: ['href', 'title'], img: ['src', 'alt', 'title'], th: ['align'], td: ['align'] },
        allowedSchemes: ['http', 'https', 'mailto'],
        transformTags: {
            a: (tag, attribs) => (/^https?:/.test(attribs.href ?? '') && !attribs.href.startsWith(SITE_URL)
                ? { tagName: 'a', attribs: { ...attribs, rel: 'noopener', target: '_blank' } }
                : { tagName: tag, attribs }),
        },
    });
}

/** Safe for a script tag: blocks </script> breakouts and HTML comment tricks. */
export const ldJson = (s: string) => s.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

export const formatDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildRss(posts: Post[]): string {
    const items = posts.map((p) => `<item><title>${esc(p.title)}</title><link>${SITE_URL}/blog/${p.slug}</link><guid>${SITE_URL}/blog/${p.slug}</guid><pubDate>${new Date(`${p.date}T00:00:00Z`).toUTCString()}</pubDate><description>${esc(p.description)}</description></item>`).join('');
    return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>freeabtest.com blog</title><link>${SITE_URL}/blog</link><description>Practical guides to A/B testing.</description>${items}</channel></rss>`;
}
