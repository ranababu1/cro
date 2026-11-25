import type { DocPage } from '../types';

/** What connects today. Every row points at the page that documents it; keep plans in step with those pages. */
export const integrations: DocPage = {
    slug: 'integrations',
    title: 'Integrations',
    description: 'Tag Manager, WordPress, Google Analytics 4, single-page apps, your backend, webhooks and AI providers, with the plan each needs.',
    group: 'Getting started',
    blocks: [
        { type: 'p', text: 'freeabtest.com connects through one script tag, a REST API and webhooks. This page lists what works today and where each one is documented.' },
        { type: 'table', head: ['Integration', 'What it does', 'Plan', 'Guide'], rows: [
            ['Google Tag Manager', 'Add the snippet as a Custom HTML tag. Test views are pushed to `dataLayer`.', 'Every plan', '[Tag Manager](/docs/install-guides#gtm)'],
            ['WordPress', 'The FreeABTest plugin adds the snippet for you. On any plan you can paste it with a header code plugin or your theme.', 'Plugin on paid plans', '[WordPress](/docs/install-guides#wordpress)'],
            ['Google Analytics 4', 'An `experience_impression` event for each test version a visitor sees.', 'Every plan', '[GA4](/docs/javascript-sdk#ga4)'],
            ['Single-page apps', 'Call `ABTest.bootstrap()` after a route change. Works with React and other frameworks.', 'Every plan', '[Single-page apps](/docs/javascript-sdk#spa)'],
            ['Your backend', 'Assign visitors and record events from your server with a secret key.', 'Every plan', '[Server-side testing](/docs/server-side)'],
            ['REST API', 'List tests, read results, change traffic and roll out a winner.', 'Every plan', '[REST API](/docs/rest-api)'],
            ['AI providers', 'Bring your own key from OpenAI, Google Gemini, DeepSeek or Claude for test ideas, copy and result summaries.', 'Growth and Enterprise', '[AI suggestions](/docs/ai#setup)'],
            ['Webhooks', 'A signed POST when a test finds a winner, finishes, shows a sample ratio warning or a plan limit is reached.', 'Paid plans', '[Webhooks](/docs/webhooks)'],
        ] },
        { type: 'h2', text: 'Google Tag Manager', id: 'gtm' },
        { type: 'p', text: 'Paste the script tag into a Custom HTML tag that fires on **Initialization - All Pages**. With Tag Manager on the page, the snippet pushes each test view to `dataLayer`, so a GA4 event tag can forward it. Step by step: [Install with Google Tag Manager](/docs/install-guides#gtm).' },
        { type: 'h2', text: 'WordPress', id: 'wordpress' },
        { type: 'p', text: 'On paid plans, download the plugin from the [WordPress page](/wordpress), paste your public SDK key and turn it on. On the free plan, add the script tag with a header code plugin or a child theme. Both are in [Install on WordPress](/docs/install-guides#wordpress).' },
        { type: 'h2', text: 'Google Analytics 4', id: 'ga4' },
        { type: 'p', text: 'With gtag.js or Tag Manager on the page, the snippet sends `experience_impression` once per page with the test and version ids. Register `variation_name` as a custom dimension to compare versions in GA4, or build one audience per version. To turn it off, add `data-analytics="off"` to the script tag. Details: [Google Analytics 4](/docs/javascript-sdk#ga4).' },
        { type: 'h2', text: 'Single-page apps', id: 'spa' },
        { type: 'p', text: 'The snippet checks the page when it loads. In an app that changes the URL without a page load, call `ABTest.bootstrap()` after each route change. Visitors keep their version.' },
        { type: 'code', label: 'React example', code: `useEffect(() => {
  window.ABTest?.bootstrap();
}, [pathname]);` },
        { type: 'h2', text: 'Your backend and the REST API', id: 'api' },
        { type: 'p', text: 'A secret key lets your server assign visitors and send page views and conversions, so the change can live in server code. The same key reads results and manages running tests. Experiments are created in the dashboard. See [Server-side testing](/docs/server-side) and the [REST API reference](/docs/rest-api).' },
        { type: 'h2', text: 'Webhooks', id: 'webhooks' },
        { type: 'p', text: 'On paid plans, add an endpoint under **Webhooks** in the dashboard to get `test.winner`, `test.completed`, `test.srm_warning` and `quota.reached` events, for example to post in a chat channel. Each delivery is signed so you can check it came from us. See [Webhooks](/docs/webhooks).' },
        { type: 'h2', text: 'AI providers', id: 'ai' },
        { type: 'p', text: 'On Growth and Enterprise, add an API key from OpenAI, Google Gemini, DeepSeek or Claude (Anthropic) to get test ideas, hypotheses, copy suggestions and plain-words result summaries. You pay the provider directly. The verdict always comes from the statistics. See [AI suggestions](/docs/ai).' },
        { type: 'callout', tone: 'later', title: 'Not available yet', text: 'There is no npm or React package yet, and no store platform apps. The script tag works on any site, and the REST API covers everything else.' },
    ],
};
