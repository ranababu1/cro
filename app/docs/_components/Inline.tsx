import Link from 'next/link';
import { Fragment } from 'react';

const TOKEN = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

/** Renders the small inline syntax used in doc content: `code`, **bold** and [label](href). */
export function Inline({ text }: { text: string }) {
    const parts = text.split(TOKEN);
    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
                    return <code key={i} className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.85em] text-zinc-800">{part.slice(1, -1)}</code>;
                }
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={i} className="font-semibold text-zinc-900">{part.slice(2, -2)}</strong>;
                }
                const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
                if (link) {
                    const [, label, href] = link;
                    const cls = 'font-medium text-brand-700 underline decoration-brand-200 underline-offset-2 hover:decoration-brand-600';
                    return href.startsWith('/') ? <Link key={i} href={href} className={cls}>{label}</Link> : <a key={i} href={href} className={cls}>{label}</a>;
                }
                return <Fragment key={i}>{part}</Fragment>;
            })}
        </>
    );
}
