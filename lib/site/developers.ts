/**
 * Content for /developers. Code and endpoints follow lib/docs/content (sdk, serverSide, restApi, environments, webhooks).
 * tests/developersPage.test.ts checks the snippets against the docs, the plan notes and every link.
 */
import type { Plan } from './product';

export const SITE_HOST = 'https://www.freeabtest.com';

export const ONBOARDING: { title: string; body: string; href: string; link: string }[] = [
    { title: 'Create a workspace', body: 'Sign in and add the domain you will test on. Browser keys only work on the domains you register.', href: '/docs/quick-start#domain', link: 'Add your domain' },
    { title: 'Copy your SDK key', body: 'Each project has dev, staging and production environments, each with its own keys.', href: '/docs/environments-and-keys', link: 'Environments and keys' },
    { title: 'Add the script tag', body: 'Put the snippet in the head of every page in the test. It starts on its own.', href: '/docs/quick-start#install', link: 'Install the SDK' },
    { title: 'Create and start a test', body: 'Set the variations and goal in the dashboard, check each version with a preview link, then start.', href: '/docs/quick-start#start', link: 'Start the test' },
];

export type Snippet = { id: string; title: string; body: string; label: string; code: string; href: string; link: string };

export const SNIPPETS: Snippet[] = [
    { id: 'browser', title: 'Browser SDK', body: 'One script tag assigns visitors, applies versions, handles split URL redirects and counts click, form and page visit goals.', label: 'HTML', href: '/docs/sdk', link: 'SDK reference',
        code: `<script src="${SITE_HOST}/sdk.js" data-key="cro_pk_prod_..." async></script>` },
    { id: 'events', title: 'Custom events', body: 'Count actions that happen in your own code, with an order value for revenue goals. Paid plans.', label: 'JavaScript', href: '/docs/sdk#track', link: 'track()',
        code: `ABTest.track('signup');\nABTest.track('purchase', { revenue: 49.99 });` },
    { id: 'bootstrap', title: 'Read the version in your code', body: 'Render your own component for the visitor\u2019s version, for example in a single-page app.', label: 'JavaScript', href: '/docs/sdk#bootstrap', link: 'bootstrap()',
        code: `ABTest.bootstrap().then(function (r) {\n  if (r.matched && r.variation_name === 'Variant B') {\n    document.body.classList.add('variant-b');\n  }\n});` },
    { id: 'server', title: 'Assign from your server', body: 'Use a secret key from your backend. The same visitor ID gets the same version as in the browser.', label: 'curl', href: '/docs/server-side', link: 'Server-side testing',
        code: `curl -X POST ${SITE_HOST}/api/server/assign \\\n  -H 'Authorization: Bearer cro_sk_prod_...' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"experiment_id": "exp_123", "user_id": "user_42"}'` },
    { id: 'results', title: 'Read results', body: 'Conversion rates, Wilson intervals and the winner, filtered to one environment if you like.', label: 'curl', href: '/docs/rest-api#results', link: 'Results endpoint',
        code: `curl '${SITE_HOST}/api/experiments/exp_123/results?environment=prod' \\\n  -H 'Authorization: Bearer cro_sk_prod_...'` },
];

export const SDK_METHODS: { name: string; body: string; plan: Plan; href: string }[] = [
    { name: 'track(eventName, options)', body: 'Counts a custom event goal for every running test with that event name, once per visitor. Pass revenue for order value.', plan: 'Paid plans', href: '/docs/sdk#track' },
    { name: 'trackConversion(experimentId, eventName)', body: 'Records a conversion for one test, for the version the visitor sees on this page.', plan: 'Paid plans', href: '/docs/sdk#track-conversion' },
    { name: 'bootstrap()', body: 'Matches the page to a running test and returns the visitor\u2019s version. Call it again on route changes in single-page apps.', plan: 'Every plan', href: '/docs/sdk#bootstrap' },
    { name: 'init(options)', body: 'Sets the key, the API address or your own user ID when you load the script without data-key.', plan: 'Every plan', href: '/docs/sdk#init' },
    { name: 'getUserId()', body: 'Returns the visitor ID in use, for debugging, joining with your analytics, or erasing one visitor.', plan: 'Every plan', href: '/docs/sdk#get-user-id' },
    { name: 'consent(granted)', body: 'With data-consent="required" on the tag, nothing is stored or sent until you call consent(true).', plan: 'Every plan', href: '/docs/sdk#consent' },
];

export type Endpoint = { method: 'GET' | 'POST' | 'PATCH'; path: string; auth: 'SDK key' | 'Secret key'; body: string; href: string };

export const ENDPOINTS: Endpoint[] = [
    { method: 'POST', path: '/api/assign', auth: 'SDK key', body: 'Assign a visitor from a browser or app.', href: '/docs/rest-api#assign' },
    { method: 'POST', path: '/api/track', auth: 'SDK key', body: 'Record a page view or a conversion.', href: '/docs/rest-api#track' },
    { method: 'POST', path: '/api/server/assign', auth: 'Secret key', body: 'Assign a visitor from your backend.', href: '/docs/server-side#assign' },
    { method: 'POST', path: '/api/server/track', auth: 'Secret key', body: 'Send up to 50 page views and conversions in one request.', href: '/docs/server-side#track' },
    { method: 'GET', path: '/api/experiments', auth: 'Secret key', body: 'List the experiments in the key\u2019s project.', href: '/docs/rest-api#list-experiments' },
    { method: 'PATCH', path: '/api/experiments/{id}', auth: 'Secret key', body: 'Change the name, description, traffic or status.', href: '/docs/rest-api#update-experiment' },
    { method: 'GET', path: '/api/experiments/{id}/results', auth: 'Secret key', body: 'Rates, intervals, lift and the winner.', href: '/docs/rest-api#results' },
    { method: 'POST', path: '/api/experiments/{id}/rollout', auth: 'Secret key', body: 'Send every visitor to one version.', href: '/docs/rest-api#rollout' },
    { method: 'POST', path: '/api/experiments/{id}/variations/{variationId}/preview', auth: 'Secret key', body: 'A preview link for automated browser tests, never counted.', href: '/docs/rest-api#preview-link' },
];

export const KEY_TYPES: { name: string; format: string; where: string; calls: string; expose: string }[] = [
    { name: 'SDK key', format: 'cro_pk_<env>_...', where: 'Browsers and page source', calls: '/api/assign and /api/track', expose: 'Yes, it only works on your registered domains' },
    { name: 'Secret key', format: 'cro_sk_<env>_...', where: 'Servers only', calls: 'Server, experiment and results endpoints for its project', expose: 'No. Keep it in your server configuration' },
];

export const WEBHOOK_EVENTS: { name: string; body: string }[] = [
    { name: 'test.winner', body: 'A running test found a winner on its primary goal.' },
    { name: 'test.completed', body: 'A test was stopped by hand, on schedule or by a rollout.' },
    { name: 'test.srm_warning', body: 'The visitor split does not match the weights.' },
    { name: 'quota.reached', body: 'Your organization used its monthly tested visitors.' },
];

export const INTEGRATIONS: { title: string; body: string; plan: Plan; href: string }[] = [
    { title: 'Google Tag Manager', body: 'Add the snippet as a custom HTML tag. Test views are pushed to the dataLayer.', plan: 'Every plan', href: '/docs/install-guides' },
    { title: 'WordPress', body: 'Paste the snippet with any header plugin, or use our plugin on paid plans.', plan: 'Every plan', href: '/wordpress' },
    { title: 'Google Analytics 4', body: 'An experience_impression event for each test view, to compare versions in your reports.', plan: 'Every plan', href: '/docs/sdk#ga4' },
    { title: 'Single-page apps', body: 'Call bootstrap on each route change, for example in a React effect.', plan: 'Every plan', href: '/docs/sdk#spa' },
];

export const ERRORS: [string, string][] = [
    ['400', 'Invalid input. The message names the field.'],
    ['401', 'Missing, unknown or revoked key.'],
    ['403', 'A plan limit was reached, or the action is not allowed for this caller.'],
    ['404', 'Not found, including experiments in other projects.'],
    ['429', 'Rate limited. Wait for the seconds in Retry-After.'],
];

export const DOC_LINKS: { href: string; title: string; body: string }[] = [
    { href: '/docs/quick-start', title: 'Quick start', body: 'From sign in to a running test' },
    { href: '/docs/sdk', title: 'JavaScript SDK', body: 'Install, methods, consent and flicker' },
    { href: '/docs/rest-api', title: 'REST API', body: 'Authentication, endpoints and errors' },
    { href: '/docs/server-side', title: 'Server-side testing', body: 'Assign and track from your backend' },
    { href: '/docs/environments-and-keys', title: 'Environments and keys', body: 'Dev, staging, production and rotation' },
    { href: '/docs/webhooks', title: 'Webhooks', body: 'Events, delivery and signatures' },
    { href: '/docs/install-guides', title: 'Install guides', body: 'Tag Manager and WordPress' },
    { href: '/docs/troubleshooting', title: 'Troubleshooting', body: 'When a test does not show or count' },
];
