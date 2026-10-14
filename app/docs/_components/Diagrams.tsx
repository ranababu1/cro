import type { DiagramName } from '@/lib/docs/types';

const box = 'fill-white stroke-zinc-300';
const text = { fontSize: 12, fill: '#27272a' } as const;
const sub = { fontSize: 10, fill: '#71717a' } as const;

function Arrow({ x1, y1, x2, y2, label }: { x1: number; y1: number; x2: number; y2: number; label?: string }) {
    return (
        <g>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2563eb" strokeWidth="1.5" markerEnd="url(#arrow)" />
            {label && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" style={sub}>{label}</text>}
        </g>
    );
}

function Defs() {
    return (
        <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 10 5 0 10z" fill="#2563eb" />
            </marker>
        </defs>
    );
}

function Flow() {
    return (
        <svg viewBox="0 0 640 200" className="w-full" role="img" aria-label="Your page with the SDK calls assign and track on the API, which stores assignments and events in the database. The dashboard reads results from the same database.">
            <Defs />
            <rect x="10" y="60" width="150" height="80" rx="10" className={box} />
            <text x="85" y="94" textAnchor="middle" style={text}>Your page</text>
            <text x="85" y="112" textAnchor="middle" style={sub}>sdk.js</text>
            <rect x="245" y="60" width="150" height="80" rx="10" className="fill-brand-50 stroke-brand-200" />
            <text x="320" y="94" textAnchor="middle" style={text}>freeabtest.com API</text>
            <text x="320" y="112" textAnchor="middle" style={sub}>/api/assign, /api/track</text>
            <rect x="480" y="20" width="150" height="60" rx="10" className={box} />
            <text x="555" y="55" textAnchor="middle" style={text}>Database</text>
            <rect x="480" y="120" width="150" height="60" rx="10" className="fill-teal-50 stroke-teal-200" />
            <text x="555" y="155" textAnchor="middle" style={text}>Dashboard results</text>
            <Arrow x1={162} y1={85} x2={243} y2={85} label="assign" />
            <Arrow x1={243} y1={118} x2={162} y2={118} label="variation" />
            <Arrow x1={397} y1={80} x2={478} y2={55} label="store" />
            <Arrow x1={555} y1={82} x2={555} y2={118} />
        </svg>
    );
}

function Statuses() {
    const nodes = [
        { x: 20, label: 'Draft' },
        { x: 190, label: 'Running' },
        { x: 360, label: 'Paused' },
        { x: 530, label: 'Completed' },
    ];
    return (
        <svg viewBox="0 0 640 170" className="w-full" role="img" aria-label="Draft goes to Running. Running goes to Paused or Completed. Paused goes back to Running or to Completed.">
            <Defs />
            {nodes.map((n) => (
                <g key={n.label}>
                    <rect x={n.x} y="60" width="100" height="44" rx="22" className={n.label === 'Running' ? 'fill-emerald-50 stroke-emerald-300' : box} />
                    <text x={n.x + 50} y="87" textAnchor="middle" style={text}>{n.label}</text>
                </g>
            ))}
            <Arrow x1={122} y1={82} x2={188} y2={82} label="Start" />
            <Arrow x1={292} y1={74} x2={358} y2={74} label="Pause" />
            <Arrow x1={358} y1={92} x2={292} y2={92} />
            <text x="325" y="114" textAnchor="middle" style={sub}>Resume</text>
            <Arrow x1={462} y1={82} x2={528} y2={82} label="Complete" />
            <path d="M240 106 C 300 160, 520 160, 576 108" fill="none" stroke="#2563eb" strokeWidth="1.5" markerEnd="url(#arrow)" />
            <text x="410" y="160" textAnchor="middle" style={sub}>Complete</text>
        </svg>
    );
}

function Bucketing() {
    return (
        <svg viewBox="0 0 640 190" className="w-full" role="img" aria-label="All visitors pass a traffic allocation check. Those inside are split by weights into variations. Those outside see the default page and are not counted.">
            <Defs />
            <rect x="10" y="70" width="120" height="50" rx="10" className={box} />
            <text x="70" y="100" textAnchor="middle" style={text}>All visitors</text>
            <rect x="200" y="70" width="140" height="50" rx="10" className="fill-brand-50 stroke-brand-200" />
            <text x="270" y="93" textAnchor="middle" style={text}>Traffic allocation</text>
            <text x="270" y="109" textAnchor="middle" style={sub}>share of visitors</text>
            <rect x="420" y="15" width="200" height="40" rx="8" className="fill-teal-50 stroke-teal-200" />
            <text x="520" y="40" textAnchor="middle" style={text}>Control (weight 50)</text>
            <rect x="420" y="65" width="200" height="40" rx="8" className="fill-teal-50 stroke-teal-200" />
            <text x="520" y="90" textAnchor="middle" style={text}>Variant B (weight 50)</text>
            <rect x="420" y="135" width="200" height="40" rx="8" className={box} />
            <text x="520" y="160" textAnchor="middle" style={sub}>Outside: default page, not counted</text>
            <Arrow x1={132} y1={95} x2={198} y2={95} />
            <Arrow x1={342} y1={88} x2={418} y2={40} label="inside" />
            <Arrow x1={342} y1={92} x2={418} y2={85} />
            <Arrow x1={342} y1={104} x2={418} y2={152} label="outside" />
        </svg>
    );
}

function Interval() {
    const rows = [
        { label: 'Control', lo: 3.8, hi: 6.5, mid: 5.0, color: '#52525b' },
        { label: 'Variant B', lo: 6.0, hi: 9.0, mid: 7.4, color: '#0d9488' },
        { label: 'Variant C', lo: 3.6, hi: 7.6, mid: 5.4, color: '#2563eb' },
    ];
    const x = (v: number) => 110 + (v / 10) * 500;
    return (
        <svg viewBox="0 0 640 150" className="w-full" role="img" aria-label="Example: Variant B's interval sits clearly above the control's. Variant C's interval overlaps the control's.">
            {[0, 2, 4, 6, 8, 10].map((t) => (
                <g key={t}>
                    <line x1={x(t)} x2={x(t)} y1="10" y2="115" stroke="#f4f4f5" />
                    <text x={x(t)} y="132" textAnchor="middle" style={sub}>{t}%</text>
                </g>
            ))}
            {rows.map((r, i) => (
                <g key={r.label}>
                    <text x="10" y={34 + i * 32} style={text}>{r.label}</text>
                    <line x1={x(r.lo)} x2={x(r.hi)} y1={30 + i * 32} y2={30 + i * 32} stroke={r.color} strokeWidth="6" strokeLinecap="round" opacity=".35" />
                    <circle cx={x(r.mid)} cy={30 + i * 32} r="5" fill={r.color} />
                </g>
            ))}
            <text x="630" y="146" textAnchor="end" style={sub}>Example data</text>
        </svg>
    );
}

export function Diagram({ name }: { name: DiagramName }) {
    switch (name) {
        case 'flow': return <Flow />;
        case 'statuses': return <Statuses />;
        case 'bucketing': return <Bucketing />;
        case 'interval': return <Interval />;
    }
}
