import type { DocPage } from '../types';

export const quickStart: DocPage = {
    slug: 'quick-start',
    title: 'Quick start',
    description: 'From sign in to a running URL split test with click goals.',
    group: 'Getting started',
    blocks: [
        { type: 'p', text: 'This guide creates a URL split test: a control page, one or more variation pages, and click goals. You only add one script tag to each page.' },
        { type: 'h2', text: '1. Sign in', id: 'workspace' },
        { type: 'p', text: 'Go to [Sign in](/signin) and continue with Google. An organization and default project are created for you.' },
        { type: 'h2', text: '2. Add your domain', id: 'domain' },
        { type: 'p', text: 'Open **Domains** and add the hostname of your site, for example `www.example.com`. The SDK only accepts traffic from registered domains.' },
        { type: 'h2', text: '3. Create an SDK key', id: 'api-key' },
        { type: 'p', text: 'Open **API keys**, create an SDK key for Development while you try things out, and copy it. The full key is shown once.' },
        { type: 'h2', text: '4. Create a test', id: 'create' },
        { type: 'p', text: 'Choose **New experiment** and follow the steps: domain, control URL, variation URLs, click goals, traffic, then review.' },
        { type: 'list', items: [
            'The control URL is your original page on the registered domain.',
            'Each variation is a full URL on the same domain. The free plan allows 1 variation; paid plans allow up to 10.',
            'Goals are CSS selectors such as `#headerCTA` or `.bodyCTA`. Mark one as primary.',
            'Weights must sum to 100. Traffic allocation is the share of visitors who enter the test.',
        ] },
        { type: 'h2', text: '5. Install the SDK', id: 'install' },
        { type: 'p', text: 'Put this single line in the `<head>` of the control page and every variation page. Replace the key with yours.' },
        { type: 'code', label: 'HTML', code: `<script src="https://YOUR-HOST/sdk.js" data-key="YOUR_SDK_KEY" async></script>` },
        { type: 'p', text: 'That is the only install step. The SDK matches the test by URL, buckets visitors, redirects variation traffic without flicker, records page views, and listens for your click goals.' },
        { type: 'h2', text: '6. Start the test', id: 'start' },
        { type: 'p', text: 'On the review step choose **Start test**, or open the draft and choose **Start experiment**. You can pause, resume and stop from the experiment page.' },
        { type: 'h2', text: '7. Read results', id: 'results' },
        { type: 'p', text: 'Open the **Results** tab. Switch between goals to see visitors, conversions, conversion rate, lift, 95% intervals and significance for each variation.' },
    ],
};
