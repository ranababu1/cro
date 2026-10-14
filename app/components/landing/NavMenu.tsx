/** Hover and keyboard friendly dropdown built with CSS only (group-hover and focus-within). */
export function NavMenu({ label, items }: { label: string; items: { href: string; title: string; body: string }[] }) {
    return (
        <div className="group relative">
            <button type="button" className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:text-zinc-900" aria-haspopup="true">
                {label}
                <svg viewBox="0 0 20 20" className="h-4 w-4 text-zinc-400 transition-transform group-hover:rotate-180" aria-hidden>
                    <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>
            <div className="invisible absolute left-0 top-full z-30 w-72 pt-2 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                <div className="rounded-xl border border-zinc-200 bg-white p-2 shadow-pop">
                    {items.map((i) => (
                        <a key={i.title} href={i.href} className="block rounded-lg px-3 py-2.5 hover:bg-zinc-50">
                            <span className="block text-sm font-medium text-zinc-900">{i.title}</span>
                            <span className="block text-xs text-zinc-500">{i.body}</span>
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
}
