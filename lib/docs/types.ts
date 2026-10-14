/**
 * In-product documentation model. Pages are plain data so they can be rendered, searched and tested.
 * Inline text supports `code`, **bold** and [label](/href).
 */
export type DiagramName = 'flow' | 'statuses' | 'bucketing' | 'interval';

export type Block =
    | { type: 'h2'; text: string; id?: string }
    | { type: 'h3'; text: string; id?: string }
    | { type: 'p'; text: string }
    | { type: 'list'; items: string[]; ordered?: boolean }
    | { type: 'code'; code: string; label?: string }
    | { type: 'callout'; tone: 'info' | 'warning' | 'success' | 'later'; title?: string; text: string }
    | { type: 'table'; head: string[]; rows: string[][] }
    | { type: 'steps'; items: { title: string; text: string }[] }
    | { type: 'diagram'; name: DiagramName; caption?: string }
    | { type: 'image'; src: string; alt: string; caption?: string };

export interface DocPage {
    slug: string;
    title: string;
    description: string;
    group: string;
    blocks: Block[];
}
