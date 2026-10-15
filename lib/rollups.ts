import { sql, type SQL } from 'drizzle-orm';
import { getDb } from './db/client';
import type { LiveCounts } from './liveStats';

/**
 * Results rollups. Closed UTC days are summarised once into experiment_stats_daily; reads add
 * today's raw events on top. Visitor counts use first-seen days (a visitor counts on the first day
 * they appear in a bucket), so summing days gives the same distinct counts as scanning raw events.
 */

const ALL = '*';
type Kind = 'v' | 't' | 'g';

export function dayStart(now = new Date()): string {
    return now.toISOString().slice(0, 10);
}

function nextDay(day: string): string {
    const d = new Date(`${day}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
}

const n = (x: unknown) => Number(x) || 0;

/** Visitors first seen per bucket in [from, to). to = null means open ended (today). */
async function firstSeen(experimentId: string, scope: string, kind: Kind, from: string, to: string | null) {
    const d = await getDb();
    const envE = scope === ALL ? sql`` : sql` and e.environment_id = ${scope}`;
    const envP = scope === ALL ? sql`` : sql` and p.environment_id = e.environment_id`;
    const toCond = to ? sql` and e.created_at < ${to}` : sql``;
    let key: SQL;
    let match: SQL;
    let filter: SQL = sql``;
    if (kind === 'v') {
        key = sql`''`;
        match = sql``;
    } else if (kind === 't') {
        key = sql`e.event_type`;
        match = sql` and p.event_type = e.event_type`;
    } else {
        key = sql`coalesce(e.goal_id, '')`;
        match = sql` and p.event_type = 'conversion' and coalesce(p.goal_id, '') = coalesce(e.goal_id, '')`;
        filter = sql` and e.event_type = 'conversion'`;
    }
    const rows = await d.all<{ variation_id: string; k: string; users: number; events: number }>(sql`
        select e.variation_id as variation_id, ${key} as k,
            count(distinct case when not exists (
                select 1 from events p where p.experiment_id = e.experiment_id and p.user_id = e.user_id
                and p.variation_id = e.variation_id${envP}${match} and p.created_at < ${from}
            ) then e.user_id end) as users,
            count(*) as events
        from events e
        where e.experiment_id = ${experimentId} and e.created_at >= ${from}${toCond}${envE}${filter}
        group by e.variation_id, ${key}`);
    return rows.map((r) => ({ variation_id: r.variation_id, bucket: kind === 'v' ? 'v' : `${kind}:${r.k}`, users: n(r.users), events: n(r.events) }));
}

async function dailyDistinct(experimentId: string, scope: string, from: string, to: string | null) {
    const d = await getDb();
    const envE = scope === ALL ? sql`` : sql` and environment_id = ${scope}`;
    const toCond = to ? sql` and created_at < ${to}` : sql``;
    const rows = await d.all<{ day: string; variation_id: string; users: number }>(sql`
        select substr(created_at, 1, 10) as day, variation_id, count(distinct user_id) as users
        from events where experiment_id = ${experimentId} and created_at >= ${from}${toCond}${envE}
        group by substr(created_at, 1, 10), variation_id`);
    return rows.map((r) => ({ ...r, users: n(r.users) }));
}

async function closeDay(experimentId: string, day: string): Promise<void> {
    const d = await getDb();
    const to = nextDay(day);
    const envs = await d.all<{ env: string }>(sql`select distinct environment_id as env from events
        where experiment_id = ${experimentId} and created_at >= ${day} and created_at < ${to} and environment_id is not null`);
    const scopes = [ALL, ...envs.map((e) => e.env)];
    const rows: Array<{ scope: string; variation_id: string; bucket: string; users: number; events: number }> = [];
    for (const scope of scopes) {
        for (const kind of ['v', 't', 'g'] as Kind[]) {
            for (const r of await firstSeen(experimentId, scope, kind, day, to)) rows.push({ scope, ...r });
        }
        for (const r of await dailyDistinct(experimentId, scope, day, to)) rows.push({ scope, variation_id: r.variation_id, bucket: 'd', users: r.users, events: 0 });
    }
    if (!rows.length) return;
    // Recomputing a closed day gives the same numbers, so concurrent rollups are safe.
    await d.batch(rows.map((r) => d.run(sql`insert into experiment_stats_daily (experiment_id, scope, variation_id, day, bucket, users, events)
        values (${experimentId}, ${r.scope}, ${r.variation_id}, ${day}, ${r.bucket}, ${r.users}, ${r.events})
        on conflict (experiment_id, scope, variation_id, day, bucket) do update set users = excluded.users, events = excluded.events`)) as never);
}

/** Rolls up every closed day not yet summarised. Also serves as the backfill for existing data. */
export async function ensureRolledUp(experimentId: string, now = new Date()): Promise<string> {
    const d = await getDb();
    const today = dayStart(now);
    const [state] = await d.all<{ rolled_through: string }>(sql`select rolled_through from rollup_state where experiment_id = ${experimentId}`);
    const from = state ? nextDay(state.rolled_through) : '0000-00-00';
    if (from >= today) return today;
    const days = await d.all<{ day: string }>(sql`select distinct substr(created_at, 1, 10) as day from events
        where experiment_id = ${experimentId} and created_at >= ${from} and created_at < ${today} order by day`);
    for (const { day } of days) await closeDay(experimentId, day);
    const yesterday = new Date(`${today}T00:00:00.000Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const through = yesterday.toISOString().slice(0, 10);
    await d.run(sql`insert into rollup_state (experiment_id, rolled_through) values (${experimentId}, ${through})
        on conflict (experiment_id) do update set rolled_through = max(rolled_through, excluded.rolled_through)`);
    return today;
}

/** Bucket totals: rolled-up closed days plus today's raw events. */
async function bucketTotals(experimentId: string, environmentId: string | undefined, now: Date) {
    const today = await ensureRolledUp(experimentId, now);
    const scope = environmentId ?? ALL;
    const d = await getDb();
    const rolled = await d.all<{ variation_id: string; bucket: string; users: number; events: number }>(sql`
        select variation_id, bucket, sum(users) as users, sum(events) as events from experiment_stats_daily
        where experiment_id = ${experimentId} and scope = ${scope} and bucket <> 'd' and day < ${today}
        group by variation_id, bucket`);
    const map = new Map<string, { variation_id: string; bucket: string; users: number; events: number }>();
    const add = (r: { variation_id: string; bucket: string; users: number; events: number }) => {
        const k = `${r.variation_id}|${r.bucket}`;
        const cur = map.get(k) ?? { variation_id: r.variation_id, bucket: r.bucket, users: 0, events: 0 };
        cur.users += n(r.users);
        cur.events += n(r.events);
        map.set(k, cur);
    };
    rolled.forEach(add);
    for (const kind of ['v', 't', 'g'] as Kind[]) (await firstSeen(experimentId, scope, kind, today, null)).forEach(add);
    return { rows: [...map.values()], today, scope };
}

/** Same shape and numbers as the raw-event query in db.getEventStats. */
export async function rolledEventStats(experimentId: string, environmentId?: string, goalId?: string | null, now = new Date()) {
    const { rows } = await bucketTotals(experimentId, environmentId, now);
    const convBucket = goalId ? `g:${goalId}` : 't:conversion';
    return rows
        .filter((r) => r.bucket === 'v' && r.users > 0)
        .map((v) => ({
            variation_id: v.variation_id,
            total_users: v.users,
            conversions: rows.find((r) => r.variation_id === v.variation_id && r.bucket === convBucket)?.users ?? 0,
        }));
}

/** Same shape and numbers as the raw-event query in db.getLiveCounts. */
export async function rolledLiveCounts(experimentId: string, environmentId?: string, now = new Date()): Promise<LiveCounts> {
    const { rows, today, scope } = await bucketTotals(experimentId, environmentId, now);
    const d = await getDb();
    const rolledDaily = await d.all<{ day: string; variation_id: string; users: number }>(sql`
        select day, variation_id, users from experiment_stats_daily
        where experiment_id = ${experimentId} and scope = ${scope} and bucket = 'd' and day < ${today}`);
    const daily = [...rolledDaily.map((r) => ({ ...r, users: n(r.users) })), ...(await dailyDistinct(experimentId, scope, today, null))]
        .sort((a, b) => a.day.localeCompare(b.day));
    return {
        byType: rows.filter((r) => r.bucket.startsWith('t:')).map((r) => ({ variation_id: r.variation_id, event_type: r.bucket.slice(2), users: r.users, events: r.events })),
        visitors: rows.filter((r) => r.bucket === 'v').map((r) => ({ variation_id: r.variation_id, users: r.users })),
        goals: rows.filter((r) => r.bucket.startsWith('g:')).map((r) => ({ goal_id: r.bucket.slice(2) || null, variation_id: r.variation_id, users: r.users })),
        daily,
    };
}
