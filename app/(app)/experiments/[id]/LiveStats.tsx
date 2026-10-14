import type { LiveStats as LiveStatsData, LiveGoal } from '@/lib/liveStats';
import { Card, CardHeader, CardBody, Badge, Table, THead, TBody, TR, TH, TD, Stat, Kbd, EmptyState } from '@/app/components/ui';

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const signed = (v: number) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
const COLORS = ['#94a3b8', '#2563eb', '#14b8a6', '#0d9488', '#7c3aed', '#f59e0b', '#ec4899', '#0ea5e9', '#84cc16', '#ef4444', '#64748b'];
const toneBadge = { ahead: 'success', behind: 'warning', early: 'neutral' } as const;

export function LiveStats({ live, running, updatedAt }: { live: LiveStatsData; running: boolean; updatedAt?: Date | null }) {
    const colorOf = (vid: string) => COLORS[live.variations.findIndex((v) => v.variation_id === vid) % COLORS.length];
    const empty = live.total_visitors === 0;
    const topGoal = live.goals[0];

    return (
        <div className="space-y-6" data-testid="live-stats">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    {running && <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-500" /></span>}
                    <h2 className="text-base font-semibold text-zinc-900">{running ? 'Live stats' : 'Stats'}</h2>
                    <Badge tone={toneBadge[live.headline.tone]}>{live.headline.status}</Badge>
                    {live.headline.goal && <span className="text-xs text-zinc-500">on {live.headline.goal}</span>}
                </div>
                <span className="text-xs text-zinc-500">
                    {running ? 'Refreshes every 30 seconds' : 'Not running'}{updatedAt ? `. Updated ${updatedAt.toLocaleTimeString()}` : ''}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Visitors" value={live.total_visitors.toLocaleString()} hint="Unique people in the test" />
                <Stat label="Redirected to variations" value={live.total_redirects.toLocaleString()} hint="Sent from the control URL" />
                <Stat label="Goal clicks" value={live.total_clicks.toLocaleString()} hint="Unique clickers, all goals" />
                <Stat label="Top goal" value={topGoal && topGoal.total_clicks > 0 ? topGoal.name : '-'} hint={topGoal && topGoal.total_clicks > 0 ? `${topGoal.total_clicks.toLocaleString()} clicks` : 'No clicks yet'} />
            </div>

            {empty ? (
                <Card>
                    <EmptyState title="Waiting for the first visitor" description="Stats show up here as soon as someone opens the control URL with the snippet installed." />
                </Card>
            ) : (
                <>
                    <Card>
                        <CardHeader title="Visitors by variation" description="Unique visitors in each arm. Redirected counts people sent from the control URL to the variation URL." />
                        <Table>
                            <THead><tr><TH>Variation</TH><TH align="right">Visitors</TH><TH align="right">Share</TH><TH align="right">Redirected</TH><TH align="right">Page views</TH></tr></THead>
                            <TBody>
                                {live.variations.map((v) => (
                                    <TR key={v.variation_id}>
                                        <TD>
                                            <span className="flex items-center gap-2 font-medium text-zinc-900">
                                                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colorOf(v.variation_id) }} />
                                                {v.name}{v.is_control && <Badge>Control</Badge>}
                                            </span>
                                        </TD>
                                        <TD numeric>{v.visitors.toLocaleString()}</TD>
                                        <TD numeric>{live.total_visitors ? pct(v.visitors / live.total_visitors) : '-'}</TD>
                                        <TD numeric>{v.is_control ? '-' : v.redirected.toLocaleString()}</TD>
                                        <TD numeric>{v.page_views.toLocaleString()}</TD>
                                    </TR>
                                ))}
                            </TBody>
                        </Table>
                    </Card>

                    <Card>
                        <CardHeader title="Visitors over time" description="Unique visitors per day (UTC)." />
                        <CardBody><DailyChart live={live} colorOf={colorOf} /></CardBody>
                    </Card>

                    <Card>
                        <CardHeader title="Goals ranked by clicks" description="Unique visitors who clicked each goal, by variation. Uplift is relative to the control with a 95% interval." />
                        <CardBody className="space-y-6">
                            {live.goals.length === 0 && <p className="text-sm text-zinc-500">This experiment has no goals.</p>}
                            {live.goals.map((g) => <GoalBlock key={g.goal_id} goal={g} colorOf={colorOf} />)}
                        </CardBody>
                    </Card>
                </>
            )}
        </div>
    );
}

function GoalBlock({ goal, colorOf }: { goal: LiveGoal; colorOf: (id: string) => string }) {
    const max = Math.max(1, ...goal.arms.map((a) => a.clicks));
    return (
        <div className="rounded-lg border border-zinc-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
                <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">#{goal.rank}</span>
                    <span className="font-medium text-zinc-900">{goal.name}</span>
                    <Kbd>{goal.selector}</Kbd>
                    {goal.is_primary && <Badge tone="brand">Primary</Badge>}
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-zinc-500">{goal.total_clicks.toLocaleString()} clicks</span>
                    <Badge tone={toneBadge[goal.tone]}>{goal.status}</Badge>
                </div>
            </div>
            <Table>
                <THead><tr><TH>Variation</TH><TH>Clicks</TH><TH align="right">Conversion rate</TH><TH align="right">95% interval</TH><TH align="right">Uplift vs control</TH></tr></THead>
                <TBody>
                    {goal.arms.map((a) => (
                        <TR key={a.variation_id}>
                            <TD className="font-medium text-zinc-900">{a.name}</TD>
                            <TD>
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-24 rounded bg-zinc-100"><div className="h-2 rounded" style={{ width: `${(a.clicks / max) * 100}%`, background: colorOf(a.variation_id) }} /></div>
                                    <span className="tabular-nums">{a.clicks.toLocaleString()}</span>
                                </div>
                            </TD>
                            <TD numeric><span className="font-medium text-zinc-900">{pct(a.rate, 2)}</span></TD>
                            <TD numeric className="text-zinc-500">{a.visitors ? `${pct(a.ci.lower, 2)} to ${pct(a.ci.upper, 2)}` : '-'}</TD>
                            <TD numeric>
                                {a.is_control ? <span className="text-zinc-400">Baseline</span> : a.uplift === null ? <span className="text-zinc-400">-</span> : (
                                    <span>
                                        <span className={a.uplift > 0 ? 'text-emerald-700' : a.uplift < 0 ? 'text-red-700' : ''}>{signed(a.uplift)}</span>
                                        {a.uplift_ci && <span className="ml-1 text-xs text-zinc-500">({signed(a.uplift_ci.lower)} to {signed(a.uplift_ci.upper)})</span>}
                                        {a.significant && <Badge tone="success" className="ml-2">Significant</Badge>}
                                    </span>
                                )}
                            </TD>
                        </TR>
                    ))}
                </TBody>
            </Table>
        </div>
    );
}

function DailyChart({ live, colorOf }: { live: LiveStatsData; colorOf: (id: string) => string }) {
    const days = live.daily;
    if (days.length === 0) return <p className="text-sm text-zinc-500">No visits yet.</p>;
    const W = 640, H = 180, P = 28;
    const max = Math.max(1, ...days.flatMap((d) => Object.values(d.by_variation)));
    const x = (i: number) => (days.length === 1 ? W / 2 : P + (i * (W - 2 * P)) / (days.length - 1));
    const y = (v: number) => H - P - (v / max) * (H - 2 * P);
    const label = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    return (
        <div>
            <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full" role="img" aria-label="Visitors per day by variation">
                {[0, 0.5, 1].map((t) => (
                    <g key={t}>
                        <line x1={P} x2={W - P} y1={y(max * t)} y2={y(max * t)} stroke="#e4e4e7" strokeDasharray="3 3" />
                        <text x={4} y={y(max * t) + 4} fontSize="10" fill="#71717a">{Math.round(max * t)}</text>
                    </g>
                ))}
                {live.variations.map((v) => (
                    <g key={v.variation_id}>
                        <polyline fill="none" stroke={colorOf(v.variation_id)} strokeWidth="2" points={days.map((d, i) => `${x(i)},${y(d.by_variation[v.variation_id] || 0)}`).join(' ')} />
                        {days.map((d, i) => <circle key={d.day} cx={x(i)} cy={y(d.by_variation[v.variation_id] || 0)} r="2.5" fill={colorOf(v.variation_id)} />)}
                    </g>
                ))}
                {days.map((d, i) => (i === 0 || i === days.length - 1 || days.length <= 8) && (
                    <text key={d.day} x={x(i)} y={H - 6} fontSize="10" fill="#71717a" textAnchor="middle">{label(d.day)}</text>
                ))}
            </svg>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-600">
                {live.variations.map((v) => (
                    <span key={v.variation_id} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: colorOf(v.variation_id) }} />{v.name}</span>
                ))}
            </div>
        </div>
    );
}
