/**
 * Content for /resources and /guides. Guides link to existing blog posts and docs pages only;
 * titles are read from the posts and docs at build time. tests/resourcesPages.test.ts checks every slug.
 * Posts that name other products are left out because non-blog pages never name competitors.
 */
export type GuideRef = { kind: 'blog' | 'docs' | 'page'; slug: string; note: string };

export const GUIDE_SECTIONS: { id: string; title: string; lede: string; guides: GuideRef[] }[] = [
    {
        id: 'plan', title: 'Plan a test', lede: 'Pick what to test and work out how much traffic you need before you start.',
        guides: [
            { kind: 'blog', slug: 'ab-test-ideas-saas-landing-pages', note: 'Test ideas for landing pages, with what each one tends to change.' },
            { kind: 'blog', slug: 'ab-test-sample-size', note: 'Work out the visitors you need from your conversion rate and the lift you care about.' },
            { kind: 'blog', slug: 'how-long-to-run-an-ab-test', note: 'Turn a sample size into a run time, and why a full week matters.' },
            { kind: 'blog', slug: 'ab-testing-low-traffic', note: 'What still works when your site gets a few hundred visitors a day.' },
        ],
    },
    {
        id: 'read', title: 'Read your results', lede: 'Know when a result is real and what the numbers on the results page mean.',
        guides: [
            { kind: 'blog', slug: 'statistical-significance-ab-test', note: 'What significance means, in plain words, with a worked example.' },
            { kind: 'blog', slug: 'confidence-interval-ab-test', note: 'Read the range around each conversion rate and the gap between versions.' },
            { kind: 'blog', slug: 'ab-test-peeking-problem', note: 'Why checking results early finds false winners, and how sequential tests fix it.' },
            { kind: 'page', slug: '/statistical-methodology', note: 'The exact tests behind every verdict, with formulas and examples.' },
            { kind: 'docs', slug: 'choosing-a-winner', note: 'From a significant result to the winner on your live site.' },
        ],
    },
    {
        id: 'build', title: 'Set up and build', lede: 'Install the snippet, build versions and run tests from code.',
        guides: [
            { kind: 'docs', slug: 'quick-start', note: 'From sign-up to a running test in a few steps.' },
            { kind: 'docs', slug: 'install-guides', note: 'Add the snippet by hand, with Google Tag Manager or on WordPress.' },
            { kind: 'blog', slug: 'split-url-testing', note: 'When to test two whole pages against each other, and how.' },
            { kind: 'blog', slug: 'ab-test-javascript', note: 'Run a test with plain JavaScript and see what the snippet does for you.' },
            { kind: 'blog', slug: 'ab-test-bucketing-hashing', note: 'How hashing gives every visitor the same version on every visit.' },
            { kind: 'docs', slug: 'server-side', note: 'Assign visitors and send events from your server.' },
        ],
    },
];

export const RESOURCE_LINKS: { href: string; title: string; body: string }[] = [
    { href: '/guides', title: 'Guides', body: 'Hand-picked reading for planning tests, reading results and setting up.' },
    { href: '/blog', title: 'Blog', body: 'Articles on testing, statistics and test ideas.' },
    { href: '/docs', title: 'Documentation', body: 'Setup, every feature and the API reference.' },
    { href: '/faq', title: 'FAQ', body: 'Short answers about setup, tests, results and privacy.' },
    { href: '/changelog', title: 'Changelog', body: 'What is new in the product, newest first.' },
    { href: '/statistical-methodology', title: 'Statistical methodology', body: 'The tests behind every verdict, with worked examples.' },
    { href: '/developers', title: 'Developer hub', body: 'Snippet, SDK, REST API, webhooks and server-side tests.' },
];
