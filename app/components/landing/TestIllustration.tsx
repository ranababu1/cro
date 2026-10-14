// Layered variant cards. Illustrative product UI, no performance claims.
export function TestIllustration() {
    return (
        <div className="relative mx-auto aspect-[5/4] w-full max-w-lg" aria-hidden>
            <div className="absolute left-[2%] top-[22%] grid grid-cols-6 gap-2 opacity-60">
                {Array.from({ length: 24 }).map((_, i) => <span key={i} className="h-1 w-1 rounded-full bg-sky-300" />)}
            </div>
            <div className="absolute left-[4%] top-[38%] w-[46%] -rotate-3 rounded-xl border border-zinc-200 bg-white/80 p-4 shadow-card">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">Original</span>
                <p className="mt-3 text-sm font-semibold leading-snug text-zinc-400">Smarter decisions for your business</p>
                <span className="mt-3 inline-block rounded bg-zinc-200 px-2 py-1 text-[10px] text-zinc-500">Get started</span>
            </div>
            <div className="absolute left-[22%] top-[10%] w-[62%] rotate-2 rounded-xl border border-zinc-200 bg-white p-5 shadow-pop">
                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-800 ring-1 ring-teal-200">Variant B</span>
                <div className="mt-3 grid grid-cols-[1.2fr_1fr] gap-3">
                    <div>
                        <p className="text-lg font-semibold leading-snug text-zinc-900">Turn ideas into real growth</p>
                        <span className="mt-3 inline-block rounded-md bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-white">Get started</span>
                    </div>
                    <svg viewBox="0 0 80 70" className="h-full w-full" aria-hidden>
                        <rect width="80" height="70" rx="6" fill="#f1f5f9" />
                        <rect x="48" y="10" width="22" height="40" rx="3" fill="#e2e8f0" />
                        <path d="M14 58c0-12 4-20 10-24M24 34c-6-2-10 2-10 2M24 34c4-6 10-6 10-6M24 40c-6 0-9 4-9 4" stroke="#0d9488" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                        <rect x="10" y="56" width="22" height="8" rx="2" fill="#cbd5e1" />
                    </svg>
                </div>
                <div className="mt-4 h-1.5 w-2/3 rounded-full bg-amber-100" />
            </div>
            <div className="absolute right-[0%] top-[0%] rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-pop">
                <p className="text-[10px] font-medium text-zinc-500">Traffic split</p>
                <p className="mt-0.5 text-lg font-semibold text-zinc-900 tabular-nums">50 / 50</p>
            </div>
            <div className="absolute bottom-[8%] left-[28%] flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-pop">
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-blue-600" aria-hidden><path d="M4 20V14M10 20V9M16 20V12M22 20V5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
                <div>
                    <p className="text-sm font-semibold text-zinc-900">95% interval</p>
                    <p className="text-[10px] text-zinc-500">per variation</p>
                </div>
            </div>
            <svg viewBox="0 0 120 40" className="absolute bottom-[2%] right-[6%] h-10 w-28 text-sky-500" aria-hidden>
                <path d="M4 30c20-24 40 10 60-4s30-18 52-8" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
        </div>
    );
}
