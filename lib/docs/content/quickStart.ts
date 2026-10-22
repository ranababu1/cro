import { INSTALL_ONCE } from '@/lib/installCopy';
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
        { type: 'p', text: 'Open **Domains** and add the hostname of your site, for example `www.example.com`. The SDK only accepts traffic from registered domains, checked against the Origin or Referer of the page. Development keys also work on localhost.' },
        { type: 'h2', text: '3. Your SDK key is ready', id: 'api-key' },
        { type: 'p', text: 'A production public SDK key is created for your project automatically. The install snippet in the app is already filled in. Use the Production / Development toggle on the snippet if you want a separate development key.' },
        { type: 'h2', text: '4. Create a test', id: 'create' },
        { type: 'p', text: 'Choose **New experiment** and follow the steps: domain, control URL, variation URLs, goals, traffic and audience, then review.' },
        { type: 'list', items: [
            'The control URL is your original page on the registered domain.',
            'Each variation is a full URL on the same domain. The free plan allows 1 variation; paid plans allow up to 50.',
            'On the free plan a test has 1 goal: a click on a CSS selector such as `#headerCTA` or `.bodyCTA`. Paid plans add more goals per test, form submits, page visits and custom events; mark one as primary. See [Goals](/docs/goals).',
            'Weights must sum to 100. Traffic allocation is the share of visitors who enter the test.',
        ] },
        { type: 'h2', text: '5. Install the SDK', id: 'install' },
        { type: 'p', text: 'When you are signed in, the app shows a ready-to-copy snippet with `https://www.freeabtest.com` and your real public key. No paste step.' },
        { type: 'p', text: 'Put this single line in the `<head>` of the control page and every variation page. Copy it from the app so your key is already in it. Using Google Tag Manager or WordPress? See [Install guides](/docs/install-guides).' },
        { type: 'code', label: 'HTML', code: `<script src="https://www.freeabtest.com/sdk.js" data-key="cro_pk_prod_..." async></script>` },
        { type: 'p', text: INSTALL_ONCE.replace('<head>', '`<head>`') },
        { type: 'p', text: 'That is the only install step. The SDK matches the test by URL, buckets visitors, redirects variation traffic without flicker, records page views, and listens for your click goals.' },
        { type: 'h2', text: '6. Start the test', id: 'start' },
        { type: 'p', text: 'On the review step choose **Start test**, or open the draft and choose **Start experiment**. You can pause, resume and stop from the experiment page.' },
        { type: 'p', text: 'On the Free plan a test starts once the install snippet has loaded on its site in the last 7 days. Until then the test page shows **Install the snippet to verify your site**: add the snippet, open a page that has it in your browser, then choose **Re-check**. Paid plans skip this step.' },
        { type: 'h2', text: '7. Read results', id: 'results' },
        { type: 'p', text: 'Open the **Results** tab. Switch between goals to see visitors, conversions, conversion rate, lift, 95% intervals and significance for each variation.' },
    ],
};
