import type { DocPage } from '../types';

export const sdk: DocPage = {
    slug: 'sdk',
    title: 'JavaScript SDK',
    description: 'Install the browser SDK, the full API, single-page apps and how to avoid flicker.',
    group: 'Guides',
    blocks: [
        { type: 'p', text: 'The SDK is a single dependency-free script, `sdk.js`, served by freeabtest.com. It is about 7.5 KB raw and about 2 KB gzipped. It exposes one global object, `window.ABTest`.' },
        { type: 'h2', text: 'Install' },
        { type: 'code', label: 'HTML', code: `<script src="https://YOUR-HOST/sdk.js"></script>
<script>
  ABTest.init({
    apiUrl: 'https://YOUR-HOST',
    apiKey: 'cro_pk_prod_...',
    userId: undefined // optional, see below
  });
</script>` },
        { type: 'callout', tone: 'later', title: 'Coming later', text: 'An npm package, React and Next.js helpers and server SDKs are planned for Phase 2. Today, load the script tag as shown.' },
        { type: 'h2', text: 'init(options)', id: 'init' },
        { type: 'p', text: 'Call once per page before anything else. It stores the configuration and makes no network request.' },
        { type: 'table', head: ['Option', 'Required', 'Description'], rows: [
            ['`apiUrl`', 'Yes', 'The base URL shown in your experiment\'s Setup snippet, with no trailing slash. Requests go to `apiUrl + /api/assign` and `apiUrl + /api/track`.'],
            ['`apiKey`', 'Yes', 'An SDK key (`cro_pk_<env>_...`). The key decides which project and environment the data goes to.'],
            ['`userId`', 'No', 'Your own stable visitor ID, such as a logged-in user ID. If omitted, the SDK generates one and keeps it in localStorage under `ab_user_id`.'],
        ] },
        { type: 'p', text: 'If `apiUrl` or `apiKey` is missing, `init` logs an error to the console and the SDK stays uninitialised.' },
        { type: 'h3', text: 'Visitor IDs' },
        { type: 'p', text: 'Generated IDs look like `user_1728912345678_k3j9x0abc`. They live in localStorage, so they survive reloads but not a different browser, device or a cleared storage. Pass `userId` if you want the same person to see the same variation across devices. IDs must be 1 to 200 printable ASCII characters with no spaces.' },
        { type: 'h2', text: 'run(experimentId, callback, options)', id: 'run' },
        { type: 'p', text: 'The main entry point. Gets the assignment, handles redirects for split URL tests, then calls your callback with the result. Returns a promise that resolves to the same object.' },
        { type: 'code', label: 'JavaScript', code: `ABTest.run('exp_123', function (variation) {
  if (!variation.assigned) return;
  if (variation.variation_name === 'Variant B') {
    document.body.classList.add('variant-b');
  }
});` },
        { type: 'p', text: 'If the assigned variation has a redirect URL and the visitor is not already on it, `run` sends the browser there and does not call the callback. Pass `{ autoRedirect: false }` as the third argument to turn that off and handle `variation.variation_url` yourself.' },
        { type: 'h2', text: 'getVariation(experimentId)', id: 'get-variation' },
        { type: 'p', text: 'Lower level than `run`. Returns a promise with the assignment and never redirects. Results are cached for the life of the page, so calling it twice makes one request.' },
        { type: 'code', label: 'Response', code: `{
  "experiment_id": "exp_123",
  "variation_id": "var_456",
  "variation_name": "Variant B",
  "variation_url": "https://example.com/pricing-b", // only for split URL tests
  "assigned": true
}` },
        { type: 'p', text: 'When the visitor is not in the experiment, `assigned` is `false` and the other fields are empty. Network errors also resolve to `{ assigned: false }`, so your page always falls back to the control.' },
        { type: 'callout', tone: 'info', text: 'The first time a visitor is assigned on a page, the SDK automatically sends a `page_view` event. That is what counts them as a visitor in the results.' },
        { type: 'h2', text: 'trackConversion(experimentId, eventName, metadata)', id: 'track-conversion' },
        { type: 'p', text: 'Records a conversion for the visitor\'s current variation. `eventName` is an optional label such as `signup`. `metadata` is an optional object, up to 4 KB as JSON.' },
        { type: 'code', label: 'JavaScript', code: `ABTest.trackConversion('exp_123', 'purchase', { plan: 'team', value: 49 });` },
        { type: 'callout', tone: 'warning', title: 'Assignment first', text: 'trackConversion uses the assignment cached on this page. If you have not called `run` or `getVariation` for this experiment on the same page load, it logs a warning and sends nothing. On a thank-you page, call `getVariation` first, then track.' },
        { type: 'code', label: 'Thank-you page', code: `ABTest.getVariation('exp_123').then(function () {
  ABTest.trackConversion('exp_123', 'purchase');
});` },
        { type: 'h2', text: 'trackEvent(experimentId, variationId, eventType, eventName, metadata)', id: 'track-event' },
        { type: 'p', text: 'The raw call behind the other two. `eventType` must be `page_view` or `conversion`. You rarely need it directly.' },
        { type: 'h2', text: 'runUrlTest(experimentId)', id: 'run-url-test' },
        { type: 'p', text: 'Shorthand for `run(experimentId, null, { autoRedirect: true })`. Use it on the original page of a split URL test.' },
        { type: 'h2', text: 'getUserId()', id: 'get-user-id' },
        { type: 'p', text: 'Returns the visitor ID the SDK is using. Handy for debugging and for joining with your own analytics.' },
        { type: 'h2', text: 'Single-page apps', id: 'spa' },
        { type: 'p', text: 'The SDK has no router integration yet. In React, Vue or similar, call `run` or `getVariation` when the relevant view mounts. Because results are cached for the page, route changes do not cause new requests, and the visitor keeps their variation.' },
        { type: 'code', label: 'React', code: `useEffect(() => {
  window.ABTest.getVariation('exp_123').then((v) => {
    setHeadline(v.assigned && v.variation_name === 'Variant B' ? 'New headline' : 'Old headline');
  });
}, []);` },
        { type: 'p', text: 'The automatic page view is sent once per experiment per page load, not on every route change. That is fine for results, which count unique visitors.' },
        { type: 'h2', text: 'Avoiding flicker', id: 'flicker' },
        { type: 'p', text: 'Today the SDK makes one network request per experiment before it knows the variation. If the original content renders first, visitors may briefly see it change. To reduce this:' },
        { type: 'list', items: [
            'Load `sdk.js` and call `run` in the `<head>`, not at the end of the body.',
            'Hide only the element under test until the callback runs, with a short timeout so the page never stays hidden.',
            'Prefer changes that do not shift layout, such as text and colour.',
        ] },
        { type: 'code', label: 'Anti-flicker pattern', code: `<style>.ab-hide { opacity: 0 !important; }</style>
<h1 class="ab-hide">Original headline</h1>
<script>
  var h1 = document.querySelector('h1');
  var reveal = function () { h1.classList.remove('ab-hide'); };
  setTimeout(reveal, 800); // never hide for long
  ABTest.run('exp_123', function (v) {
    if (v.assigned && v.variation_name === 'Variant B') h1.textContent = 'New headline';
    reveal();
  });
</script>` },
        { type: 'callout', tone: 'later', title: 'Coming later', text: 'Phase 1 adds a flicker-free snippet that downloads the experiment config once and buckets visitors locally, with no request per visitor.' },
        { type: 'h2', text: 'Rate limits and errors', id: 'errors' },
        { type: 'p', text: 'Requests are limited per SDK key and client IP. All SDK methods catch errors and log them to the console with an `[ABTest]` prefix, so a failure never breaks your page.' },
    ],
};
