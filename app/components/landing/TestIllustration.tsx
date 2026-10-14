// Layered variant cards for the "Test anything" section. Chips show product facts, not performance claims.

function Dots({ cols, rows, className }: { cols: number; rows: number; className: string }) {
    return (
        <div className={`absolute grid gap-[14px] ${className}`} style={{ gridTemplateColumns: `repeat(${cols}, 4px)` }} aria-hidden>
            {Array.from({ length: cols * rows }).map((_, i) => <span key={i} className="h-1 w-1 rounded-full bg-blue-400/70" />)}
        </div>
    );
}

function Room() {
    return (
        <svg viewBox="0 0 200 170" className="h-full w-full" aria-hidden>
            <defs>
                <linearGradient id="room-wall" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f8fafc" /><stop offset="1" stopColor="#e2e8f0" /></linearGradient>
                <linearGradient id="room-floor" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#e7e5e4" /><stop offset="1" stopColor="#d6d3d1" /></linearGradient>
                <linearGradient id="room-sky" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#e0f2fe" /><stop offset="1" stopColor="#f8fafc" /></linearGradient>
            </defs>
            <rect width="200" height="170" fill="url(#room-wall)" />
            <path d="M70 120V48a22 22 0 0 1 44 0v72z" fill="url(#room-sky)" />
            <path d="M126 120V58a16 16 0 0 1 32 0v62z" fill="url(#room-sky)" opacity=".9" />
            <path d="M166 120V66a11 11 0 0 1 22 0v54z" fill="url(#room-sky)" opacity=".8" />
            <rect x="0" y="0" width="22" height="170" fill="#f1f5f9" />
            <path d="M0 120h200v50H0z" fill="url(#room-floor)" />
            <path d="M70 120 40 170M114 120l26 50" stroke="#cbd5e1" strokeWidth=".8" />
            {/* big plant */}
            <path d="M40 150h22l-3 18H43z" fill="#a8a29e" />
            <g stroke="#3f6212" strokeWidth="1.4" fill="none"><path d="M51 150c0-22-2-40-8-58M51 150c2-20 8-36 16-48M51 150c-4-14-12-26-20-32" /></g>
            <g fill="#4d7c0f"><ellipse cx="42" cy="92" rx="7" ry="13" transform="rotate(-20 42 92)" /><ellipse cx="66" cy="102" rx="6" ry="12" transform="rotate(30 66 102)" /><ellipse cx="32" cy="118" rx="6" ry="11" transform="rotate(-50 32 118)" /><ellipse cx="56" cy="80" rx="5" ry="11" transform="rotate(10 56 80)" /><ellipse cx="60" cy="122" rx="5" ry="9" transform="rotate(45 60 122)" /></g>
            <g fill="#65a30d" opacity=".9"><ellipse cx="48" cy="104" rx="5" ry="10" transform="rotate(-5 48 104)" /><ellipse cx="38" cy="132" rx="4" ry="8" transform="rotate(-60 38 132)" /></g>
            {/* small plant */}
            <path d="M140 140h14l-2 12h-10z" fill="#a8a29e" />
            <g fill="#4d7c0f"><ellipse cx="142" cy="128" rx="4" ry="8" transform="rotate(-25 142 128)" /><ellipse cx="152" cy="126" rx="4" ry="8" transform="rotate(25 152 126)" /><ellipse cx="147" cy="120" rx="3.5" ry="8" /></g>
        </svg>
    );
}

export function TestIllustration() {
    return (
        <div className="relative mx-auto aspect-[740/480] w-full max-w-[740px]" aria-hidden>
            {/* soft shapes */}
            <div className="absolute left-[24%] top-[6%] h-[62%] w-[42%] rounded-full bg-blue-200/50 blur-[2px]" />
            <div className="absolute -left-[6%] bottom-[2%] h-[46%] w-[58%] rounded-[50%] bg-gradient-to-tr from-teal-100/80 via-sky-100/60 to-transparent blur-xl" />
            <div className="absolute left-[30%] top-[3%] h-[34%] w-[50%] rounded-full bg-violet-200/40 blur-2xl" />
            <Dots cols={7} rows={5} className="left-[3%] top-[15%]" />
            <Dots cols={7} rows={2} className="left-[38%] bottom-[2%]" />

            {/* Variant A, faded, behind */}
            <div className="absolute left-[5%] top-[40%] w-[40%] -rotate-[3deg] rounded-2xl border border-white/80 bg-white/70 p-[4%] shadow-[0_20px_40px_-20px_rgb(15_23_42/0.25)] backdrop-blur-sm">
                <div className="mb-3 flex gap-1"><span className="h-2 w-2 rounded-full bg-zinc-200" /><span className="h-2 w-2 rounded-full bg-zinc-200" /><span className="h-2 w-2 rounded-full bg-zinc-200" /></div>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-400">• Variant A</span>
                <p className="mt-4 text-[clamp(13px,1.5vw,21px)] font-semibold leading-[1.15] text-zinc-400">Smarter<br />decisions for<br />your business</p>
                <span className="mt-4 inline-block rounded-md bg-zinc-200 px-3 py-1.5 text-[11px] text-zinc-400">Get started</span>
            </div>

            {/* Variant B, main card */}
            <div className="absolute left-[25%] top-[5%] w-[52%] rotate-[3deg] rounded-2xl border border-zinc-100 bg-white p-[3.5%] shadow-[0_30px_60px_-20px_rgb(30_64_175/0.3)]">
                <div className="mb-3 flex gap-1.5"><span className="h-2 w-2 rounded-full bg-red-300" /><span className="h-2 w-2 rounded-full bg-amber-300" /><span className="h-2 w-2 rounded-full bg-emerald-300" /></div>
                <span className="rounded-full border border-teal-500 px-2.5 py-0.5 text-[12px] font-medium text-teal-700">Variant B</span>
                <p className="mt-4 text-[clamp(16px,2.6vw,30px)] font-bold leading-[1.12] tracking-tight text-zinc-900">Turn ideas<br />into real growth</p>
                <span className="mt-4 inline-block rounded-lg bg-blue-950 px-4 py-2 text-[12px] font-medium text-white">Get started</span>
                <div className="mt-6 h-3 w-[62%] rounded-full bg-amber-100" />
            </div>

            {/* image card */}
            <div className="absolute right-[4%] top-[33%] w-[33%] rotate-[3deg] overflow-hidden rounded-xl border-4 border-white bg-white shadow-[0_24px_50px_-18px_rgb(15_23_42/0.35)]">
                <div className="aspect-[200/170]"><Room /></div>
            </div>

            {/* chips */}
            <div className="absolute right-[4%] top-[2%] rounded-xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white px-[3%] py-[2.2%] shadow-[0_16px_40px_-16px_rgb(13_148_136/0.45)]">
                <p className="flex items-center gap-2 text-[clamp(18px,2.4vw,30px)] font-bold leading-none text-teal-700">
                    <svg viewBox="0 0 24 24" className="h-[0.9em] w-[0.9em]" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d="M6 18 18 6M9 6h9v9" /></svg>
                    95%
                </p>
                <p className="mt-1.5 text-[clamp(10px,1vw,13px)] text-zinc-600">Confidence intervals</p>
            </div>
            <div className="absolute left-[27%] top-[64%] flex items-center gap-3 rounded-xl border border-zinc-100 bg-white px-[2.6%] py-[2%] shadow-[0_16px_40px_-16px_rgb(37_99_235/0.4)]">
                <svg viewBox="0 0 28 28" className="h-[clamp(22px,2.6vw,34px)] w-[clamp(22px,2.6vw,34px)] text-blue-600" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden><path d="M5 23v-7M11.5 23V11M18 23V14M24 23V5" /></svg>
                <div>
                    <p className="text-[clamp(16px,2vw,26px)] font-bold leading-none text-blue-700">26</p>
                    <p className="mt-1 text-[clamp(10px,1vw,13px)] text-zinc-600">Variations max</p>
                </div>
            </div>

            {/* curly line */}
            <svg viewBox="0 0 120 50" className="absolute bottom-[3%] right-[22%] w-[18%] text-blue-600" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                <path d="M4 40c12 4 22-4 30-14s4-16-2-12-2 22 12 24 30-8 40-22 20-12 30-10" />
            </svg>
        </div>
    );
}
