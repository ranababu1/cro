# Scaling assessment (internal only, do not publish)

Date: 15 Oct 2026. Scope: Next.js 16 on Vercel serverless functions, Turso (libSQL), in-memory rate limiter, SDK bootstrap and track ingest, results queries.

## Short answer

Yes, the current architecture scales to roughly 1 to 3 million tracked pageviews a month on Turso's free tier and around 10 to 30 million on the $25 Scaler plan, with no rewrite. The hard ceiling is not Vercel; it is database writes per pageview and results queries that scan raw events. Fixing those (batching, rollups, cached config) moves the ceiling one to two orders of magnitude before any new infrastructure is needed. Heatmaps and recordings (Phase 2 and 3) should not go into Turso at all.

## How a pageview costs today

Bootstrap (every page load with the SDK), sequential round trips to Turso:
1. API key lookup (4 table join), plus a `last_used_at` write at most once a minute per key.
2. Telemetry bumps: `sdk_bootstrap` and `api_key_requests`, each an upsert into 3 scopes (platform, org, project) = 6 row writes.
3. Domain list, experiment match by URL (experiment + variations + goals), assignment lookup.
4. New visitor only: quota check = org lookup + `getOrgUsage`, which runs `count(distinct user_id)` over all assignments AND `count(*)` over all events for the org this month. This grows linearly with traffic and is the worst query on the hot path.
5. New visitor: assignment insert. Redirect: event insert.

Track (exposure or goal click): key lookup, domains, experiment, variations, goals, dedupe lookup, event insert, then 1 to 2 telemetry bumps across 4 scopes (4 to 8 row writes).

Rough cost per visitor session with one page and one goal click: about 15 to 20 rows written and 8 to 12 round trips. Each round trip from a Vercel function to Turso is about 5 to 40 ms depending on region, so bootstrap latency is 60 to 300 ms and grows with traffic because of step 4.

## Limits

Turso plans (source: https://turso.tech/pricing, checked 15 Oct 2026):

| Plan | Price | Rows read / month | Rows written / month | Storage |
|---|---|---|---|---|
| Free | $0 | 500 million | 10 million | 5 GB |
| Developer | $4.99 | 2.5 billion | 25 million | 9 GB |
| Scaler | $24.92 | 100 billion | 100 million | 24 GB |
| Pro | $416.58 | 250 billion | 250 million | 50 GB |

Overage is about $0.75 to $1 per extra million writes.

What that means at about 15 to 20 writes per visitor session:
- Free: about 0.5 to 0.7 million sessions a month before writes run out.
- Scaler: about 5 to 7 million sessions a month.
- Rows read: results and quota queries scan raw events. An org with 1 million events reads about 1 million rows per quota check per new visitor, so reads (not writes) will hit the cap first for any busy customer. This is the real bottleneck.

Throughput: libSQL is a single writer per database. Turso handles a few thousand simple writes a second; with 15+ writes per session the platform tops out around a few hundred sessions per second sustained (tens of millions a day on paper), well above current needs, but each busy customer competes with everyone else on one database.

Vercel: function concurrency scales automatically (default 1,000 concurrent on Pro per region, source: https://vercel.com/docs/functions/concurrency-scaling). Cost driver is function duration (GB-hours) and invocations; long Turso round trips multiply duration. Hobby has fair-use caps and forbids commercial use, so a paid Vercel plan is needed before charging customers.

Rate limiter: in process memory per function instance. With many warm instances each keeps its own counter, so the effective limit is `600 x instances` per minute. It does not protect the database under real abuse.

Storage: an events row is about 200 to 300 bytes with indexes. 10 million events is about 2 to 3 GB, so the 5 GB free tier holds roughly 20 million events. No retention policy exists today.

SDK: about 14.5 KB gzipped, served as a static file from the Vercel CDN, so delivery scales without cost concerns. It makes one bootstrap call per page and one call per event (no batching), which doubles invocations and DB work compared to batching.

## Real bottlenecks, ranked

1. Quota check scans all org events and assignments for the month on every new visitor.
2. Results and live stats run `count(distinct user_id)` over raw events, refreshed every 30 seconds per open Results tab.
3. Telemetry fan-out: up to 8 upserts per track call, all on the same hot rows (platform scope row is written by every request, a write hotspot).
4. Config reads (key, domains, experiment, variations, goals) repeated on every request, uncached.
5. One request per SDK event, no batching.
6. Per-instance rate limiter.
7. No data retention; events table grows forever.

## Fixes in order

1. Cache config (low effort, big win). Cache key lookup, domains and running experiment config in function memory for 30 to 60 seconds, invalidated on edit. Cuts 5 to 7 reads per request.
2. Usage counters instead of scans. Keep a monthly counter row per org (visitors, pageviews) updated with an upsert, and check quota against it with a short cache. Phase 1 pageview quotas will be built this way.
3. Rollup tables for results. Daily `experiment_stats_daily (experiment, variation, goal, env, day, visitors, conversions)` maintained on insert or by a cron every few minutes. Results read rollups plus today's raw rows. Distinct visitor counting via first-seen markers (the assignments table already gives one row per visitor per experiment).
4. Batch telemetry. Accumulate counters per instance and flush every few seconds or via `waitUntil`, or write telemetry only at platform and org scope and derive the rest from rollups. Removes the hotspot row.
5. SDK batching. Queue events in the SDK and send with `navigator.sendBeacon` every few seconds and on page hide; the track route accepts an array and inserts in one batch statement.
6. Shared rate limiter. Upstash Redis (serverless, pay per request) for rate limits and the hot quota counters. Needed once there are paying customers or abuse.
7. Edge ingest plus queue. Move `/api/track` to an edge function that validates against cached config and pushes to a queue (Upstash QStash, Vercel Queues, or Cloudflare Queues); a consumer writes batches to the database. Decouples page traffic from database latency.
8. Retention. Drop raw events older than 13 months once rollups exist; free plan keeps 90 days raw.
9. Split heavy tenants. Turso supports many databases cheaply; move very large orgs to their own database if one tenant dominates.
10. ClickHouse (or Tinybird) for heatmaps, scroll data and recordings metadata in Phase 2 and 3. Click coordinates and scroll depth are 10 to 100 times the event volume of A/B tests and need columnar storage. Recordings payloads go to object storage (R2 or S3), not a database.

## Recommendation

Do 1 to 4 during Phase 1 (they overlap with quota and results work), 5 and 6 before public launch of paid plans, and 7 to 10 when starting heatmaps. None of these change the customer install snippet.
