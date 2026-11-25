'use client';

import { useEffect, useState } from 'react';

/** On-page table of contents that highlights the section in view. */
export function Toc({ items }: { items: { id: string; text: string; level: 2 | 3 }[] }) {
    const [active, setActive] = useState(items[0]?.id);
    useEffect(() => {
        const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e);
        const obs = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActive(visible[0].target.id);
            },
            { rootMargin: '-80px 0px -70% 0px' },
        );
        els.forEach((e) => obs.observe(e));
        return () => obs.disconnect();
    }, [items]);
    if (!items.length) return null;
    return (
        <nav aria-label="On this page">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">On this page</p>
            <ul className="mt-3 space-y-1.5 border-l border-line text-sm">
                {items.map((i) => (
                    <li key={i.id}>
                        <a
                            href={`#${i.id}`}
                            className={`-ml-px block border-l py-0.5 ${i.level === 3 ? 'pl-6' : 'pl-3'} ${active === i.id ? 'border-accent-600 font-medium text-accent-700' : 'border-transparent text-muted hover:text-navy-950'}`}
                        >
                            {i.text}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
