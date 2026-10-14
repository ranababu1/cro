import type { DocPage } from '../types';

export const quickStart: DocPage = {
    slug: 'quick-start',
    title: 'Quick start',
    description: 'From sign in to a running experiment with real results, step by step.',
    group: 'Getting started',
    blocks: [
        { type: 'p', text: 'This guide runs a simple headline test on one page. You need a page you can edit and about fifteen minutes.' },
        { type: 'h2', text: '1. Sign in and get a workspace', id: 'workspace' },
        { type: 'p', text: 'Go to [Sign in](/signin) and continue with Google. The first time you sign in, an organization, a project called **Default project** and the three environments (Development, Staging, Production) are created for you. You land on the Overview page.' },
        { type: 'h2', text: '2. Create an SDK key', id: 'api-key' },
        { type: 'p', text: 'Open **API keys** in the sidebar. Each environment has its own section. In the **Development** section, choose **New SDK key**. Start with Development while you set things up.' },
        { type: 'callout', tone: 'warning', title: 'Copy the key now', text: 'The full key is shown once. Only a hash is stored, so it cannot be shown again. If you lose it, revoke it and create a new one.' },
        { type: 'p', text: 'SDK keys look like `cro_pk_dev_` followed by 32 characters. They are safe to put in page source. Never put a secret key (`cro_sk_...`) in a browser.' },
        { type: 'h2', text: '3. Add the SDK to your page', id: 'install' },
        { type: 'p', text: 'Add the script tag and call `ABTest.init` once per page, as early as you can (in the `<head>` is best). Replace the host with the address of your freeabtest.com instance.' },
        { type: 'code', label: 'HTML', code: `<script src="https://YOUR-HOST/sdk.js"></script>
<script>
  ABTest.init({
    apiUrl: 'https://YOUR-HOST',
    apiKey: 'cro_pk_dev_...'
  });
</script>` },
        { type: 'h2', text: '4. Create the experiment', id: 'create' },
        { type: 'p', text: 'Open **Experiments** and choose **New experiment**. Give it a name your team will recognise, such as "Pricing page headline", and write the hypothesis: what you are changing and what you expect to happen.' },
        { type: 'h2', text: '5. Set up variations and weights', id: 'variations' },
        { type: 'p', text: 'The form starts with two variations, **Control** and **Variant B**, split 50/50. Rename them so the names mean something, for example "Original" and "Benefit headline". Use **Add variation** for an A/B/n test. Your code will check the name, so keep it short.' },
        { type: 'list', items: [
            'Exactly one variation is the control.',
            'Weights must add up to 100. 50/50 is the default and the fastest way to a result.',
            'Leave **Redirect URL** empty for this test. It is only for [split URL tests](/docs/variations#split-url-tests).',
            'Traffic allocation controls what share of visitors enter the experiment at all. Leave it at 100%.',
        ] },
        { type: 'p', text: 'Save. The experiment is created as a **Draft** and is not live yet.' },
        { type: 'h2', text: '6. Apply the variation in your code', id: 'apply' },
        { type: 'p', text: 'Copy the experiment ID from the **Setup** tab (it starts with `exp_`). Use `ABTest.run` to get the variation and change the page.' },
        { type: 'code', label: 'HTML', code: `<script>
  ABTest.run('exp_YOUR_ID', function (variation) {
    if (!variation.assigned) return; // not running, or visitor not in traffic
    if (variation.variation_name === 'Benefit headline') {
      document.querySelector('h1').textContent = 'Plans that grow with your team';
    }
  });
</script>` },
        { type: 'h2', text: '7. Start the experiment', id: 'start' },
        { type: 'p', text: 'Back in the dashboard, open the experiment and choose **Start experiment**. The status changes to **Running** and new visitors start getting assigned.' },
        { type: 'h2', text: '8. Verify it works', id: 'verify' },
        { type: 'list', ordered: true, items: [
            'Open your page in a normal browser window. Open the developer console and run `ABTest.getUserId()` to see your visitor ID.',
            'In the Network tab you should see a `POST /api/assign` with a 200 response containing `"assigned": true`, then a `POST /api/track` with a 201 response (the page view).',
            'Open the page in a private window to get a new visitor ID. You may land in the other variation. Repeat a few times.',
            'Open the experiment\'s **Results** tab. Visitor counts go up as page views come in.',
        ] },
        { type: 'callout', tone: 'info', text: 'If `assigned` is `false`, the experiment is not running, or traffic allocation is below 100% and this visitor fell outside it. See [Troubleshooting](/docs/troubleshooting).' },
        { type: 'h2', text: '9. Track conversions', id: 'conversions' },
        { type: 'p', text: 'Call `trackConversion` when the visitor reaches your goal. It must run on a page where `run` or `getVariation` has already been called for the same experiment, because it reuses that assignment.' },
        { type: 'code', label: 'JavaScript', code: `document.querySelector('#start-trial').addEventListener('click', function () {
  ABTest.trackConversion('exp_YOUR_ID', 'start_trial');
});` },
        { type: 'h2', text: '10. Switch to production', id: 'production' },
        { type: 'p', text: 'When everything checks out, create a Production SDK key and swap it into the page. Results can be filtered by environment, so your test traffic in dev does not mix with real visitors.' },
        { type: 'h2', text: '11. Read the results', id: 'results' },
        { type: 'p', text: 'The **Results** tab shows visitors, conversions, conversion rate, lift against the control and a 95% interval for each variation. A summary at the top tells you whether the best variant is significantly different from the control. Significance is only tested once every variation has at least 100 visitors. See [Reading results](/docs/results).' },
        { type: 'h2', text: '12. Pick a winner', id: 'winner' },
        { type: 'p', text: 'When you have a clear result, choose **Complete**. Then ship the winning version in your own code and remove the experiment snippet. See [Choosing a winner](/docs/choosing-a-winner).' },
    ],
};
