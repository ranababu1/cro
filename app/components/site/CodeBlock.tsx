/** Dark code sample with a label. Code is shown as written; keep it in sync with the docs. */
export function CodeBlock({ label, code, className }: { label: string; code: string; className?: string }) {
    return (
        <figure className={`min-w-0 overflow-hidden rounded-xl border border-navy-800 bg-navy-950 ${className ?? ''}`}>
            <figcaption className="border-b border-white/10 px-4 py-2 text-[12px] font-medium text-slate-300">{label}</figcaption>
            <pre className="overflow-x-auto px-4 py-4 text-[13px] leading-[1.7] text-slate-100"><code className="font-mono">{code}</code></pre>
        </figure>
    );
}
