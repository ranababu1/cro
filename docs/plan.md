# Marketing site redesign and information architecture plan

Owner: Imran. Written 2026-11-25 IST. Source brief: "FreeABTest Website Redesign & Information Architecture" (chat, 25 Nov 2026).
This file is internal. Phases, PR numbers and status words are fine here and must never appear on public pages.
Rules for how to build each phase are in `docs/instructions.md`. What is live is in `docs/currentstate.md`.

## 1. Where we are (Phase 1 assessment)

### 1.1 Stack and boundaries
- Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4, no component library. Fonts: Inter, JetBrains Mono and Caveat via next/font.
- Auth: next-auth v4 (Google, optional GitHub), Turnstile bot check on /signin. App pages live in `app/(app)/` and the layout redirects to /signin without a session. `/admin` is a separate guarded area. `/onboarding`, `/invite/[token]` and `/share/[token]` are signed-in or token pages.
- Public marketing chrome: `app/components/landing/SiteChrome.tsx` (SiteHeader, SiteFooter), `NavMenu.tsx`, `MobileNav.tsx`, `DashboardMock.tsx`, `TestIllustration.tsx`, `Blobs.tsx`. App chrome: `app/components/shell/AppShell.tsx` (sidebar, dark mode via `.app-scope`). The two never share navigation. Keep it that way.
- Shared UI kit: `app/components/ui` (Button, ButtonLink, Field, Card, Badge, StatusBadge, Table, Tabs, PageHeader, EmptyState, Alert, Stat, Spinner, Kbd, CodeBlock, Logo, cn).
- Tokens: `app/globals.css` `@theme` block. Brand is blue (`brand-600` #2563eb) with teal as the second accent; zinc greys; three shadows (`xs`, `card`, `pop`). Landing page hardcodes navy `#0b1630`, gradient headline, Caveat annotation and animated blobs.
- Analytics on our own site: Vercel Analytics (`@vercel/analytics`) in the root layout. No GA or other trackers on freeabtest.com.

### 1.2 Public routes today
| Route | What it is |
|---|---|
| `/` | Landing page (`app/page.tsx`, 231 lines): hero, dashboard mock, three steps (`#how-it-works`), AI section (`#ai`), use cases (`#test-anything`), product facts strip |
| `/pricing` | Plans, BillingCards (shown only when checkout is configured), full comparison (`#compare`), Coming soon rows, FAQ (`#faq`) with FAQPage JSON-LD |
| `/docs`, `/docs/[slug]` | 18 docs pages from `lib/docs/content/*.ts`, sidebar, search, diagrams (`app/docs/_components`) |
| `/blog`, `/blog/[slug]`, `/blog/rss.xml` | 13 Markdown posts in `content/blog`, Article and FAQ JSON-LD from frontmatter, wide layout |
| `/wordpress` | WordPress plugin page (paid plans) |
| `/about`, `/contact`, `/security` | Company, contact (Organization JSON-LD), security practices |
| `/legal/terms`, `/legal/privacy`, `/legal/dpa`, `/legal/cookies`, `/legal/refunds`, `/legal/delivery` | Legal pages through `app/legal/LegalDoc.tsx` and `lib/legal.ts`. These URLs were given to Razorpay and PayPal for review. |
| `/signin` | Google sign-in with Turnstile |
| `/.well-known/security.txt` | Security contact |
| `/sdk.js`, `/heatmap.js`, `/popups.js`, `/surveys.js`, `/errors.js`, `/visual.js`, `/preview.js` | Customer scripts. Never move or rename. |
| Redirects | `/demo*` to `/`, `/roadmap` to `/pricing` (301) |

### 1.3 SEO today
- Root metadata: title template `%s · freeabtest.com`, default description, icons. Per-page `metadata` exports exist on most public pages.
- Missing: `metadataBase`, canonical URLs, Open Graph and Twitter cards on most pages, OG images, breadcrumbs.
- `app/sitemap.ts` lists 14 static pages plus posts. Docs pages are not in the sitemap yet.
- `app/robots.ts` disallows `/api/`, the app routes, `/share/`, `/invite/`, `/admin`.
- JSON-LD: FAQPage on /pricing, Organization on /about and /contact, BlogPosting and FAQPage per post.

### 1.4 Product contracts the site must describe accurately
- Browser SDK: one script tag `<script src="https://www.freeabtest.com/sdk.js" data-key="cro_pk_prod_..." async></script>`, global `window.ABTest` with `track(name, {revenue})`, `trackConversion(experimentId, name)`, `bootstrap()`, `init({apiUrl, apiKey, userId})`, `getUserId()`, `consent(bool)`. Attributes: `data-key`, `data-consent="required"`, `data-analytics="off"`. Visitor ID in localStorage `ab_user_id` (cookie fallback). Anti-flicker hides the page at most 0.8 s. About 100 KB raw, under 30 KB gzipped. No npm package for the browser SDK.
- REST API (exists): SDK endpoints `POST /api/assign`, `POST /api/track` with a public SDK key (`X-API-Key`). Server endpoints `GET /api/server/config`, `POST /api/server/assign`, `POST /api/server/track` with a secret key (`Authorization: Bearer cro_sk_...`). Management endpoints `/api/experiments...` with a session or a secret key; creating experiments with a secret key returns 403 (session only). Results `GET /api/experiments/{id}/results`. Rate limited, JSON errors `{ "error": "..." }`. Documented at `/docs/rest-api` and `/docs/server-side`.
- Node package `integrations/node` (`@freeabtest/node`): private, not published to npm. Public copy must not tell people to `npm install` it.
- WordPress plugin `integrations/wordpress/freeabtest` v1.1.0, paid plans, downloaded from the signed-in app.
- Other integrations: Google Tag Manager install guide, GA4 `experience_impression` events (gtag or dataLayer), outgoing webhooks (HMAC-SHA256 signed) on paid plans, AI suggestions with the customer's own provider key on Growth and up.
- Assignment: deterministic hash of experiment ID and visitor ID, separate traffic bucket and variation bucket, sticky while the test runs. Public copy may say "deterministic hash"; it must not name the hash function (tests/publicContent.test.ts).

### 1.5 Statistics engine (what the code does)
| Piece | Method | Code |
|---|---|---|
| Conversion rate | unique converting visitors / assigned visitors | `lib/results.ts` |
| Interval per variation | Wilson score interval, 95% | `lib/statistics.ts` calculateConfidenceInterval |
| Winner verdict | mSPRT (mixture sequential probability ratio test), always-valid p-value, normal mixing prior with tau = 0.2 x pooled rate (floor 0.002), alpha 0.05 split across variants (Bonferroni), min 100 visitors per arm | `lib/sequential.ts` |
| Chance to beat control | Beta(1,1) posteriors, normal approximation of the difference | `lib/sequential.ts` chanceToBeatControl |
| Lift interval (live stats) | Newcombe hybrid score interval on the difference, shown relative to control | `lib/liveStats.ts` upliftInterval |
| Fixed-sample z-test | Two-proportion z-test of the best variant, returned in the results API as `statistical_significance` only. It does not decide the winner. | `lib/statistics.ts` calculateStatisticalSignificance |
| Sample size | fixed-sample formula, 95% confidence and 80% power, exact inverse normal | `lib/statistics.ts` estimateRequiredSampleSize |
| SRM check | chi-square goodness of fit, p < 0.001, from 100 visitors | `lib/statistics.ts` sampleRatioMismatch |
| Revenue | revenue per visitor (non-buyers count as 0), Welch test with normal approximation, min 30 visitors | `lib/revenue.ts` |
| Auto-shift | probability each arm is best by Beta sampling, hourly, 10% floor per arm, from 100 visitors | `lib/autoShift.ts` |
| Multivariate | full factorial, 2 to 3 factors, up to 18 combinations, factor effects | `lib/mvt.ts` |

## 2. Brief claims that conflict with the product
| Brief says | Reality | Decision |
|---|---|---|
| Statistical engine section lists "two-proportion z-tests" as the method | Winner is decided by mSPRT sequential test with Bonferroni split; z-test exists only as a secondary API field | Lead with sequential testing, Wilson, chance to beat control, SRM. Mention the z-test only as the API field for planned single-look analysis. |
| Pricing: "explain the free offering", "planned paid features, if applicable", "do not invent tiers" | Four published tiers exist: Free, Starter $20/mo or $200/yr, Growth $50/mo or $500/yr, Enterprise custom. Limits are enforced in code (PR #120). | Keep the real tiers. Free plan explained in plain numbers. |
| Pricing implies people can pay | Checkout is built but off until PayPal live keys are set (PayPal Business pending). Razorpay INR not built. | No "buy now" claim. Paid cards keep the current behaviour (BillingCards only when configured). Do not say checkout is live. |
| "Is FreeABTest free?" | Free plan has hard limits (10,000 tested visitors a month, 300 a day, 1 running test, 1 new test a month, 1 goal) | Answer "Yes, there is a free plan with these limits". Never say unlimited, free forever for everything, or free trial. |
| "JavaScript SDKs" plural, npm install examples | One browser script tag. Node package exists but is unpublished. | Show the script tag and the REST calls. Describe the Node package only as not yet available, or omit. |
| "Can I use the REST API?" | Yes, with limits: reads and lifecycle changes with a secret key, creating experiments needs a dashboard session | Document the real limits. |
| "Privacy and Security" capability | True items: consent mode, visitor erasure, data export, hashed keys stored once, HTTPS/HSTS, audit log (paid), security.txt, DPA | Only these. No certifications, no "GDPR compliant" or "bank-grade" claims. |
| `/privacy`, `/terms`, `/cookie-policy` URLs | Real pages are `/legal/privacy`, `/legal/terms`, `/legal/cookies` and were submitted to payment reviewers | Keep `/legal/*` canonical, add 301 redirects from the brief URLs. |
| `/changelog` public page | Only the internal `docs/changelog.md` exists (commit hashes and internals) | Build a curated public changelog of shipped customer-facing changes. Never mirror the internal file. |
| `/guides` | No guides collection exists; 13 blog posts and docs how-tos do | Build `/guides` as a curated index of existing long-form guides. No empty route. |
| Product preview "use real screenshots" | App screens exist but contain account data | Use real screenshots from a seeded demo account, or the existing DashboardMock labelled "Example data". |
| Typography Geist or Inter | Inter already loaded | Keep Inter (no new font download). Drop Caveat from the marketing site. |
| Palette emerald #16A36A for CTAs | White text on #16A36A is 3.24:1, fails WCAG AA for normal text | Use emerald-700 #0F7A52 (5.35:1) for filled buttons and text links; #16A36A for icons, large text and charts. Navy stays the primary CTA colour. |
| "Sign in" label | Header says "Log in" | Change to "Sign in". |
| Session recordings | Session recordings are postponed | Keep only as a Coming soon row on /pricing. Not in nav, features or homepage. |

Public-site rules that override the brief are listed in `docs/instructions.md` section 6.

## 3. Sitemap decisions
Legend: Build (new route), Reuse (existing route, redesign or extend), Redirect (301 to the canonical URL), Omit (not built until the feature exists).

| Brief URL | Decision | Notes |
|---|---|---|
| `/product` | Build | Platform overview: one product, two journeys, capability map linking to /features, /how-it-works, /experiment-analytics |
| `/features` | Build | Each verified capability: what it does, how, benefit, limits, plan. Replaces `/pricing#compare` as the nav target for features |
| `/how-it-works` | Build | Seven-step lifecycle with diagrams. `/#how-it-works` anchor on the homepage stays and links here |
| `/experiment-analytics` | Build | Results, live stats, intervals, chance to beat, SRM, funnels, revenue, segments, heatmaps, CSV, share links |
| `/solutions` | Build | Hub for four audiences |
| `/solutions/marketing` | Build | Landing page, headline, CTA, campaign tests, visual editor, popups and surveys |
| `/solutions/saas` | Build | Pricing pages, signup flows, server-side assignment, custom events, environments |
| `/solutions/ecommerce` | Build | Product and checkout page tests, revenue goals, average order value. No platform integrations we do not have |
| `/solutions/startups` | Build | Free plan, low traffic advice, sample size, test planner |
| `/developers` | Build | Developer landing: script tag, ABTest API, REST, server-side, keys and environments, webhooks |
| `/docs` | Reuse | Restyle shell to the new tokens; content stays |
| `/docs/javascript-sdk` | Reuse (rename) | Rename slug `sdk` to `javascript-sdk`; 301 `/docs/sdk` to it; update links in docs, blog and app |
| `/docs/rest-api` | Reuse | Already the API reference |
| `/docs/integrations` | Build (docs page) | Hub: GTM, WordPress plugin, GA4, webhooks, AI providers, server-side. Links into install-guides and existing pages |
| `/statistical-methodology` | Build | Full methods from section 1.5 with formulas, worked examples and diagrams. Docs results page links to it |
| `/resources` | Build | Hub for blog, guides, docs, FAQ, changelog |
| `/blog` | Reuse | Keep wide layout and post format; restyle chrome only |
| `/guides` | Build | Curated index of existing educational posts and docs how-tos |
| `/faq` | Build | Product FAQ (brief questions plus existing ones), FAQPage JSON-LD. Pricing keeps billing FAQs only, no duplicate questions across pages |
| `/changelog` | Build | Curated customer-facing release notes from `content/changelog`, shipped items only |
| `/pricing` | Reuse | Redesign, same numbers and tests |
| `/about` | Reuse | Restyle |
| `/privacy` | Redirect | 301 to `/legal/privacy` |
| `/terms` | Redirect | 301 to `/legal/terms` |
| `/cookie-policy` | Redirect | 301 to `/legal/cookies` |
| `/contact`, `/security`, `/wordpress`, `/legal/dpa`, `/legal/refunds`, `/legal/delivery` | Reuse | Not in the brief; keep and link from the footer |
| `/roadmap` | Keep redirect | Stays a 301 to /pricing. No public roadmap |
| Session recordings, public Node npm package, Razorpay INR checkout, transactional email | Omit | Not built. Pricing Coming soon row only for recordings |

## 4. Capability inventory
Verified means the code and tests exist on main today. Plan column: lowest plan that includes it.

| Category (brief) | Verified capabilities | Plan |
|---|---|---|
| Experiment management | A/B and A/B/n (up to 50 variations), split URL tests, multi-page and multivariate tests, draft/running/paused/completed lifecycle, edit running tests safely, duplicate, archive, schedule start and stop with traffic ramp, preview links, test planner with duration estimate, environments (dev, staging, prod) | Free (A/B, split URL); Growth (multi-page, MVT, visual editor) |
| Traffic allocation | Traffic percentage, editable variation weights, gradual ramp, auto-shift to the leader (Growth), roll out the winner to everyone | Free; auto-shift Growth |
| Deterministic assignment | Hash of experiment and visitor ID, sticky assignment, own user ID via `init`, server-side assignment with a secret key, local decisions in the unpublished Node package | Free |
| Targeting | Device, UTM, referrer, new vs returning, URL match | Free |
| Conversion tracking | Click goals (Free, 1 per test), form submit, page visit, custom events `ABTest.track`, revenue goals, up to 50 goals, primary goal | Free (1 click goal); rest paid |
| Statistical analysis | mSPRT sequential verdict, Wilson intervals, chance to beat control, Newcombe lift interval, SRM warning, sample size table, Welch revenue test | Free |
| Experiment reporting | Live stats, results table, funnels with trend, results by segment, CSV export, share links, JS errors per version, traffic overview, heatmaps (click, scroll, compare, export) | Free basics; funnels, segments, heatmaps, traffic, errors paid |
| Developer integration | Script tag SDK, `window.ABTest` API, REST API (SDK, server and management endpoints), public and secret keys per environment, webhooks, GA4 events, GTM and WordPress guides, WordPress plugin | Free; webhooks and plugin paid |
| Privacy and security | Consent mode (`data-consent="required"`), visitor erasure, account export, keys shown once and stored hashed, HTTPS with HSTS, audit log (paid), DPA page, security.txt, Turnstile on sign-up | Free; audit log paid |
| Engagement add-ons | Visual editor (Growth), popups and CTAs (paid), surveys incl. NPS (paid), AI suggestions with own key (Growth) | Paid |

Planned or not built (do not present as live): session recordings, published Node package, creating experiments with a secret key, Razorpay INR checkout, live PayPal checkout (built, off), transactional email, Microsoft sign-in.

## 5. Design system spec (Phase 2)

### 5.1 Scope
New tokens apply to marketing, docs, blog, legal and pricing pages. The signed-in app keeps its current tokens and dark mode until a separate decision; nothing in `.app-scope` changes in this project.

### 5.2 Colour tokens (add to `@theme` as new names, do not redefine `brand-*`)
| Token | Value | Use |
|---|---|---|
| `--color-navy-950` | #101827 | Headings, primary buttons, footer background |
| `--color-navy-800` | #1F2A3D | Primary button hover |
| `--color-emerald-600` | #16A36A | Icons, chart series, large display numbers (3:1 is enough only for 24px+ or bold 19px+) |
| `--color-emerald-700` | #0F7A52 | Text links, filled accent buttons with white text (5.35:1) |
| `--color-emerald-50` | #ECFDF5 | Positive tint backgrounds |
| `--color-surface` | #F8FAFC | Section backgrounds (navy on it 16.98:1) |
| `--color-slate-500` | #64748B | Secondary text on white only (4.76:1); on #F8FAFC use slate-600 #475569 (7.24:1) |
| `--color-blue-100` | #DBEAFE | Info tints, code callouts, developer journey accents |
| Borders | #E2E8F0 (slate-200) | 1px only |
Status colours (amber, red) stay as in the app for sample data badges.

### 5.3 Type
- Inter for everything, JetBrains Mono for code. Remove Caveat from the root layout once the landing page stops using it.
- Scale (desktop / mobile): Display 56/40, H1 44/34, H2 32/28, H3 22/20, Body L 18, Body 16, Small 14, Eyebrow 13 uppercase tracking 0.08em. Line height 1.1 for display, 1.2 headings, 1.6 body. Max text width 68ch.
- Weights: 600 headings, 700 display only, 400 body.

### 5.4 Space, radius, elevation
- 4px scale; section padding 96px desktop, 64px mobile; content width 1200px, prose 720px.
- Radius: 8px controls, 12px cards, 16px large panels. No pill buttons except badges.
- Shadows: `shadow-xs` and `shadow-card` only; borders do most of the work. No glow, no glass.
- Motion: hover and menu transitions under 200ms; respect `prefers-reduced-motion`. Retire the animated blobs and the gradient headline on marketing pages.

### 5.5 Shared components (new folder `app/components/site`)
SiteHeader with MegaMenu (Product, Solutions, Developers, Resources, Pricing link; Sign in, Start for free), MobileNav (accordion, focus trap, Escape closes), SiteFooter (grouped columns incl. legal and contact), PageHero, Section, SectionHeading (eyebrow, title, lede), FeatureGrid and FeatureCard, StepFlow (numbered workflow diagram), AudienceSplit (two entry cards), CodeTabs (HTML, curl, JavaScript; reuse CodeBlock), StatExample (worked calculation), SampleDataFrame (wraps any mock UI with an "Example data" label), FaqList (accordion with optional JSON-LD), CtaBand, Breadcrumbs (with BreadcrumbList JSON-LD), PlanBadge (Free, Starter, Growth).

### 5.6 Mega menu content
- Product: Overview (/product), Features (/features), How it works (/how-it-works), Experiment analytics (/experiment-analytics). Side panel: Pricing.
- Solutions: Marketing teams, SaaS products, Ecommerce, Startups (each /solutions/...). Footer link: All solutions.
- Developers: Developer hub (/developers), JavaScript SDK, REST API, Integrations, Statistical methodology. Side panel: Quick start.
- Resources: Blog, Guides, FAQ, Changelog, Documentation. Side panel: latest post.
Desktop opens on click and hover-intent, closes on Escape and outside click, keyboard navigable (button with aria-expanded, menu regions). Mobile: full-screen sheet with accordions.

## 6. Roadmap by phase (one PR each unless noted)

### Phase 1: assessment and plan (this PR)
- [x] Inspect repo, contracts, stats, SEO, design tokens
- [x] Write docs/plan.md and docs/instructions.md, update changelog and currentstate
- [x] Fix .gitignore so docs/plan.md can be committed (`plan.md` became `/plan.md`)

### Phase 2: design system and shared chrome (PR A, done)
1. Add tokens from 5.2 and type utilities to globals.css (marketing scope only).
2. Build `app/components/site/*` primitives from 5.5.
3. New SiteHeader with mega menus and MobileNav; new SiteFooter. Swap them into every public page that uses SiteChrome (landing, pricing, docs, blog, legal, about, contact, security, wordpress, not-found).
4. Keep existing link targets working; menu items for pages not built yet point to the nearest existing page until their PR lands (no 404s, no placeholder links).
5. Tests: update mobileNav, mobileA11y, publicContent file lists; add a nav link test that every menu href resolves to a route or redirect.

Done in PR A. Decisions: tokens are `navy-*`, `accent-*` (emerald), `surface`, `line`, `soft-blue`, `muted`, `muted-strong`; primitives built now are Container, Section, SectionHeading, PageHero, CtaBand, SampleDataFrame, SiteCard, SiteButton. StepFlow, AudienceSplit, CodeTabs, StatExample, FaqList, Breadcrumbs and PlanBadge are built in the phase that first needs them. The docs shell kept its own header until PR F, which moved it onto the site header and footer. Each later PR that ships a page swaps its placeholder href in `app/components/site/nav.ts`.

### Phase 3: homepage (PR B, done)
Sections in brief order: hero (exact headline and lede, CTAs Start experimenting -> /signin, Explore features -> /features), audience split, core capabilities (verified only), seven-step workflow, product preview (real screenshot or labelled sample), for marketers, for developers (real script tag and REST snippet), statistical engine summary (sequential, Wilson, worked example), pricing summary (four tiers, free limits), FAQ (8 brief questions, short, links to /faq), final CTA. Remove blobs, Caveat, gradient text. Update metadata.

Done in PR B. Notes: AI-powered positioning (badge, hero line, title, description, #ai section) is kept and gated on `aiConfigured()`, as Imran wants it to lead when AI is on. Explore features points at /pricing#compare until /features ships (PR C swaps it). Marketer and developer cards link to docs until the solution and developer pages ship. The homepage preview is illustrative (no seeded demo account yet); replace with real screenshots when one exists.

### Phase 4: product and solutions (PR C product pages, PR D solutions, done)
- PR C: /product, /features, /how-it-works, /experiment-analytics. Done: content in lib/site/product.ts (FEATURE_GROUPS, LIFECYCLE, ANALYTICS_EXTRAS, NOT_YET), shared SitePage, Breadcrumbs, PlanBadge, ProductSubnav and pageMetadata for the next pages. tests/helpers/links.ts checks internal links; reuse it for every new page. Product menu, footer and homepage links now point at these pages.
- PR D: /solutions and four children. Each with a real workflow example, relevant goals and plan notes. Done: one template (app/solutions/SolutionPage.tsx) fed by lib/site/solutions.ts; workflows are labelled example plans, never customer stories; ecommerce names no store platform integration (snippet, Tag Manager and API only).

### Phase 5: developer ecosystem (PR E developers hub, PR F docs changes, PR G statistical methodology)
- PR E: /developers. Done: content in `lib/site/developers.ts` (code samples copied from `lib/docs/content`, checked by tests/developersPage.test.ts), `CodeBlock` component, Developer hub first in the Developers menu and footer column, homepage developer links point at /developers.
- PR F: rename `/docs/sdk` to `/docs/javascript-sdk` with redirect and link updates; new `/docs/integrations`; restyle docs shell; add docs pages to sitemap. Done: 301 in next.config.js, docs shell uses SiteHeader and SiteFooter plus a docs bar, integrations page in `lib/docs/content/integrations.ts`, tests/docsShell.test.ts.
- PR G: /statistical-methodology with formulas, worked examples (reuse docs diagrams), interpretation guide.

### Phase 6: resources and commercial (PR H resources, PR I pricing and legal)
- PR H: /resources, /guides, /faq, /changelog (content/changelog), blog index restyle.
- PR I: /pricing redesign (same numbers), /about restyle, legal restyle, redirects /privacy, /terms, /cookie-policy.

### Phase 7: SEO, accessibility, QA (PR J)
`metadataBase`, canonical, OG and Twitter on every public page, default OG image, breadcrumbs, sitemap with every public page and docs, robots check, internal link checker test, axe-style checks, 390/768/1280 screenshots, Lighthouse pass, full `npm test` and build.

## 7. Risks
- Public copy tests are strict (publicContent, publicCopyMatchesApp, copyConsistency, claimsAudit). New pages must be added to their file lists so the rules apply.
- Renaming `/docs/sdk` touches tests (sdkDocsMatch, docs) and blog links; do it in its own PR.
- Pricing numbers are mirrored in tests; never change a number on a marketing page without the code and tests.
- Payment reviewers saw `/legal/*`; never move those.
