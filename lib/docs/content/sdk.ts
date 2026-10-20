import type { DocPage } from '../types';

export const sdk: DocPage = {
    slug: 'sdk',
    title: 'JavaScript SDK',
    description: 'Install the browser SDK, the full API, single-page apps and how to avoid flicker.',
    group: 'Guides',
    blocks: [
        { type: 'p', text: 'The SDK is a single dependency-free script, `sdk.js`, served by freeabtest.com. The shipped file is about 100 KB raw and under 30 KB gzipped. It exposes one global object, `window.ABTest`.' },
        { type: 'h2', text: 'Install' },
        { type: 'p', text: 'When you are signed in, Overview, Domains, and each experiment Setup tab show a pre-filled snippet with your public SDK key and `https://www.freeabtest.com`. Copy it as-is. Use the Production / Development toggle to swap keys; you do not paste a key yourself.' },
        { type: 'code', label: 'HTML', code: `<script src="https://www.freeabtest.com/sdk.js" data-key="cro_pk_prod_..." async></script>` },
        { type: 'p', text: 'Put the same tag on the control page and every variation page. The SDK reads the key from `data-key`, matches a running test by the current URL, and handles bucketing, redirects and click goals automatically.' },
        { type: 'callout', tone: 'later', title: 'Coming later', text: 'An npm package for the browser SDK is planned. Today, load the script tag as shown. To run tests from your backend, see [Server-side testing](/docs/server-side).' },
        { type: 'h2', text: 'What the snippet does on its own', id: 'automatic' },
        { type: 'p', text: 'With `data-key` on the script tag, the SDK starts as soon as it loads. You do not call anything for a standard test:' },
        { type: 'list', items: [
            'It matches the current URL to a running test and puts the visitor in a variation. The visitor keeps that variation on every visit.',
            'For a split URL test, it sends visitors in a variation with its own URL to that page.',
            'For a visual editor variation, it applies the changes before the page shows.',
            'It records the visit and counts click, form submit and page visit goals.',
            'It hides the page for at most 0.8 seconds while it decides, so visitors do not see the original flash first.',
        ] },
        { type: 'h2', text: 'track(eventName, options)', id: 'track' },
        { type: 'p', text: 'On paid plans, counts a custom event goal, such as a signup or purchase that happens in your own code. On the free plan it is refused with `403`. It counts for every running test that has an event goal with this name, once per visitor. On paid plans, pass `revenue` to record the order value (see [Revenue goals](/docs/goals#revenue)).' },
        { type: 'code', label: 'JavaScript', code: `ABTest.track('signup');
ABTest.track('purchase', { revenue: 49.99 });` },
        { type: 'h2', text: 'trackConversion(experimentId, eventName)', id: 'track-conversion' },
        { type: 'p', text: 'Paid plans. Records a conversion for one test, for the variation the visitor sees on this page. `eventName` is an optional label such as `signup`. It sends nothing if the visitor is not in that test on the current page. For most sites, an event goal with `ABTest.track` is simpler, because it also works on a thank-you page.' },
        { type: 'code', label: 'JavaScript', code: `ABTest.trackConversion('exp_123', 'signup');` },
        { type: 'h2', text: 'bootstrap()', id: 'bootstrap' },
        { type: 'p', text: 'Runs the same check the snippet runs on load and returns a promise with the reply. Use it when your own code needs to know the variation, or after a route change in a single-page app. Each call makes one request.' },
        { type: 'code', label: 'Reply when the visitor is in a test', code: `{
  "matched": true,
  "action": "stay",            // "redirect" when the SDK is sending the visitor to a variation URL
  "experiment_id": "exp_123",
  "variation_id": "var_456",
  "variation_name": "Variant B",
  "is_control": false
}` },
        { type: 'p', text: 'When no running test matches the page, or the visitor is not in it, `matched` is `false`. Network errors also resolve to `{ matched: false }`, so your page always falls back to the original.' },
        { type: 'code', label: 'JavaScript', code: `ABTest.bootstrap().then(function (r) {
  if (r.matched && r.variation_name === 'Variant B') {
    document.body.classList.add('variant-b');
  }
});` },
        { type: 'h2', text: 'init(options)', id: 'init' },
        { type: 'p', text: 'Only needed when you load `sdk.js` without `data-key`, for example in a test harness. It stores the settings and makes no request; call `bootstrap()` afterwards.' },
        { type: 'table', head: ['Option', 'Description'], rows: [
            ['`apiUrl`', 'The base URL, with no trailing slash. Defaults to the host that served `sdk.js`.'],
            ['`apiKey`', 'An SDK key (`cro_pk_<env>_...`). The key decides which project and environment the data goes to.'],
            ['`userId`', 'Your own stable visitor ID, such as a logged-in user ID. If omitted, the SDK generates one and keeps it in localStorage under `ab_user_id`.'],
        ] },
        { type: 'h3', text: 'Visitor IDs' },
        { type: 'p', text: 'Generated IDs look like `user_1728912345678_k3j9x0abc`. They live in localStorage, so they survive reloads but not a different browser, device or cleared storage. Pass `userId` to `init` if you want the same person to see the same variation across devices.' },
        { type: 'h2', text: 'getUserId()', id: 'get-user-id' },
        { type: 'p', text: 'Returns the visitor ID the SDK is using. Handy for debugging and for joining with your own analytics.' },
        { type: 'h2', text: 'Google Analytics 4', id: 'ga4' },
        { type: 'p', text: 'On every plan, when a visitor sees a version of a running test, the snippet tells Google Analytics 4 once per page. With gtag.js on the page it sends a GA4 `experience_impression` event. With Google Tag Manager it pushes the same event to `dataLayer`, so you can forward it with a GA4 event tag. If neither is on the page, nothing is sent.' },
        { type: 'table', head: ['Parameter', 'Example'], rows: [
            ['`exp_variant_string`', '`FABT-exp_123-var_456`'],
            ['`experiment_id`', '`exp_123`'],
            ['`variation_id`', '`var_456`'],
            ['`variation_name`', '`Annual first`'],
            ['`is_control`', '`false`'],
        ] },
        { type: 'p', text: 'To compare versions in GA4, register `variation_name` (or `exp_variant_string`) as an event-scoped custom dimension. Test names are not sent, so internal names stay private. To turn this off, add `data-analytics="off"` to the script tag.' },
        { type: 'h3', text: 'A GA4 audience for each version', id: 'ga4-audience' },
        { type: 'p', text: 'To follow people who saw one version through the rest of GA4 (or use them in Google Ads), build an audience from the event:' },
        { type: 'steps', items: [
            { title: 'Register the dimension', text: 'In GA4, open **Admin**, **Custom definitions** and create an event-scoped custom dimension for `exp_variant_string`.' },
            { title: 'Create the audience', text: 'Open **Admin**, **Audiences**, **New audience**, **Create a custom audience**. Add the condition: event `experience_impression` where `exp_variant_string` exactly matches the value for the version, such as `FABT-exp_123-var_456`. The test id is in the address of the test in the dashboard, and the version ids are in the results CSV (see [Downloading results](/docs/results#export)).' },
            { title: 'Repeat per version', text: 'Make one audience per version, including the control, so you can compare them.' },
        ] },
        { type: 'p', text: 'Audiences only fill from the day you create them, so set them up before or right when the test starts.' },
        { type: 'h2', text: 'Single-page apps', id: 'spa' },
        { type: 'p', text: 'The snippet checks the page once, when it loads. If your app changes the URL without a full page load, call `ABTest.bootstrap()` after the route change so a test on the new URL runs. Visitors keep their variation.' },
        { type: 'code', label: 'React', code: `useEffect(() => {
  window.ABTest?.bootstrap();
}, [pathname]);` },
        { type: 'h2', text: 'Avoiding flicker', id: 'flicker' },
        { type: 'p', text: 'The SDK hides the page until it knows the variation, for at most 0.8 seconds. To keep that short:' },
        { type: 'list', items: [
            'Put the script tag in the `<head>`, not at the end of the body.',
            'Prefer changes that do not shift layout, such as text and color.',
        ] },
        { type: 'h2', text: 'Rate limits and errors', id: 'errors' },
        { type: 'p', text: 'Requests are limited per SDK key and client IP. SDK calls catch their own errors and log them to the console with an `[ABTest]` prefix, so a failure never breaks your page.' },
    ],
};
