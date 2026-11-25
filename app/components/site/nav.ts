/**
 * Marketing site navigation. Every href must point at a page that exists today (tests/siteNav.test.ts).
 * Items for pages that are not built yet point at the closest existing page; swap the href when the page ships.
 */
export type NavItem = { href: string; title: string; body: string };
export type NavGroup = { heading: string; items: NavItem[] };
export type NavFeature = { eyebrow: string; title: string; body: string; href: string; cta: string };
export type NavMenu = { label: string; groups: NavGroup[]; feature?: NavFeature };

export const NAV_MENUS: NavMenu[] = [
    {
        label: 'Product',
        groups: [
            {
                heading: 'Platform',
                items: [
                    { href: '/product', title: 'Overview', body: 'One platform for marketers and developers' },
                    { href: '/features', title: 'Features', body: 'Every feature, its limits and its plan' },
                    { href: '/how-it-works', title: 'How it works', body: 'From hypothesis to decision in seven steps' },
                    { href: '/experiment-analytics', title: 'Experiment analytics', body: 'Conversion rates, intervals and the verdict' },
                ],
            },
            {
                heading: 'Build and measure',
                items: [
                    { href: '/docs/variations#visual-editor', title: 'Visual editor', body: 'Change text, images and layout without code' },
                    { href: '/docs/goals', title: 'Goals', body: 'Clicks, form submits, page visits and events' },
                    { href: '/docs/results#heatmaps', title: 'Heatmaps', body: 'Click and scroll maps for each version' },
                ],
            },
        ],
        feature: { eyebrow: 'Free plan', title: 'Start with one test a month', body: '10,000 tested visitors a month, no card needed.', href: '/pricing', cta: 'See plans' },
    },
    {
        label: 'Solutions',
        groups: [
            {
                heading: 'By team',
                items: [
                    { href: '/solutions/marketing', title: 'Marketing teams', body: 'Landing pages, headlines and campaign tests' },
                    { href: '/solutions/saas', title: 'SaaS products', body: 'Pricing pages, signup flows and in-app tests' },
                ],
            },
            {
                heading: 'By business',
                items: [
                    { href: '/solutions/ecommerce', title: 'Ecommerce', body: 'Product pages, checkout and revenue per visitor' },
                    { href: '/solutions/startups', title: 'Startups', body: 'Free plan, low traffic and the first tests' },
                    { href: '/solutions', title: 'All solutions', body: 'Workflows and test ideas for each team' },
                ],
            },
        ],
        feature: { eyebrow: 'Guide', title: 'Split URL testing', body: 'Compare two whole pages and send each visitor to one.', href: '/blog/split-url-testing', cta: 'Read the guide' },
    },
    {
        label: 'Developers',
        groups: [
            {
                heading: 'Integrate',
                items: [
                    { href: '/developers', title: 'Developer hub', body: 'Setup, code examples, keys and webhooks' },
                    { href: '/docs/javascript-sdk', title: 'JavaScript SDK', body: 'One script tag and the ABTest API' },
                    { href: '/docs/rest-api', title: 'REST API', body: 'Assign, track and read results over HTTP' },
                    { href: '/docs/server-side', title: 'Server-side testing', body: 'Assign visitors from your backend' },
                ],
            },
            {
                heading: 'Connect',
                items: [
                    { href: '/docs/integrations', title: 'Integrations', body: 'Google Tag Manager, WordPress and GA4' },
                    { href: '/docs/webhooks', title: 'Webhooks', body: 'Signed events when a test changes' },
                    { href: '/statistical-methodology', title: 'Statistical methods', body: 'Formulas and worked examples for every result' },
                ],
            },
        ],
        feature: { eyebrow: 'Quick start', title: 'Your first test in minutes', body: 'Add the snippet, create a test, check it works.', href: '/docs/quick-start', cta: 'Open the quick start' },
    },
    {
        label: 'Resources',
        groups: [
            {
                heading: 'Learn',
                items: [
                    { href: '/blog', title: 'Blog', body: 'Guides on testing, statistics and ideas' },
                    { href: '/docs', title: 'Documentation', body: 'Setup, features and reference' },
                    { href: '/pricing#faq', title: 'FAQ', body: 'Plans, limits and how things work' },
                ],
            },
            {
                heading: 'Company',
                items: [
                    { href: '/about', title: 'About', body: 'Who runs FreeABTest' },
                    { href: '/contact', title: 'Contact', body: 'Email, phone and address' },
                    { href: '/security', title: 'Security', body: 'How we protect your data' },
                ],
            },
        ],
        feature: { eyebrow: 'From the blog', title: 'Statistical significance, explained', body: 'What a p-value tells you and when to stop a test.', href: '/blog/statistical-significance-ab-test', cta: 'Read the post' },
    },
];

export const NAV_LINKS: { href: string; title: string }[] = [{ href: '/pricing', title: 'Pricing' }];

export const SIGN_IN_HREF = '/signin';
export const START_HREF = '/signin';

export type FooterColumn = { heading: string; links: { href: string; title: string }[] };

export const FOOTER_COLUMNS: FooterColumn[] = [
    { heading: 'Product', links: [
        { href: '/product', title: 'Overview' },
        { href: '/features', title: 'Features' },
        { href: '/how-it-works', title: 'How it works' },
        { href: '/experiment-analytics', title: 'Experiment analytics' },
        { href: '/solutions', title: 'Solutions' },
        { href: '/pricing', title: 'Pricing' },
        { href: '/wordpress', title: 'WordPress plugin' },
    ] },
    { heading: 'Developers', links: [
        { href: '/developers', title: 'Developer hub' },
        { href: '/docs', title: 'Documentation' },
        { href: '/docs/javascript-sdk', title: 'JavaScript SDK' },
        { href: '/docs/rest-api', title: 'REST API' },
        { href: '/docs/integrations', title: 'Integrations' },
    ] },
    { heading: 'Resources', links: [
        { href: '/blog', title: 'Blog' },
        { href: '/docs/quick-start', title: 'Quick start' },
        { href: '/statistical-methodology', title: 'Statistical methodology' },
        { href: '/pricing#faq', title: 'FAQ' },
        { href: '/docs/troubleshooting', title: 'Troubleshooting' },
    ] },
    { heading: 'Company', links: [
        { href: '/about', title: 'About' },
        { href: '/contact', title: 'Contact' },
        { href: '/security', title: 'Security' },
        { href: '/signin', title: 'Sign in' },
    ] },
    { heading: 'Legal', links: [
        { href: '/legal/terms', title: 'Terms' },
        { href: '/legal/privacy', title: 'Privacy' },
        { href: '/legal/cookies', title: 'Cookies' },
        { href: '/legal/refunds', title: 'Refunds' },
        { href: '/legal/delivery', title: 'Service delivery' },
        { href: '/legal/dpa', title: 'DPA' },
    ] },
];

/** Every href the marketing chrome links to, for tests. */
export function allChromeHrefs(): string[] {
    return [
        ...NAV_MENUS.flatMap((m) => [...m.groups.flatMap((g) => g.items.map((i) => i.href)), ...(m.feature ? [m.feature.href] : [])]),
        ...NAV_LINKS.map((l) => l.href), SIGN_IN_HREF, START_HREF,
        ...FOOTER_COLUMNS.flatMap((c) => c.links.map((l) => l.href)),
    ];
}
