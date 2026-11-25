/**
 * Homepage content. Every capability here is built and tested today (docs/plan.md section 4).
 * Plan notes follow app/pricing/page.tsx; numbers come from lib/plans.ts and lib/billing/config.ts.
 */
import { FREE_DAILY_VISITORS, FREE_MONTHLY_TESTS, FREE_MONTHLY_VISITORS, FREE_RUNNING_EXPERIMENTS, GROWTH_MONTHLY_VISITORS, PAID_MAX_GOALS, PAID_MAX_VARIATIONS, STARTER_MONTHLY_VISITORS, STARTER_RUNNING_EXPERIMENTS } from '@/lib/plans';
import { PLAN_PRICES_USD } from '@/lib/billing/config';

export const fmt = (n: number) => n.toLocaleString('en-US');

export type Capability = { title: string; body: string; points: string[]; href: string };

export const CAPABILITIES: Capability[] = [
    { title: 'Experiment management', body: 'Plan, run and change tests without losing data.', href: '/features#experiment-management',
        points: ['A/B and split URL tests on every plan', `Up to ${PAID_MAX_VARIATIONS} variations per test on paid plans`, 'Scheduled start and stop, preview links, safe edits while running'] },
    { title: 'Traffic allocation', body: 'Decide who enters a test and how traffic splits.', href: '/features#traffic-allocation',
        points: ['Traffic share and per-variation weights', 'Gradual ramp-up on a schedule', 'Roll out the winner, or auto-shift traffic on Growth'] },
    { title: 'Deterministic assignment', body: 'The same visitor sees the same version every time.', href: '/features#assignment',
        points: ['Visitor ID hashed with the test ID', 'Raising traffic never moves people already in the test', 'Use your own user IDs, in the browser or on your server'] },
    { title: 'Conversion tracking', body: 'Count the actions that matter to you.', href: '/features#conversion-tracking',
        points: ['Click goals on a CSS selector on every plan', 'Form submit, page visit, custom event and revenue goals on paid plans', `Up to ${PAID_MAX_GOALS} goals per test on paid plans`] },
    { title: 'Statistical analysis', body: 'Verdicts that stay valid however often you look.', href: '/features#statistics',
        points: ['Sequential test of each variant against the control', 'Wilson score interval for every conversion rate', 'Chance to beat control and a sample ratio check'] },
    { title: 'Experiment reporting', body: 'See what is happening while the test runs.', href: '/features#reporting',
        points: ['Live results with lift and its interval', 'CSV export and read-only share links', 'Funnels, segments and heatmaps on paid plans'] },
    { title: 'Developer integration', body: 'One script tag, a JavaScript API and a REST API.', href: '/features#developers',
        points: ['Public SDK keys and server-only secret keys per environment', 'Server-side assignment and event tracking', 'GA4 events, Google Tag Manager and WordPress guides'] },
    { title: 'Privacy and security', body: 'Controls for consent and visitor data.', href: '/features#privacy',
        points: ['Consent mode: nothing stored or sent until you allow it', 'Erase one visitor or export your account data', 'Keys shown once and stored hashed; audit log on paid plans'] },
];

export const STEPS: { title: string; body: string }[] = [
    { title: 'Create an experiment', body: 'Name it, pick the page and write down the hypothesis.' },
    { title: 'Define variants and traffic', body: 'Add versions, set weights and the share of visitors to include.' },
    { title: 'Add the snippet or API', body: 'One script tag on the page, or calls from your server.' },
    { title: 'Assign visitors consistently', body: 'Each visitor is hashed into one version and stays there.' },
    { title: 'Track conversions', body: 'Clicks, form submits, page visits or your own events.' },
    { title: 'Analyse the results', body: 'Conversion rates, intervals and a sequential verdict.' },
    { title: 'Make the decision', body: 'Roll out the winner, keep the control, or test a bolder idea.' },
];

export const MARKETER_USE_CASES: { title: string; body: string; feature: string }[] = [
    { title: 'Landing page optimization', body: 'Test the headline, hero and layout of the page your ads point at.', feature: 'Split URL tests on every plan; visual editor on Growth' },
    { title: 'Call to action testing', body: 'Compare button copy, colour and placement, and count the clicks.', feature: 'Click goals on a CSS selector' },
    { title: 'Campaign experiments', body: 'Show a version only to visitors from one campaign or source.', feature: 'Targeting by UTM, referrer and device' },
    { title: 'Conversion optimization', body: 'Follow visitors from first page to signup or order.', feature: 'Funnels and revenue goals on paid plans' },
    { title: 'Customer experience', body: 'See where people click and ask them what is missing.', feature: 'Heatmaps, popups and surveys on paid plans' },
];

export type PlanSummary = { name: string; price: string; note: string; points: string[] };

export const PLAN_SUMMARY: PlanSummary[] = [
    { name: 'Free', price: '$0', note: 'No card needed', points: [`${fmt(FREE_MONTHLY_VISITORS)} tested visitors a month (${FREE_DAILY_VISITORS} a day)`, `${FREE_RUNNING_EXPERIMENTS} running test and ${FREE_MONTHLY_TESTS} new test a month`, 'A/B tests with 1 click goal'] },
    { name: 'Starter', price: `$${PLAN_PRICES_USD.starter.monthly}`, note: `per month, or $${PLAN_PRICES_USD.starter.yearly} a year`, points: [`${fmt(STARTER_MONTHLY_VISITORS)} tested visitors a month`, `${STARTER_RUNNING_EXPERIMENTS} running tests`, 'All goal types, heatmaps and funnels'] },
    { name: 'Growth', price: `$${PLAN_PRICES_USD.growth.monthly}`, note: `per month, or $${PLAN_PRICES_USD.growth.yearly} a year`, points: [`${fmt(GROWTH_MONTHLY_VISITORS)} tested visitors a month`, 'No cap on running tests', 'Visual editor, multivariate tests and auto-shift'] },
    { name: 'Enterprise', price: 'Custom', note: 'Talk to us', points: ['Custom tested visitor volume', 'Unlimited team seats', 'Contract, DPA and a named contact'] },
];

export const HOME_FAQ: { q: string; a: string; href: string; link: string }[] = [
    { q: 'What is A/B testing?', a: 'You show two or more versions of a page to different visitors at the same time and measure which one leads to more of the action you care about, such as signups. Because the visitors are split at random, the difference in results comes from the change you made.', href: '/blog/statistical-significance-ab-test', link: 'Read the guide' },
    { q: 'How does FreeABTest work?', a: 'You create a test in the dashboard and add one script tag to your site. The script puts each visitor in a version, applies it, and counts the goals you set. The results page shows each conversion rate with its interval and tells you when a version is significantly better.', href: '/docs/quick-start', link: 'Quick start' },
    { q: 'Is FreeABTest free?', a: `There is a free plan with no card and no time limit: ${fmt(FREE_MONTHLY_VISITORS)} tested visitors a month, ${FREE_RUNNING_EXPERIMENTS} running test, ${FREE_MONTHLY_TESTS} new test a month and 1 click goal per test. Paid plans start at $${PLAN_PRICES_USD.starter.monthly} a month for more traffic, more tests and more goal types.`, href: '/pricing', link: 'Compare plans' },
    { q: 'Do I need coding knowledge?', a: 'Not for most tests. You paste one script tag, or use the Google Tag Manager or WordPress guide. Split URL tests and click goals need no code. On Growth, the visual editor changes text and layout without code. Custom events and server-side tests need a developer.', href: '/docs/install-guides', link: 'Install guides' },
    { q: 'How does visitor assignment work?', a: 'Each visitor has an ID. We hash it together with the test ID to pick a version, so the same visitor always gets the same version. Raising the traffic share adds new visitors without moving the ones already in the test.', href: '/docs/variations#traffic-allocation', link: 'Traffic and weights' },
    { q: 'How is statistical significance calculated?', a: 'Each variant is compared with the control using a sequential test, so the verdict holds however often you check. The 5% error rate is split across variants in A/B/n tests. Each rate also gets a 95% Wilson interval, and no verdict is given before every version has 100 visitors.', href: '/docs/results#significance', link: 'How results work' },
    { q: 'How do I integrate the JavaScript SDK?', a: 'Copy the snippet from your dashboard into the head of every page in the test. It reads your public key from the data-key attribute and starts on its own. Call ABTest.track for custom events on paid plans, or ABTest.bootstrap when your own code needs the variation.', href: '/docs/javascript-sdk', link: 'SDK reference' },
    { q: 'Can I use the REST API?', a: 'Yes. Browser endpoints take a public SDK key. Server endpoints for assignment and tracking, and the management endpoints for reading experiments and results, take a secret key that stays on your server. Creating experiments is done in the dashboard.', href: '/docs/rest-api', link: 'API reference' },
];

/** Worked example used on the homepage. tests/homeContent.test.ts checks these against the statistics code. */
export const WORKED_EXAMPLE = {
    control: { visitors: 4800, conversions: 240 },
    variant: { visitors: 4800, conversions: 312 },
    early: { visitors: 3000, controlConversions: 150, variantConversions: 195 },
};
