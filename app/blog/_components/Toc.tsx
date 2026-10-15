'use client';
import { useEffect, useState } from 'react';

/** Table of contents with scroll-spy: highlights the H2 nearest the top of the viewport. */
export function Toc({ items }: { items: { id: string; text: string }[] }) {
    const [active, setActive] = useState(items[0]?.id);
    useEffect(() => {
        const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e);
        const obs = new IntersectionObserver((entries) => {
            const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
            if (visible[0]) setActive(visible[0].target.id);
        }, { rootMargin: '-80px 0px -70% 0px' });
        els.forEach((e) => obs.observe(e));
        return () => obs.disconnect();
    }, [items]);
    return (
        <nav aria-label="On this page" className="text-[14px]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-500">On this page</p>
            <ol className="mt-4 space-y-1 border-l border-zinc-200">
                {items.map((i) => (
                    <li key={i.id}>
                        <a href={`#${i.id}`} aria-current={active === i.id ? 'location' : undefined}
                            className={`-ml-px block border-l-2 py-1.5 pl-4 leading-snug transition-colors motion-reduce:transition-none ${active === i.id ? 'border-blue-600 font-medium text-blue-700' : 'border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-900'}`}>
                            {i.text}
                        </a>
                    </li>
                ))}
            </ol>
        </nav>
    );
}
