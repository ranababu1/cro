import type { Block, DocPage } from './types';
import { introduction } from './content/introduction';
import { quickStart } from './content/quickStart';
import { installGuides } from './content/installGuides';
import { sdk } from './content/sdk';
import { experiments } from './content/experiments';
import { variations } from './content/variations';
import { goals } from './content/goals';
import { results } from './content/results';
import { winners } from './content/winners';
import { restApi } from './content/restApi';
import { environments } from './content/environments';
import { organizations } from './content/organizations';
import { troubleshooting } from './content/troubleshooting';

export type { Block, DocPage } from './types';

/** Reading order. The sidebar groups pages by `group` in this order. */
export const docPages: DocPage[] = [
    introduction, quickStart, installGuides, sdk, experiments, variations, goals, results, winners, restApi, environments, organizations, troubleshooting,
];

export function getDocPage(slug: string): DocPage | undefined {
    return docPages.find((p) => p.slug === slug);
}

export function docHref(slug: string): string {
    return `/docs/${slug}`;
}

export function slugify(text: string): string {
    return text.toLowerCase().replace(/[`*]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function headingId(block: Extract<Block, { type: 'h2' | 'h3' }>): string {
    return block.id ?? slugify(block.text);
}

export function navGroups(): { group: string; pages: DocPage[] }[] {
    const groups: { group: string; pages: DocPage[] }[] = [];
    for (const p of docPages) {
        let g = groups.find((x) => x.group === p.group);
        if (!g) groups.push((g = { group: p.group, pages: [] }));
        g.pages.push(p);
    }
    return groups;
}

export function tocFor(page: DocPage): { id: string; text: string; level: 2 | 3 }[] {
    return page.blocks
        .filter((b): b is Extract<Block, { type: 'h2' | 'h3' }> => b.type === 'h2' || b.type === 'h3')
        .map((b) => ({ id: headingId(b), text: stripInline(b.text), level: b.type === 'h2' ? 2 : 3 }));
}

/** Removes inline markup so text can be searched or shown plainly. */
export function stripInline(text: string): string {
    return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
}

/** All text of a block, used by search and by tests. */
export function blockText(b: Block): string {
    switch (b.type) {
        case 'h2': case 'h3': case 'p': return b.text;
        case 'list': return b.items.join(' ');
        case 'code': return b.code;
        case 'callout': return `${b.title ?? ''} ${b.text}`;
        case 'table': return [...b.head, ...b.rows.flat()].join(' ');
        case 'steps': return b.items.map((i) => `${i.title} ${i.text}`).join(' ');
        case 'diagram': return b.caption ?? '';
        case 'image': return `${b.alt} ${b.caption ?? ''}`;
    }
}

export interface SearchEntry {
    href: string;
    page: string;
    heading: string;
    text: string;
}

/** One entry per section (page intro plus each h2/h3), so results can link straight to a heading. */
export function buildSearchIndex(): SearchEntry[] {
    const out: SearchEntry[] = [];
    for (const p of docPages) {
        let cur: SearchEntry = { href: docHref(p.slug), page: p.title, heading: p.title, text: p.description };
        out.push(cur);
        for (const b of p.blocks) {
            if (b.type === 'h2' || b.type === 'h3') {
                cur = { href: `${docHref(p.slug)}#${headingId(b)}`, page: p.title, heading: stripInline(b.text), text: '' };
                out.push(cur);
            } else if (b.type !== 'code') {
                cur.text += ' ' + stripInline(blockText(b));
            } else {
                cur.text += ' ' + b.code.slice(0, 300);
            }
        }
    }
    for (const e of out) e.text = e.text.replace(/\s+/g, ' ').trim().slice(0, 1200);
    return out;
}
