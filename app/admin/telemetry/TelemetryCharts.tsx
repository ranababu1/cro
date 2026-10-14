'use client';

export function Sparkline({
    values,
    labels,
    height = 64,
    stroke = '#2563eb',
}: {
    values: number[];
    labels?: string[];
    height?: number;
    stroke?: string;
}) {
    const w = 320;
    const h = height;
    const max = Math.max(1, ...values);
    const pts = values.map((v, i) => {
        const x = values.length <= 1 ? 0 : (i / (values.length - 1)) * (w - 8) + 4;
        const y = h - 4 - (v / max) * (h - 12);
        return `${x},${y}`;
    });
    const sum = values.reduce((a, b) => a + b, 0);
    return (
        <div className="w-full">
            <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full" preserveAspectRatio="none" role="img" aria-label={`Trend total ${sum}`}>
                <polyline fill="none" stroke={stroke} strokeWidth="2" points={pts.join(' ')} />
            </svg>
            {labels && labels.length > 1 && (
                <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
                    <span>{labels[0]}</span>
                    <span>{labels[labels.length - 1]}</span>
                </div>
            )}
        </div>
    );
}

export function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    return (
        <div className="flex items-center gap-3 text-sm">
            <div className="w-40 truncate text-zinc-600" title={label}>{label}</div>
            <div className="h-2 flex-1 rounded bg-zinc-100">
                <div className="h-2 rounded bg-blue-600" style={{ width: `${pct}%` }} />
            </div>
            <div className="w-16 text-right tabular-nums text-zinc-900">{value.toLocaleString()}</div>
        </div>
    );
}
