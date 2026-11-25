'use client';
import { useState } from 'react';
import { PostCard, type CardPost } from './PostCard';

/** Category chips filter the card grid in place. Server renders all posts, so it works without JS too. */
export function BlogGrid({ posts, categories }: { posts: CardPost[]; categories: string[] }) {
    const [active, setActive] = useState('All');
    const shown = active === 'All' ? posts : posts.filter((p) => p.category === active);
    const chips = ['All', ...categories];
    return (
        <section aria-labelledby="all-posts" className="mt-16">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <h2 id="all-posts" className="text-[24px] font-semibold tracking-[-0.02em] text-navy-950">All articles</h2>
                {chips.length > 2 && (
                    <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
                        {chips.map((c) => (
                            <button key={c} type="button" aria-pressed={active === c} onClick={() => setActive(c)}
                                className={`rounded-full px-4 py-1.5 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 motion-reduce:transition-none ${active === c ? 'bg-navy-950 text-white' : 'bg-white text-muted-strong ring-1 ring-inset ring-line hover:bg-surface hover:text-navy-950'}`}>
                                {c}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <p className="sr-only" aria-live="polite">{shown.length} articles shown</p>
            {shown.length ? (
                <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {shown.map((p) => <li key={p.slug}><PostCard p={p} /></li>)}
                </ul>
            ) : <p className="mt-8 rounded-xl border border-dashed border-line p-8 text-center text-muted">No articles in this category.</p>}
        </section>
    );
}
