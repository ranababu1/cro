# Operations runbook (internal only, do not publish)

What to set up before launch and what to do when something breaks. Keep this current.

## 1. Environment variables added for SaaS readiness

| Variable | Needed | What it does |
|---|---|---|
| `OPS_ALERT_WEBHOOK_URL` | Strongly recommended | Slack or Discord incoming webhook (https). Server errors (throttled, one alert a minute per distinct error) and new support tickets and customer replies are posted here. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Recommended before paid launch | Shared rate limiting across all server instances (SDK per key and IP, secret-key API, unknown-key throttle). Without them each instance limits on its own. If the store is slow (over 250 ms) or down, limits fall back to per instance; traffic is never blocked by the store. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Optional | Adds Continue with GitHub on /signin. OAuth app callback: `https://<host>/api/auth/callback/github`. Only verified GitHub emails are accepted. |
| `UNKNOWN_KEY_LIMIT_PER_MINUTE` | Optional | Requests per minute per IP that name an unknown API key before 429 (default 30). |
| `DB_AUTO_MIGRATE` | Set to `false` in production | Run `npm run db:migrate` in the deploy step instead (see 5). |

Microsoft sign-in was left out on purpose: its email claim is not proof of ownership for multi-tenant apps, and accounts are matched by email. Add it only with the `xms_edov` claim check or tenant restrictions.

## 2. Monitoring and status page

- Health check: `GET /api/health` answers 200 `{"status":"ok"}` when the app and database respond, 503 `{"status":"degraded"}` when the database does not answer within 3 seconds. No secrets in the body.
- Uptime: create a monitor in Better Stack, UptimeRobot or similar on `https://www.freeabtest.com/api/health` every 1 minute, alert after 2 failures, from 2 or more regions. Add a second monitor on `https://www.freeabtest.com/sdk.js` (the customer-facing script).
- Status page: use the same provider's hosted status page (for example `status.freeabtest.com`) with two components, Dashboard and API (`/api/health`) and Script delivery (`/sdk.js`). Link it from the Support page and docs once live.
- Errors: with `OPS_ALERT_WEBHOOK_URL` set, `instrumentation.ts` forwards render and route errors and every `console.error(..., error)` from the routes. Vercel function logs keep the full stack.

## 3. Backups

Turso (production database):
1. Confirm point-in-time restore is on for the plan, and note the retention window (Scaler and above keep more days). This is the primary backup.
2. Logical backups as a second copy, daily: `DATABASE_URL=... DATABASE_AUTH_TOKEN=... npm run db:backup -- /secure/path/cro-$(date +%F).sql.gz`. Run it from a trusted machine or a scheduled job that has the database token, store the files encrypted (for example an S3 or R2 bucket with server-side encryption and a 30-day lifecycle rule), and never in the git repository. The files hold customer data.
3. The legal pages say backups roll over within 30 days. Keep the lifecycle rule at 30 days or update the Privacy Policy and DPA.

## 4. Restore drill (do once before launch, then every quarter)

1. Create an empty database (Turso: `turso db create cro-restore-test`) and a token for it.
2. `DATABASE_URL=libsql://cro-restore-test-... DATABASE_AUTH_TOKEN=... npm run db:restore -- cro-YYYY-MM-DD.sql.gz`. The script refuses a database that already has tables.
3. Point a preview deployment at it and check: sign in, open a test's results, `/api/health` is ok.
4. Write down how long it took. Delete the test database.

For a real incident, prefer Turso point-in-time restore to a new database, then switch `DATABASE_URL` and redeploy. Use the logical backup when the incident is older than the restore window.

## 5. Deploys and migrations

- CI runs lint, typecheck, tests and build on every pull request.
- Production: set `DB_AUTO_MIGRATE=false` and run `npm run db:migrate` against production as a step before the new version takes traffic (Vercel build command or a release job). Migrations only add tables and columns, so the old version keeps working while it runs.
- Use a Vercel preview environment with its own Turso database for staging. Never point previews at production data.

## 6. Support

- Customers open tickets from the app (Support in the sidebar). Platform admins answer at `/admin/support`. New tickets and customer replies go to the ops webhook.
- Promised first response: within one business day (stated on the Support page). Check the queue at least twice a day.
- There is no email notification for customers yet; they see replies in the app. Add email when transactional email is set up.

## 7. Data requests

- Account export and deletion: customers do it themselves in Settings, Privacy and data. Admins should not delete accounts by hand.
- A visitor of a customer's site asking for deletion: the customer erases them in Settings, Privacy and data (or `DELETE /api/privacy/visitors` with a secret key). If the visitor writes to us, forward them to the website and offer the customer help.
- Breach: the DPA promises notice to affected customers within 72 hours where possible. Keep the account owner emails from `/admin` ready.
