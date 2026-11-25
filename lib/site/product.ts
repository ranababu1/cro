/**
 * Content for the Product pages (/product, /features, /how-it-works, /experiment-analytics).
 * Every feature and limit here is built today. Sources: app/pricing/page.tsx (plan per feature) and lib/docs/content/*.
 * Numbers come from lib/plans.ts. tests/productPages.test.ts checks the numbers, the plan notes and every link.
 */
import { FREE_MONTHLY_VISITORS, FREE_RUNNING_EXPERIMENTS, PAID_MAX_GOALS, PAID_MAX_VARIATIONS } from '@/lib/plans';
import { fmt } from './home';

export type Plan = 'Every plan' | 'Paid plans' | 'Growth and above';

export type Feature = {
    name: string;
    /** What it does. */
    what: string;
    /** How it works, in one or two sentences. */
    how: string;
    /** Why it helps. */
    benefit: string;
    /** Honest limits and caveats. */
    limits: string;
    plan: Plan;
    href: string;
};

export type FeatureGroup = { id: string; title: string; summary: string; features: Feature[] };

export const FEATURE_GROUPS: FeatureGroup[] = [
    {
        id: 'experiment-management', title: 'Experiment management', summary: 'Plan tests, run them and change them without spoiling the data.',
        features: [
            { name: 'A/B and split URL tests', plan: 'Every plan', href: '/docs/experiments',
                what: 'Compare versions of one page, or send each visitor to a different page address.',
                how: 'The snippet picks the version for each visitor and applies it, or redirects split URL traffic before the page shows.',
                benefit: 'Test copy and layout in place, or compare two whole page designs.',
                limits: 'The free plan compares a control with 1 variation on 1 page address.' },
            { name: 'Multi-page and multivariate tests', plan: 'Growth and above', href: '/docs/variations#multivariate',
                what: 'Run one test across several page addresses, or test combinations of changes.',
                how: 'Put each variation in a factor, one per element you change, and build the combinations.',
                benefit: 'Measure a change that spans a flow, or see which mix of headline and button works best.',
                limits: 'Each factor has up to 2 versions besides the original. Combinations split your traffic further, so they need more visitors.' },
            { name: 'Test planner', plan: 'Every plan', href: '/docs/experiments',
                what: 'Keep test ideas with a hypothesis, a page and a priority.',
                how: 'Ideas sit in four columns: Ideas, Planned, Started and Dropped. Create test opens the wizard with the idea filled in.',
                benefit: 'The team sees what is being tested next and why.',
                limits: 'The duration estimate is a guide based on your traffic, not a promise.' },
            { name: 'Scheduling and gradual ramp', plan: 'Every plan', href: '/docs/experiments',
                what: 'Set a start time, a stop time, or both, and let traffic grow step by step.',
                how: 'A ramp starts with a share of new visitors, for example 10%, and adds a step every few hours up to the traffic allocation.',
                benefit: 'Launch at a quiet hour and catch a broken version before most visitors see it.',
                limits: 'A ramp only adds new visitors. People already in the test keep their version.' },
            { name: 'Safe edits and preview links', plan: 'Every plan', href: '/docs/variations#preview-links',
                what: 'Change a running test and check every version before visitors do.',
                how: 'Changes apply to new visitors only. Preview links open one version in your browser and are never counted.',
                benefit: 'Fix a typo mid-test without restarting or polluting the results.',
                limits: 'Variation addresses cannot change, and variations cannot be added or removed after creation.' },
        ],
    },
    {
        id: 'traffic-allocation', title: 'Traffic allocation', summary: 'Decide who enters a test and how the traffic splits.',
        features: [
            { name: 'Traffic share and weights', plan: 'Every plan', href: '/docs/variations#traffic-allocation',
                what: 'Choose the share of visitors who enter the test, and how they split between versions.',
                how: 'Traffic allocation sets who enters. Weights set the split between versions, for example 50/50 or 80/20.',
                benefit: 'Expose a risky change to a small share of visitors first.',
                limits: 'Visitors outside the allocation see your original page and are not counted.' },
            { name: 'Targeting', plan: 'Every plan', href: '/docs/experiments',
                what: 'Limit a test to visitors by device, UTM tag, referrer, or new or returning.',
                how: 'Every rule you set must match. Rules are checked when a visitor first joins.',
                benefit: 'Test a landing page only for the campaign that sends people to it.',
                limits: 'Changing rules later does not move people already in the test.' },
            { name: 'Roll out the winner', plan: 'Every plan', href: '/docs/choosing-a-winner#rollout',
                what: 'Send one version to every visitor with one click.',
                how: 'The snippet shows the chosen version to everyone while you put the change into your site.',
                benefit: 'Visitors get the better version today, not after the next release.',
                limits: 'A rollout is a bridge. Stop it once the change is live in your own code.' },
            { name: 'Auto-shift traffic to the winner', plan: 'Growth and above', href: '/docs/variations#auto-shift',
                what: 'Let the split follow the version most likely to win.',
                how: 'About once an hour the split is recalculated with Thompson sampling, a multi-armed bandit method.',
                benefit: 'Earn from the best version while the test runs, for example during a short promotion.',
                limits: 'Because the split moves, treat significance as a guide, and the visitor split warning is off.' },
        ],
    },
    {
        id: 'assignment', title: 'Deterministic assignment', summary: 'The same visitor sees the same version, every time.',
        features: [
            { name: 'Sticky assignment', plan: 'Every plan', href: '/docs/javascript-sdk#init',
                what: 'Each visitor is placed in one version and stays there.',
                how: 'The visitor ID is hashed together with the test ID to pick the version, so the result never changes.',
                benefit: 'Visitors never see the page switch, and the results stay clean.',
                limits: 'Raising traffic adds new visitors and never moves the ones already in the test.' },
            { name: 'Your own user IDs', plan: 'Every plan', href: '/docs/javascript-sdk#init',
                what: 'Use your login ID so a person sees the same version on every device.',
                how: 'Pass userId to init in the browser, or user_id to the server endpoints.',
                benefit: 'Logged-in products keep one experience across phone and laptop.',
                limits: 'Without your own ID, the snippet keeps a random ID in the browser, so a new device is a new visitor.' },
            { name: 'Flicker-free snippet', plan: 'Every plan', href: '/docs/javascript-sdk#flicker',
                what: 'Visitors do not see the original page flash before their version.',
                how: 'The snippet hides the page for at most 0.8 seconds while it decides, then shows the right version.',
                benefit: 'No flash of the old headline, which can skew results.',
                limits: 'Load the snippet early in the head. A late snippet is the usual cause of flicker.' },
            { name: 'Server-side assignment', plan: 'Every plan', href: '/docs/server-side',
                what: 'Assign visitors from your backend with a secret key.',
                how: 'Your server asks for a version and gets the same answer the browser would.',
                benefit: 'Test pricing, emails or anything that never reaches the browser.',
                limits: 'Conversions sent from your code need a paid plan.' },
        ],
    },
    {
        id: 'conversion-tracking', title: 'Conversion tracking', summary: 'Count the actions that matter to you.',
        features: [
            { name: 'Click goals', plan: 'Every plan', href: '/docs/goals',
                what: 'Count clicks on any element you pick with a CSS selector.',
                how: 'The snippet listens for clicks on the selector on pages in the test.',
                benefit: 'Measure button and link clicks with no code.',
                limits: 'The free plan has 1 goal per test, and it is a click goal.' },
            { name: 'Form, page visit and custom event goals', plan: 'Paid plans', href: '/docs/goals',
                what: 'Count form submits, visits to a page such as a thank-you page, or events you send.',
                how: `Add up to ${PAID_MAX_GOALS} goals per test and pick the primary one. Custom events come from ABTest.track or the API.`,
                benefit: 'Measure signups and purchases, not just clicks.',
                limits: 'Pick the primary goal before you start. Checking many goals raises the chance one looks good by luck.' },
            { name: 'Revenue goals', plan: 'Paid plans', href: '/docs/goals#revenue',
                what: 'Send an order value with a custom event.',
                how: 'Results show buyers, orders, revenue, revenue per visitor and average order value for each version.',
                benefit: 'See whether a change brings more money, not only more orders.',
                limits: 'A few large orders move the average, so revenue needs a larger sample.' },
            { name: 'Google Analytics 4 events', plan: 'Every plan', href: '/docs/javascript-sdk#ga4',
                what: 'Each test view is sent to Google Analytics 4.',
                how: 'The snippet sends an experience_impression event, or pushes it to the Tag Manager dataLayer.',
                benefit: 'Compare versions inside the analytics you already use.',
                limits: 'You register the custom dimension in Google Analytics yourself.' },
        ],
    },
    {
        id: 'statistics', title: 'Statistical analysis', summary: 'Verdicts that stay valid however often you look.',
        features: [
            { name: 'Sequential significance', plan: 'Every plan', href: '/docs/results#significance',
                what: 'Each variant is compared with the control using a sequential test.',
                how: 'Its p-value stays valid at every look. The 0.05 bar is split across variants in A/B/n tests.',
                benefit: 'Check the dashboard as often as you like and stop when it is clear.',
                limits: 'It needs about 2 to 3 times the visitors of a test you look at only once. No verdict before every version has 100 visitors.' },
            { name: 'Wilson intervals', plan: 'Every plan', href: '/docs/results#confidence-intervals',
                what: 'Every conversion rate comes with a 95% interval.',
                how: 'The Wilson score interval stays accurate for small samples and rates near 0%.',
                benefit: 'See how sure the numbers are, not just which is higher.',
                limits: 'Overlapping intervals do not prove there is no difference.' },
            { name: 'Chance to beat control', plan: 'Every plan', href: '/docs/results#chance-to-beat',
                what: 'How likely it is that a variant is truly better than the control.',
                how: 'Each rate starts from a flat prior, so the number reflects only your data.',
                benefit: 'A plain reading of where the test stands.',
                limits: 'It moves quickly with small samples. Decide on the significance verdict.' },
            { name: 'Sample ratio check', plan: 'Every plan', href: '/docs/results#srm',
                what: 'A warning when visitors are not split the way you set.',
                how: 'Runs from 100 visitors and flags a gap only when the chance of luck is under 0.1%.',
                benefit: 'Catches broken redirects and missing snippets before you trust a result.',
                limits: 'Changing the split mid-test can trigger it on its own.' },
        ],
    },
    {
        id: 'reporting', title: 'Experiment reporting', summary: 'See what is happening while the test runs, and share it.',
        features: [
            { name: 'Live results and verdicts', plan: 'Every plan', href: '/docs/results',
                what: 'Visitors, conversions, rate, lift, interval and chance to beat for every version.',
                how: 'A summary line says Collecting data, a variant is outperforming, the control is ahead, or no significant difference yet.',
                benefit: 'Everyone reads the same verdict, in plain words.',
                limits: 'The dashboard combines environments. The results API can filter to one.' },
            { name: 'CSV download and share links', plan: 'Every plan', href: '/docs/results#sharing',
                what: 'Download one row per day, version and goal, or send a read-only link.',
                how: 'Share links show the numbers without your page addresses or account details, and you can turn them off at once.',
                benefit: 'Report to people who do not have an account.',
                limits: 'Days are in UTC.' },
            { name: 'Funnels', plan: 'Paid plans', href: '/docs/results#funnels',
                what: 'Follow visitors through 2 to 10 goals in order.',
                how: 'Each step shows how many visitors reached it, per version, with a completion trend.',
                benefit: 'See where people drop off between first page and signup.',
                limits: 'Funnels do not run a significance test. Decide on the goal results.' },
            { name: 'Results by segment', plan: 'Paid plans', href: '/docs/results#segments',
                what: 'Split results by device, traffic source, and new or returning visitors.',
                how: 'Each version is compared with the control inside the same segment.',
                benefit: 'Spot a change that works on mobile but not on desktop.',
                limits: 'Treat a standout segment as a lead and confirm it with a follow-up test.' },
            { name: 'Heatmaps and error tracking', plan: 'Paid plans', href: '/docs/results#heatmaps',
                what: 'Click, scroll and confetti maps per version, and JavaScript errors per version.',
                how: 'A sample of visitors is recorded. Errors carry the message, file and line only.',
                benefit: 'See why a version wins, and check it does not break anything.',
                limits: 'Individual clicks are kept for 30 days, daily totals for the life of the test.' },
        ],
    },
    {
        id: 'developers', title: 'Developer integration', summary: 'One script tag, a JavaScript API and a REST API.',
        features: [
            { name: 'JavaScript SDK', plan: 'Every plan', href: '/docs/javascript-sdk',
                what: 'One script tag that assigns, applies versions and tracks goals.',
                how: 'It reads your public key from data-key and starts on its own. ABTest.track sends custom events.',
                benefit: 'Works on any site, including through Tag Manager or WordPress.',
                limits: 'Custom events from ABTest.track need a paid plan.' },
            { name: 'REST API', plan: 'Every plan', href: '/docs/rest-api',
                what: 'Assign, track and read results over HTTP.',
                how: 'Browser endpoints take a public key. Server and management endpoints take a secret key.',
                benefit: 'Use any language and keep secrets on your server.',
                limits: 'Experiments are created in the dashboard, not through the API.' },
            { name: 'Environments and keys', plan: 'Every plan', href: '/docs/environments-and-keys',
                what: 'Dev, staging and production in every project, each with its own keys.',
                how: 'Public keys work only on the domains you register. Secret keys never work in a browser.',
                benefit: 'Test the setup in staging without touching production numbers.',
                limits: 'Each project has 3 environments.' },
            { name: 'Webhooks', plan: 'Paid plans', href: '/docs/webhooks',
                what: 'Signed events when a test finds a winner, finishes, shows a split warning or hits a plan limit.',
                how: 'Each delivery is signed so your server can verify it came from us.',
                benefit: 'Post to your team chat or start your own workflow.',
                limits: 'Your endpoint must be a public address.' },
        ],
    },
    {
        id: 'engagement', title: 'Popups and surveys', summary: 'Ask visitors what is missing and point them to the next step.',
        features: [
            { name: 'Popups and calls to action', plan: 'Paid plans', href: '/docs/popups',
                what: 'Center, corner or bar messages, with views and clicks counted.',
                how: 'You pick the pages and the timing in the dashboard.',
                benefit: 'Promote an offer or a signup without a code change.',
                limits: 'Use them sparingly. They interrupt visitors.' },
            { name: 'Surveys', plan: 'Paid plans', href: '/docs/surveys',
                what: 'One question with choices, a 1 to 5 rating, NPS or a written answer.',
                how: 'Start from a template, then export the answers as CSV.',
                benefit: 'Learn why visitors leave, and turn the answers into test ideas.',
                limits: 'Answers are kept for 12 months on Starter and 24 months on Growth and Enterprise.' },
        ],
    },
    {
        id: 'privacy', title: 'Privacy and security', summary: 'Controls for consent, visitor data and your team.',
        features: [
            { name: 'Consent mode', plan: 'Every plan', href: '/docs/javascript-sdk#consent',
                what: 'Nothing is stored or sent until the visitor agrees.',
                how: 'Add data-consent="required" to the script tag and call consent(true) from your banner.',
                benefit: 'Fits a consent banner you already run.',
                limits: 'Visitors who have not agreed see your original page and are not counted.' },
            { name: 'Visitor data controls', plan: 'Every plan', href: '/security',
                what: 'Erase one visitor, export your account data, or delete projects and your account.',
                how: 'Visitors get random IDs. Heatmaps never record keystrokes, form values or page text.',
                benefit: 'Handle a visitor\'s data request yourself, without writing to support.',
                limits: 'Retention for clicks, survey answers and audit entries follows your plan.' },
            { name: 'Team roles and audit log', plan: 'Paid plans', href: '/docs/organizations-and-projects#audit-log',
                what: 'Invite teammates as owners or members, and see who changed what.',
                how: 'Every change is written to the audit log, kept 90 days to 2 years by plan.',
                benefit: 'Know who stopped a test, and when.',
                limits: 'The free plan has 1 seat.' },
        ],
    },
];

/** Features that are not built yet. Shown as not available, never as live. Mirrors comingSoon in app/pricing/page.tsx. */
export const NOT_YET = ['Session recordings'];

/** The seven lifecycle steps on /how-it-works, in the brief's order. */
export type LifecycleStep = { id: string; title: string; body: string; details: string[]; example: string; href: string; link: string };

export const LIFECYCLE: LifecycleStep[] = [
    { id: 'create', title: 'Create an experiment', href: '/docs/experiments', link: 'Creating experiments',
        body: 'Give the test a name and write down what you expect to happen. New tests always start as a draft.',
        details: ['A hypothesis: what you change, for whom, and why it should help', 'An expected outcome, the result you would call a win', 'Tags to group tests by page, team or quarter', 'Ideas from the test planner open the wizard already filled in'],
        example: 'Hypothesis: a shorter headline on the pricing page makes the plans easier to compare. Expected outcome: trial starts rise by at least 10%.' },
    { id: 'variants', title: 'Define variants and traffic', href: '/docs/variations', link: 'Variations and traffic',
        body: 'Add the versions to compare and decide how many visitors take part.',
        details: ['Change text or layout in place, or send each version to its own page address', 'Set weights, for example 50/50', 'Set the traffic allocation, the share of visitors who enter', 'Add targeting by device, campaign, referrer, or new or returning'],
        example: 'Control: the current headline. Variant B: the shorter headline. 50/50 split, 100% of visitors on desktop and mobile.' },
    { id: 'integrate', title: 'Integrate the SDK or configure tracking', href: '/docs/quick-start', link: 'Quick start',
        body: 'Paste one script tag into the head of every page in the test, or call the API from your server.',
        details: ['Copy the snippet with your public key from the dashboard', 'Install through Tag Manager or WordPress if you prefer', 'Use server-side assignment for anything that never reaches the browser', 'The free plan keeps Start off until the snippet has loaded on the page'],
        example: 'The snippet goes in the head of /pricing. The setup check confirms it loaded before the test starts.' },
    { id: 'assign', title: 'Assign visitors consistently', href: '/docs/variations#traffic-allocation', link: 'How assignment works',
        body: 'Each visitor is hashed into one version and stays there on every visit.',
        details: ['The visitor ID and the test ID decide the version', 'Raising traffic adds new visitors without moving anyone', 'Pass your own user ID to keep one version across devices', 'Edits apply to new visitors only'],
        example: 'A visitor who saw Variant B on Monday still sees Variant B on Friday.' },
    { id: 'track', title: 'Track conversions', href: '/docs/goals', link: 'Goals',
        body: 'Pick the action that counts as a win and make it the primary goal.',
        details: ['Click goals on a CSS selector, on every plan', 'Form submits, page visits and custom events on paid plans', 'Revenue with each order on paid plans', 'Each test view also goes to Google Analytics 4'],
        example: 'Primary goal: a click on the Start trial button. Secondary goal on a paid plan: a visit to /welcome.' },
    { id: 'analyse', title: 'Analyse the results', href: '/docs/results', link: 'Reading results',
        body: 'Watch conversion rates, intervals and the sequential verdict as data comes in.',
        details: ['A verdict only once every version has 100 visitors', 'A sequential p-value that stays valid at every look', 'A warning if visitors are not split as you set', 'Funnels, segments and heatmaps on paid plans'],
        example: 'After 4,800 visitors each, Variant B converts at 6.5% against 5.0%, with a sequential p-value of 0.048.' },
    { id: 'decide', title: 'Make the decision', href: '/docs/choosing-a-winner', link: 'Choosing a winner',
        body: 'Roll out the winner, keep the control, or test a bolder idea.',
        details: ['Roll out one version to everyone while you update your code', 'Stop the test when the control wins, and keep your page', 'An inconclusive test means the change did not matter much', 'Write the outcome down so the next test builds on it'],
        example: 'Roll out Variant B, put the new headline in the page, stop the rollout, and plan the next test.' },
];

/** Analytics items on /experiment-analytics. */
export const ANALYTICS_EXTRAS: { title: string; body: string; plan: Plan; href: string }[] = [
    { title: 'Funnels', body: 'Pick 2 to 10 goals in order and see how many visitors of each version reach each step, with a daily or weekly completion trend.', plan: 'Paid plans', href: '/docs/results#funnels' },
    { title: 'Revenue', body: 'Buyers, orders, revenue per visitor and average order value. The best version by revenue per visitor is compared with the control using Welch\u2019s t-test once both have 30 visitors.', plan: 'Paid plans', href: '/docs/results#revenue' },
    { title: 'Results by segment', body: 'Device, traffic source, and new or returning visitors, each compared with the control in the same segment.', plan: 'Paid plans', href: '/docs/results#segments' },
    { title: 'Heatmaps', body: 'Click, scroll and confetti maps, an overlay on the page and an element list with rage and dead clicks, for each version and device.', plan: 'Paid plans', href: '/docs/results#heatmaps' },
    { title: 'JavaScript errors', body: 'Errors per 100 visitors for each version, so you know a new version does not break something.', plan: 'Paid plans', href: '/docs/results#errors' },
    { title: 'Traffic overview', body: 'Page views, top pages, sources, devices and countries for every page with the snippet.', plan: 'Paid plans', href: '/docs/results#traffic' },
    { title: 'CSV download', body: 'One row per day, version and goal, with running totals that match the results table.', plan: 'Every plan', href: '/docs/results#export' },
    { title: 'Share links', body: 'A read-only page with the numbers for every version. Turn it off and the link stops working at once.', plan: 'Every plan', href: '/docs/results#sharing' },
];

export const VERDICTS: { label: string; meaning: string }[] = [
    { label: 'Collecting data', meaning: 'At least one version has fewer than 100 visitors. Wait.' },
    { label: 'Variant is outperforming the control', meaning: 'The variant converts better and its sequential p-value is below the bar. Roll it out, ideally after at least one full week.' },
    { label: 'The control is outperforming every variant', meaning: 'Every variant is significantly worse. Keep the control.' },
    { label: 'No significant difference yet', meaning: 'The data cannot tell the versions apart. Keep running, or accept that the effect is too small to matter.' },
];

/** Product pages, used by the sibling strip and tests. */
export const PRODUCT_PAGES: { href: string; title: string; body: string }[] = [
    { href: '/product', title: 'Overview', body: 'One platform, two ways in' },
    { href: '/features', title: 'Features', body: 'Every capability, its plan and its limits' },
    { href: '/how-it-works', title: 'How it works', body: 'From hypothesis to decision in seven steps' },
    { href: '/experiment-analytics', title: 'Experiment analytics', body: 'Rates, intervals, verdicts and reports' },
];

export const FREE_LINE = `Free plan with ${fmt(FREE_MONTHLY_VISITORS)} tested visitors a month and ${FREE_RUNNING_EXPERIMENTS} running test. No card needed.`;
export const PAID_VARIATIONS_LINE = `Control plus up to ${PAID_MAX_VARIATIONS} variations on paid plans.`;

/** Anchors each product page renders from this data, for link tests. */
export const PRODUCT_ANCHORS: Record<string, string[]> = {
    '/features': FEATURE_GROUPS.map((g) => g.id),
    '/how-it-works': LIFECYCLE.map((s) => s.id),
};
