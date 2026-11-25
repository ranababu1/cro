/**
 * Content for /solutions and its four audience pages. Every feature named here is built today, with the plan from
 * app/pricing/page.tsx. No platform integrations beyond the snippet, Tag Manager, WordPress and the REST API.
 * tests/solutionsPages.test.ts checks plan notes, numbers and links.
 */
import { FREE_DAILY_VISITORS, FREE_MONTHLY_VISITORS, PAID_MAX_GOALS, STARTER_MONTHLY_VISITORS } from '@/lib/plans';
import { PLAN_PRICES_USD } from '@/lib/billing/config';
import { fmt } from './home';
import type { Plan } from './product';

export type SolutionIdea = { title: string; body: string; feature: string; plan: Plan; href: string };
export type SolutionGoal = { name: string; how: string; plan: Plan };
export type WorkflowStep = { title: string; body: string };

export type Solution = {
    slug: 'marketing' | 'saas' | 'ecommerce' | 'startups';
    /** Short name for menus and cards. */
    name: string;
    navBody: string;
    metaTitle: string;
    metaDescription: string;
    eyebrow: string;
    title: string;
    lede: string;
    /** Problems this audience runs into, in their words. */
    challenges: { title: string; body: string }[];
    /** One worked workflow, start to finish. Illustrative, never presented as a customer story. */
    workflow: { name: string; context: string; steps: WorkflowStep[] };
    ideas: SolutionIdea[];
    goals: SolutionGoal[];
    /** Which plan fits, in plain words. */
    planNote: { plan: string; body: string }[];
    links: { href: string; label: string }[];
};

export const SOLUTIONS: Solution[] = [
    {
        slug: 'marketing', name: 'Marketing teams', navBody: 'Landing pages, headlines and campaign tests',
        metaTitle: 'A/B testing for marketing teams and landing pages',
        metaDescription: 'Test landing pages, headlines and calls to action without waiting for a release. Split URL tests, click goals, UTM targeting and a visual editor on Growth.',
        eyebrow: 'For marketing teams', title: 'Test the pages your campaigns depend on',
        lede: 'Change a headline, a call to action or a whole landing page, show it to part of your traffic, and see which version brings more signups. Most tests need one script tag and no engineering time.',
        challenges: [
            { title: 'Releases are slow', body: 'Waiting for a developer to change one headline means few tests a quarter. Split URL tests and the visual editor let you run them yourself.' },
            { title: 'Opinions win meetings', body: 'Everyone has a favourite headline. A test with a clear verdict ends the debate with data.' },
            { title: 'Campaign traffic is mixed', body: 'An ad visitor behaves differently from a returning one. Targeting by UTM tag keeps a campaign test to the visitors it was made for.' },
        ],
        workflow: {
            name: 'Example: a paid search landing page', context: 'A team sends search ads to /lp/demo and wants more demo requests. Example plan, not a customer story.',
            steps: [
                { title: 'Write the hypothesis', body: 'Visitors from search want proof first, so a headline that names the result they get should lift demo requests by at least 10%.' },
                { title: 'Build the variant', body: 'Duplicate the page as /lp/demo-b with the new headline, or on Growth change the headline in the visual editor.' },
                { title: 'Target the campaign', body: 'In the Traffic step, limit the test to visitors whose utm_source is the search campaign. Everyone else sees the original page.' },
                { title: 'Set the goal', body: 'A click goal on the Book a demo button. On a paid plan, add a page visit goal on the thank-you page as the primary goal.' },
                { title: 'Read the verdict', body: 'Wait for at least a full week and 100 visitors per version, then act on the sequential verdict rather than the first good day.' },
                { title: 'Roll out', body: 'Roll out the winning version to every visitor with one click, then update the page and stop the rollout.' },
            ],
        },
        ideas: [
            { title: 'Landing page headline', body: 'Name the outcome, not the feature. Test one clear change at a time.', feature: 'A/B test with a click goal', plan: 'Every plan', href: '/docs/experiments' },
            { title: 'Whole page redesign', body: 'Compare the current page with a new design built on its own address.', feature: 'Split URL test', plan: 'Every plan', href: '/blog/split-url-testing' },
            { title: 'Call to action copy and placement', body: 'Button text, colour and position, with clicks counted on a CSS selector.', feature: 'Click goal', plan: 'Every plan', href: '/docs/goals' },
            { title: 'Copy changes without code', body: 'Change text, links and images, move or hide elements, with mobile and tablet preview.', feature: 'Visual editor', plan: 'Growth and above', href: '/docs/variations#visual-editor' },
            { title: 'Offer popup or announcement bar', body: 'Show an offer to part of your traffic and count views and clicks.', feature: 'Popups and calls to action', plan: 'Paid plans', href: '/docs/popups' },
            { title: 'Ask what is missing', body: 'A one-question survey on the pricing page turns answers into test ideas.', feature: 'Surveys', plan: 'Paid plans', href: '/docs/surveys' },
        ],
        goals: [
            { name: 'Clicks on a button or link', how: 'Click goal on a CSS selector', plan: 'Every plan' },
            { name: 'Form submissions', how: 'Form submit goal', plan: 'Paid plans' },
            { name: 'Thank-you page visits', how: 'Page visit goal', plan: 'Paid plans' },
            { name: 'Clicks by campaign', how: 'Results by segment, by traffic source', plan: 'Paid plans' },
        ],
        planNote: [
            { plan: 'Free', body: `One landing page test at a time, ${fmt(FREE_MONTHLY_VISITORS)} tested visitors a month, a click goal and UTM targeting.` },
            { plan: 'Starter', body: `$${PLAN_PRICES_USD.starter.monthly} a month for ${fmt(STARTER_MONTHLY_VISITORS)} tested visitors, form and page visit goals, popups, surveys and heatmaps.` },
            { plan: 'Growth', body: `$${PLAN_PRICES_USD.growth.monthly} a month adds the visual editor, multivariate tests and auto-shift.` },
        ],
        links: [{ href: '/docs/quick-start', label: 'Quick start' }, { href: '/docs/install-guides', label: 'Tag Manager and WordPress guides' }, { href: '/blog/split-url-testing', label: 'Split URL testing guide' }],
    },
    {
        slug: 'saas', name: 'SaaS products', navBody: 'Pricing pages, signup flows and in-app tests',
        metaTitle: 'A/B testing for SaaS pricing pages and signups',
        metaDescription: 'Test pricing pages, signup flows and in-product changes, with server-side assignment, custom events from your code, your own user IDs and environments.',
        eyebrow: 'For SaaS products', title: 'Test from the pricing page to the product',
        lede: 'Run marketing tests on the public site and product tests inside your app with the same assignment and statistics. Use your own user IDs so a person sees one version on every device.',
        challenges: [
            { title: 'The win is far from the click', body: 'A signup is not a paying customer. Custom events from your code let you measure the step that matters, such as an activated account.' },
            { title: 'Logged-in users switch devices', body: 'Pass your user ID and the same person sees the same version on laptop and phone.' },
            { title: 'Some changes never reach the browser', body: 'Server-side assignment tests onboarding emails, trial length or limits from your backend.' },
        ],
        workflow: {
            name: 'Example: a pricing page and the signup that follows', context: 'A product team tests a simpler plan table and measures trials that are activated. Example plan, not a customer story.',
            steps: [
                { title: 'Plan it in the test planner', body: 'Hypothesis: fewer plan columns make the choice easier, so trial starts rise by at least 10%.' },
                { title: 'Read the version in your code', body: 'Your pricing component calls ABTest.bootstrap and renders the table for the visitor\u2019s version.' },
                { title: 'Use your user ID in the app', body: 'On logged-in pages, pass your user ID to init so a person sees the same version on every device.' },
                { title: 'Send the events', body: 'ABTest.track sends trial_started from the browser. Your backend sends account_activated through the server endpoint with a secret key.' },
                { title: 'Check in staging first', body: 'Run the same test in the staging environment with its own keys before production.' },
                { title: 'Decide on the primary goal', body: 'Pick account_activated as the primary goal before you start, and use funnels to see where people drop off.' },
            ],
        },
        ideas: [
            { title: 'Pricing page layout', body: 'Number of plans, monthly or yearly default, and the plan you highlight.', feature: 'A/B test with custom events', plan: 'Paid plans', href: '/docs/javascript-sdk#bootstrap' },
            { title: 'Signup form length', body: 'Fewer fields against more context, measured on completed signups.', feature: 'Form submit goal', plan: 'Paid plans', href: '/docs/goals' },
            { title: 'Onboarding steps', body: 'Test the first screens after signup, assigned from your server.', feature: 'Server-side assignment', plan: 'Every plan', href: '/docs/server-side' },
            { title: 'Homepage message', body: 'Lead with the outcome or the feature, measured on trial starts.', feature: 'A/B test with a click goal', plan: 'Every plan', href: '/blog/ab-test-ideas-saas-landing-pages' },
            { title: 'Signup funnel', body: 'Pricing view, signup start, signup finish, in order, per version.', feature: 'Funnels', plan: 'Paid plans', href: '/docs/results#funnels' },
            { title: 'Winners in your own tools', body: 'Get a signed webhook when a test finds a winner. Results are also on the REST API on every plan.', feature: 'Webhooks', plan: 'Paid plans', href: '/docs/webhooks' },
        ],
        goals: [
            { name: 'Trial starts', how: 'Custom event from ABTest.track', plan: 'Paid plans' },
            { name: 'Activated accounts', how: 'Conversion sent from your server with a secret key', plan: 'Paid plans' },
            { name: 'Clicks on Start trial', how: 'Click goal on a CSS selector', plan: 'Every plan' },
            { name: 'Plan revenue', how: 'Revenue goal with the first payment', plan: 'Paid plans' },
        ],
        planNote: [
            { plan: 'Free', body: 'Server-side assignment and a click goal work on Free. Conversions sent from your code need a paid plan.' },
            { plan: 'Starter', body: `$${PLAN_PRICES_USD.starter.monthly} a month: custom events, up to ${PAID_MAX_GOALS} goals per test, funnels, webhooks and 5 team seats.` },
            { plan: 'Growth', body: `$${PLAN_PRICES_USD.growth.monthly} a month: multi-page tests, auto-shift and 15 team seats.` },
        ],
        links: [{ href: '/docs/javascript-sdk', label: 'JavaScript SDK' }, { href: '/docs/server-side', label: 'Server-side testing' }, { href: '/docs/environments-and-keys', label: 'Environments and keys' }],
    },
    {
        slug: 'ecommerce', name: 'Ecommerce', navBody: 'Product pages, checkout and revenue per visitor',
        metaTitle: 'A/B testing for ecommerce product pages and revenue',
        metaDescription: 'Test product pages, offers and checkout steps, and measure revenue per visitor and average order value. Works on any store where you can add one script tag.',
        eyebrow: 'For online stores', title: 'Measure revenue, not just clicks',
        lede: 'A version that gets more add-to-cart clicks can still bring less money. Send the order value with each purchase and compare revenue per visitor and average order value for every version.',
        challenges: [
            { title: 'More orders, smaller baskets', body: 'Revenue per visitor captures both: more buyers and bigger orders, divided by every visitor in the version.' },
            { title: 'A few big orders skew results', body: 'Revenue is noisy. Results compare revenue per visitor with Welch\u2019s t-test, and you plan for a larger sample.' },
            { title: 'A change can break checkout', body: 'JavaScript error tracking per version shows when a new version breaks something.' },
        ],
        workflow: {
            name: 'Example: free shipping threshold on product pages', context: 'A store tests a shipping message on product pages and measures revenue per visitor. Example plan, not a customer story.',
            steps: [
                { title: 'Add the snippet', body: 'Paste the script tag in your store theme\u2019s head, or add it through Tag Manager, on product pages and on the order confirmation page.' },
                { title: 'Create the test', body: 'Control: the current product page. Variant: a line that says how much more to spend for free shipping.' },
                { title: 'Send the purchase', body: 'On the confirmation page, call ABTest.track with the order value. Amounts are in your store currency, without a currency sign.' },
                { title: 'Watch two numbers', body: 'Conversion rate on the purchase goal, and revenue per visitor with average order value in the Revenue section.' },
                { title: 'Check for errors', body: 'The Errors tab shows errors per 100 visitors for each version.' },
                { title: 'Decide', body: 'Roll out the version with higher revenue per visitor once the difference is clear, and at least a full week has passed.' },
            ],
        },
        ideas: [
            { title: 'Product page layout', body: 'Image size, price position and how reviews are shown.', feature: 'A/B test', plan: 'Every plan', href: '/docs/experiments' },
            { title: 'Shipping and returns message', body: 'Where and how you show delivery cost and the returns promise.', feature: 'Revenue goal', plan: 'Paid plans', href: '/docs/goals#revenue' },
            { title: 'Add to cart button', body: 'Copy, size and sticky placement on mobile.', feature: 'Click goal', plan: 'Every plan', href: '/docs/goals' },
            { title: 'Mobile against desktop', body: 'See whether a change wins on one device and loses on the other.', feature: 'Results by segment', plan: 'Paid plans', href: '/docs/results#segments' },
            { title: 'Where shoppers click', body: 'Click and scroll maps for each version of a product page.', feature: 'Heatmaps', plan: 'Paid plans', href: '/docs/results#heatmaps' },
            { title: 'Seasonal offer', body: 'Shift traffic toward the better offer while a short promotion runs.', feature: 'Auto-shift traffic to the winner', plan: 'Growth and above', href: '/docs/variations#auto-shift' },
        ],
        goals: [
            { name: 'Purchases and order value', how: 'Revenue goal: ABTest.track with revenue', plan: 'Paid plans' },
            { name: 'Revenue per visitor and average order value', how: 'Revenue section in Results', plan: 'Paid plans' },
            { name: 'Add to cart clicks', how: 'Click goal on a CSS selector', plan: 'Every plan' },
            { name: 'Checkout page visits', how: 'Page visit goal', plan: 'Paid plans' },
        ],
        planNote: [
            { plan: 'Free', body: 'Try a product page test with an add to cart click goal. Revenue goals need a paid plan.' },
            { plan: 'Starter', body: `$${PLAN_PRICES_USD.starter.monthly} a month: revenue goals, segments, heatmaps and error tracking for ${fmt(STARTER_MONTHLY_VISITORS)} tested visitors.` },
            { plan: 'Growth', body: `$${PLAN_PRICES_USD.growth.monthly} a month: auto-shift for promotions, the visual editor and multi-page tests.` },
        ],
        links: [{ href: '/docs/goals#revenue', label: 'Revenue goals' }, { href: '/docs/results#revenue', label: 'Reading revenue results' }, { href: '/docs/install-guides', label: 'Install guides' }],
    },
    {
        slug: 'startups', name: 'Startups', navBody: 'Free plan, low traffic and the first tests',
        metaTitle: 'A/B testing for startups with low traffic',
        metaDescription: `Start A/B testing free with ${fmt(FREE_MONTHLY_VISITORS)} tested visitors a month, and learn how to pick, size and plan tests when traffic is low.`,
        eyebrow: 'For startups', title: 'Start testing before you have a big audience',
        lede: 'The free plan has no card and no time limit. With less traffic, the trick is to test big changes on the pages that matter, and to know how many visitors a test needs before you start.',
        challenges: [
            { title: 'Not enough visitors', body: 'Small changes need tens of thousands of visitors to detect. Test bold changes on your busiest page instead.' },
            { title: 'No budget for tools', body: `The free plan covers ${fmt(FREE_MONTHLY_VISITORS)} tested visitors a month, up to ${FREE_DAILY_VISITORS} a day, with no card.` },
            { title: 'Too many ideas', body: 'The test planner keeps ideas with a hypothesis and a priority, so you run the one most likely to matter.' },
        ],
        workflow: {
            name: 'Example: the first test on a new homepage', context: 'A small team with about 250 visitors a day picks its first test. Example plan, not a customer story.',
            steps: [
                { title: 'Pick the busiest page', body: 'The homepage gets most visitors, so it reaches a result first.' },
                { title: 'Pick a bold change', body: 'A new headline and hero that say who the product is for, not a button colour.' },
                { title: 'Check the sample size', body: 'At a 5% signup rate, detecting a 20% lift with one planned look takes about 8,159 visitors per version. The sequential verdict needs more for the same lift, but can stop earlier when the real lift is bigger.' },
                { title: 'Set a time box', body: 'At 250 visitors a day split two ways, that is at least two months, which is why the change has to be bold. Set the end date now, and if the result is still unclear then, keep the simpler version.' },
                { title: 'Measure the click that matters', body: 'A click goal on the signup button, available on the free plan.' },
                { title: 'Write down the outcome', body: 'Win or not, add what you learned to the test description and plan the next idea.' },
            ],
        },
        ideas: [
            { title: 'Homepage headline and hero', body: 'Who it is for and what changes for them. Big changes show up faster.', feature: 'A/B test with a click goal', plan: 'Every plan', href: '/docs/experiments' },
            { title: 'Two different landing pages', body: 'Compare two whole pages instead of small tweaks.', feature: 'Split URL test', plan: 'Every plan', href: '/blog/split-url-testing' },
            { title: 'A backlog worth running', body: 'Keep ideas with a hypothesis, page and priority, and a duration estimate.', feature: 'Test planner', plan: 'Every plan', href: '/docs/experiments' },
            { title: 'Ship the winner today', body: 'Roll out a winning version to everyone while you put it in your code.', feature: 'Roll out the winner', plan: 'Every plan', href: '/docs/choosing-a-winner#rollout' },
        ],
        goals: [
            { name: 'Signup button clicks', how: 'Click goal on a CSS selector', plan: 'Every plan' },
            { name: 'Completed signups', how: 'Form submit or page visit goal', plan: 'Paid plans' },
        ],
        planNote: [
            { plan: 'Free', body: `$0, no card, no time limit: ${fmt(FREE_MONTHLY_VISITORS)} tested visitors a month, 1 running test, 1 new test a month and 1 click goal.` },
            { plan: 'Starter', body: `When you outgrow it: $${PLAN_PRICES_USD.starter.monthly} a month, or $${PLAN_PRICES_USD.starter.yearly} a year, for more traffic, more tests and every goal type. We never upgrade you automatically.` },
        ],
        links: [{ href: '/blog/ab-testing-low-traffic', label: 'Testing with low traffic' }, { href: '/blog/ab-test-sample-size', label: 'Sample size guide' }, { href: '/docs/results#sample-size', label: 'Sample size table' }],
    },
];

export const solutionBySlug = (slug: Solution['slug']) => SOLUTIONS.find((s) => s.slug === slug)!;
