# Changelog

Newest first. Times are IST (UTC+5:30). Every change adds a row here (see docs/agent.md).
For the commit that adds a row, write "pending" as the ID, then fill in the short hash in the next commit.

| Commit | Date and time (IST) | Summary |
|---|---|---|
| dbf6d57 | 2026-10-14 19:25 IST | feat(landing): rebuild the homepage to the mockup's exact structure and proportions. Larger hero and richer dashboard mock, mockup-style logo row, How it works heading row and tinted cards, large layered Test anything illustration, 4-column stats strip, footer. Removed code block, features, roadmap, pricing, FAQ and CTA band from the homepage; pricing and FAQ moved to /pricing, features and roadmap to /roadmap |
| 36dbfd0 | 2026-10-14 19:05 IST | feat(theme): replace the green accent with blue (#2563eb) and teal (#0d9488, #14b8a6) across landing and app. Brand tokens, leaf logo, gradient headline, blobs, landing illustrations and demo page button. Status colors (Running, Completed, positive lift) stay green |
| 616b591 | 2026-10-14 18:20 IST | feat(landing): rebuild the landing page to the homepage mockup and rebrand to freeabtest.com. Leaf logo, nav dropdowns, gradient hero headline, example-data dashboard mock, handwritten annotation, Works with your stack row (planned items marked), How it works cards, Test anything section, stats strip of verified product facts, animated background blobs (reduced motion respected). Brand accent changed from indigo to green across the app |
| 9d6f931 | 2026-10-14 16:20 IST | feat(ui): redesign the whole site in a clean light B2B style. New component set, app shell with sidebar and project switcher, marketing landing page, sign-in page, overview, experiments list, edit settings, results with lift and interval chart, restyled API keys and admin console. DaisyUI removed. 3 new tests (67 total) |
| 24a95db | 2026-10-14 15:34 IST | Squash merge of PR #1 into main (contains the cec2adc and 4934497 work below; those IDs exist only on the PR branch) |
| cec2adc | 2026-10-14 15:15 IST | feat: platform admin and tenant controls. Super-admin role from PLATFORM_ADMIN_EMAILS, /admin console with tenant list, usage and details, suspend and reactivate (blocks SDK keys, secret keys and dashboard), plan and monthly visitor and experiment limits with basic enforcement, admin actions audited, 10 new tests (64 total) |
| 4934497 | 2026-10-14 11:48 IST | feat: Phase 1 M0 foundation. SQLite/libSQL with Drizzle and migrations, orgs, projects, dev/staging/prod environments, hashed API keys, audit log, SDK key auth and rate limiting on assign and track, session or secret key auth with project scoping on experiment APIs, Zod validation, key management page, stats fixes, Vitest suite (54 tests), GitHub Actions CI |
| 8c1a889 | 2026-10-14 09:38 IST | docs: restore changelog instruction wording |
| 0b3369e | 2026-10-14 09:38 IST | docs: fill commit ID in changelog |
| a6cdf7f | 2026-10-14 03:40 IST | docs: add roadmap, agent guide, changelog and current state docs |
| 5c9fc1d | 2026-01-11 14:30 IST | Toast added - wip |
| fc520ae | 2026-01-11 10:53 IST | Messaging updated |
| 51a9e94 | 2026-01-11 00:00 IST | Closing updated |
| b765c57 | 2026-01-10 23:53 IST | Auth added. UI Updated |
| 759f0e7 | 2025-12-13 22:22 IST | Experiments setup updated |
| 3322f4f | 2025-12-13 10:22 IST | Minor Update |
| 3bed0c1 | 2025-12-13 09:34 IST | Initial commit from Create Next App |
