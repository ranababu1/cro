import type { Block } from '@/lib/docs/types';
import { headingId } from '@/lib/docs';
import { CodeBlock } from '@/app/components/ui';
import { Inline } from './Inline';
import { Diagram } from './Diagrams';

const calloutStyles = {
    info: { box: 'border-soft-blue bg-soft-blue/40', title: 'text-navy-950', label: 'Note' },
    warning: { box: 'border-amber-200 bg-amber-50', title: 'text-amber-900', label: 'Important' },
    success: { box: 'border-accent-100 bg-accent-50', title: 'text-accent-700', label: 'Tip' },
    later: { box: 'border-line bg-surface', title: 'text-navy-950', label: 'Coming later' },
};

function Anchor({ id }: { id: string }) {
    return <a href={`#${id}`} className="ml-2 text-slate-300 opacity-0 transition-opacity hover:text-accent-700 group-hover:opacity-100" aria-label="Link to this section">#</a>;
}

export function Blocks({ blocks }: { blocks: Block[] }) {
    return (
        <div className="space-y-5 text-[15px] leading-7 text-slate-700">
            {blocks.map((b, i) => {
                switch (b.type) {
                    case 'h2': {
                        const id = headingId(b);
                        return <h2 key={i} id={id} className="group scroll-mt-36 border-t border-line pt-8 text-xl font-semibold tracking-tight text-navy-950 first:border-0 first:pt-0"><Inline text={b.text} /><Anchor id={id} /></h2>;
                    }
                    case 'h3': {
                        const id = headingId(b);
                        return <h3 key={i} id={id} className="group scroll-mt-36 pt-2 text-base font-semibold text-navy-950"><Inline text={b.text} /><Anchor id={id} /></h3>;
                    }
                    case 'p':
                        return <p key={i}><Inline text={b.text} /></p>;
                    case 'list': {
                        const Tag = b.ordered ? 'ol' : 'ul';
                        return (
                            <Tag key={i} className={`space-y-2 pl-5 ${b.ordered ? 'list-decimal' : 'list-disc'} marker:text-muted`}>
                                {b.items.map((it, j) => <li key={j} className="pl-1"><Inline text={it} /></li>)}
                            </Tag>
                        );
                    }
                    case 'code':
                        return <CodeBlock key={i} label={b.label} code={b.code} />;
                    case 'callout': {
                        const s = calloutStyles[b.tone];
                        return (
                            <div key={i} className={`rounded-lg border px-4 py-3 text-sm leading-6 ${s.box}`}>
                                <p className={`font-semibold ${s.title}`}>{b.title ?? s.label}</p>
                                <p className="mt-1 text-slate-700"><Inline text={b.text} /></p>
                            </div>
                        );
                    }
                    case 'table':
                        return (
                            <div key={i} className="overflow-x-auto rounded-lg border border-line" tabIndex={0}>
                                <table className="w-full min-w-[32rem] text-left text-sm">
                                    <thead className="bg-surface text-xs font-medium text-muted">
                                        <tr>{b.head.map((h, j) => <th key={j} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
                                    </thead>
                                    <tbody className="divide-y divide-line">
                                        {b.rows.map((r, j) => (
                                            <tr key={j}>{r.map((c, k) => <td key={k} className={`px-4 py-2.5 align-top ${k === 0 ? 'font-medium text-navy-950' : ''}`}><Inline text={c} /></td>)}</tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    case 'steps':
                        return (
                            <ol key={i} className="space-y-4">
                                {b.items.map((s, j) => (
                                    <li key={j} className="flex gap-4">
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-50 text-sm font-semibold text-accent-700 ring-1 ring-accent-100">{j + 1}</span>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-navy-950">{s.title}</p>
                                            <p className="text-sm leading-6"><Inline text={s.text} /></p>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        );
                    case 'diagram':
                        return (
                            <figure key={i} className="rounded-lg border border-line bg-surface p-4">
                                <Diagram name={b.name} />
                                {b.caption && <figcaption className="mt-3 text-center text-xs text-muted">{b.caption}</figcaption>}
                            </figure>
                        );
                    case 'image':
                        return (
                            <figure key={i}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={b.src} alt={b.alt} className="w-full rounded-lg border border-line" loading="lazy" />
                                {b.caption && <figcaption className="mt-2 text-center text-xs text-muted">{b.caption}</figcaption>}
                            </figure>
                        );
                }
            })}
        </div>
    );
}
