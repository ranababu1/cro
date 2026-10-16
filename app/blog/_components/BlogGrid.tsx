'use client';
import { useState } from 'react';
import { PostCard, type CardPost } from './PostCard';

/** Category chips filter the card grid in place. Server renders all posts, so it works without JS too. */
export function BlogGrid({ posts, categories }: { posts: CardPost[]; categories: string[] }) {
    const [active, setActive] = useState('All');
    const shown = active === 'All' ? posts : posts.filter((p) => p.category === active);
    const chips = ['All', ...categories];
    return (
        <section aria-labelledby="all-posts" className="mt-20">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <h2 id="all-posts" className="text-[24px] font-bold tracking-[-0.02em] text-[#0b1630]">All articles</h2>
                {chips.length > 2 && (
                    <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
                        {chips.map((c) => (
                            <button key={c} type="button" aria-pressed={active === c} onClick={() => setActive(c)}
                                className={`rounded-full px-4 py-1.5 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 motion-reduce:transition-none ${active === c ? 'bg-[#0b1630] text-white' : 'bg-white text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:bg-blue-50 hover:text-blue-800 hover:ring-blue-200'}`}>
                                {c}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <p className="sr-only" aria-live="polite">{shown.length} articles shown</p>
            {shown.length ? (
                <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {shown.map((p) => <li key={p.slug}><PostCard p={p} /></li>)}
                </ul>
            ) : <p className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500">New guides are on the way.</p>}
        </section>
    );
}
