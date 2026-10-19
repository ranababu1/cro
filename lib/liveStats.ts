import { describeGoal } from './goals';
/**
 * Live stats for a running experiment: visitors, redirects, goal clicks by
 * variation, conversion rates with Wilson 95% intervals, uplift vs control
 * and a plain-language status. Pure functions so they are easy to test.
 */
import { calculateConfidenceInterval } from './statistics';
import { chanceToBeatControl, sequentialTest } from './sequential';

export interface LiveCounts {
    byType: { variation_id: string; event_type: string; users: number; events: number }[];
    visitors: { variation_id: string; users: number }[];
    goals: { goal_id: string | null; variation_id: string; users: number }[];
    daily: { day: string; variation_id: string; users: number }[];
}

export interface LiveVariation {
    variation_id: string;
    name: string;
    is_control: boolean;
    url: string | null;
    visitors: number;
    page_views: number;
    redirected: number;
    redirects: number;
}

export interface LiveGoalArm {
    variation_id: string;
    name: string;
    is_control: boolean;
    visitors: number;
    clicks: number;
    rate: number;
    ci: { lower: number; upper: number };
    /** Relative uplift vs control, e.g. 0.12 = +12%. Null for the control or when control has no clicks. */
    uplift: number | null;
    uplift_ci: { lower: number; upper: number } | null;
    /** Peeking-safe sequential p-value against the control. */
    p_value: number | null;
    significant: boolean;
    /** Probability this version beats the control, null for the control. */
    chance_to_beat: number | null;
}

export type LiveTone = 'ahead' | 'behind' | 'early';

export interface LiveGoal {
    goal_id: string;
    name: string;
    selector: string;
    is_primary: boolean;
    total_clicks: number;
    rank: number;
    arms: LiveGoalArm[];
    status: string;
    tone: LiveTone;
    leader: string | null;
}

export interface LiveStats {
    generated_at: string;
    total_visitors: number;
    total_redirects: number;
    total_clicks: number;
    variations: LiveVariation[];
    goals: LiveGoal[];
    headline: { status: string; tone: LiveTone; goal: string | null };
    daily: { day: string; total: number; by_variation: Record<string, number> }[];
}

interface VariationIn { id: string; name: string; is_control: boolean; url?: string | null }
interface GoalIn { id: string; name: string; selector: string; type?: string | null; match_type?: string | null; is_primary: boolean }

/** Relative uplift interval from Newcombe's hybrid score method (built on Wilson intervals). */
export function upliftInterval(ctlClicks: number, ctlN: number, varClicks: number, varN: number) {
    if (ctlN === 0 || varN === 0 || ctlClicks === 0) return null;
    const p1 = ctlClicks / ctlN;
    const p2 = varClicks / varN;
    const c1 = calculateConfidenceInterval(ctlClicks, ctlN);
    const c2 = calculateConfidenceInterval(varClicks, varN);
    const diff = p2 - p1;
    const lower = diff - Math.sqrt((p2 - c2.lower) ** 2 + (c1.upper - p1) ** 2);
    const upper = diff + Math.sqrt((c2.upper - p2) ** 2 + (p1 - c1.lower) ** 2);
    return { lower: lower / p1, upper: upper / p1 };
}

export function goalStatus(arms: LiveGoalArm[]): { status: string; tone: LiveTone; leader: string | null } {
    const control = arms.find((a) => a.is_control);
    const others = arms.filter((a) => !a.is_control);
    if (!control || others.length === 0) return { status: 'Too early to call', tone: 'early', leader: null };
    const winners = others.filter((a) => a.significant && a.rate > control.rate).sort((a, b) => b.rate - a.rate);
    if (winners.length) return { status: `${winners[0].name} is ahead`, tone: 'ahead', leader: winners[0].variation_id };
    if (others.every((a) => a.significant && a.rate < control.rate)) {
        return { status: 'Control is ahead', tone: 'behind', leader: control.variation_id };
    }
    return { status: 'Too early to call', tone: 'early', leader: null };
}

function fillDays(first: string, last: string, max = 90): string[] {
    const out: string[] = [];
    const d = new Date(`${first}T00:00:00Z`);
    const end = new Date(`${last}T00:00:00Z`).getTime();
    while (d.getTime() <= end && out.length < max) {
        out.push(d.toISOString().slice(0, 10));
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
}

export function buildLiveStats(variations: VariationIn[], goals: GoalIn[], counts: LiveCounts, now = new Date()): LiveStats {
    const visitorsBy = new Map(counts.visitors.map((v) => [v.variation_id, v.users]));
    const typed = (vid: string, type: string) => counts.byType.find((r) => r.variation_id === vid && r.event_type === type);
    const ordered = [...variations].sort((a, b) => Number(b.is_control) - Number(a.is_control));

    const liveVariations: LiveVariation[] = ordered.map((v) => ({
        variation_id: v.id,
        name: v.name,
        is_control: !!v.is_control,
        url: v.url ?? null,
        visitors: visitorsBy.get(v.id) || 0,
        page_views: typed(v.id, 'page_view')?.events || 0,
        redirected: typed(v.id, 'redirect')?.users || 0,
        redirects: typed(v.id, 'redirect')?.events || 0,
    }));

    const liveGoals: LiveGoal[] = goals.map((g) => {
        const control = liveVariations.find((v) => v.is_control);
        const clicksOf = (vid: string) => counts.goals.find((r) => r.goal_id === g.id && r.variation_id === vid)?.users || 0;
        const ctlClicks = control ? clicksOf(control.variation_id) : 0;
        const ctlN = control?.visitors || 0;
        const arms: LiveGoalArm[] = liveVariations.map((v) => {
            const clicks = clicksOf(v.variation_id);
            const rate = v.visitors > 0 ? clicks / v.visitors : 0;
            let p: number | null = null;
            let significant = false;
            let chance: number | null = null;
            if (!v.is_control && control) {
                // Peeking-safe: live stats are checked often, so the verdict uses the sequential test.
                const sig = sequentialTest(
                    { total_users: ctlN, conversions: ctlClicks, conversion_rate: ctlN ? ctlClicks / ctlN : 0 },
                    { total_users: v.visitors, conversions: clicks, conversion_rate: rate },
                    Math.max(1, liveVariations.length - 1),
                );
                p = sig.p_value;
                significant = sig.is_significant;
                chance = chanceToBeatControl({ total_users: ctlN, conversions: ctlClicks }, { total_users: v.visitors, conversions: clicks });
            }
            const ctlRate = ctlN ? ctlClicks / ctlN : 0;
            return {
                variation_id: v.variation_id,
                name: v.name,
                is_control: v.is_control,
                visitors: v.visitors,
                clicks,
                rate,
                ci: calculateConfidenceInterval(clicks, v.visitors),
                uplift: v.is_control || ctlRate === 0 ? null : (rate - ctlRate) / ctlRate,
                uplift_ci: v.is_control ? null : upliftInterval(ctlClicks, ctlN, clicks, v.visitors),
                p_value: p,
                significant,
                chance_to_beat: chance,
            };
        });
        return {
            goal_id: g.id,
            name: g.name,
            selector: describeGoal(g),
            is_primary: !!g.is_primary,
            total_clicks: arms.reduce((s, a) => s + a.clicks, 0),
            rank: 0,
            arms,
            ...goalStatus(arms),
        };
    });
    liveGoals
        .slice()
        .sort((a, b) => b.total_clicks - a.total_clicks)
        .forEach((g, i) => { g.rank = i + 1; });
    liveGoals.sort((a, b) => a.rank - b.rank);

    const primary = liveGoals.find((g) => g.is_primary) || liveGoals[0];

    const days = [...new Set(counts.daily.map((r) => r.day))].sort();
    const dayList = days.length ? fillDays(days[0], days[days.length - 1]) : [];
    const daily = dayList.map((day) => {
        const by_variation: Record<string, number> = {};
        for (const v of liveVariations) by_variation[v.variation_id] = 0;
        for (const r of counts.daily) if (r.day === day) by_variation[r.variation_id] = r.users;
        return { day, total: Object.values(by_variation).reduce((s, n) => s + n, 0), by_variation };
    });

    return {
        generated_at: now.toISOString(),
        total_visitors: liveVariations.reduce((s, v) => s + v.visitors, 0),
        total_redirects: liveVariations.reduce((s, v) => s + v.redirected, 0),
        total_clicks: liveGoals.reduce((s, g) => s + g.total_clicks, 0),
        variations: liveVariations,
        goals: liveGoals,
        headline: primary ? { status: primary.status, tone: primary.tone, goal: primary.name } : { status: 'Too early to call', tone: 'early', goal: null },
        daily,
    };
}
