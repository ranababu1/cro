import type { DocPage } from '../types';

export const variations: DocPage = {
    slug: 'variations',
    title: 'Variations',
    description: 'Controls, A/B/n tests with up to 26 variations, weights, traffic allocation and split URL tests.',
    group: 'Guides',
    blocks: [
        { type: 'h2', text: 'The control' },
        { type: 'p', text: 'Every experiment has exactly one control: the version you have today. Lift and significance are always measured against it. On the new experiment form, choose **Make control** on any row to move it.' },
        { type: 'h2', text: 'How many variations' },
        { type: 'p', text: 'An experiment needs at least 2 and can have up to 26 variations (the control plus 25 variants). **Add variation** names new rows Variant C, Variant D and so on, and spreads weights evenly.' },
        { type: 'callout', tone: 'info', title: 'More variations need more traffic', text: 'Each extra variation splits your visitors further, so every variation takes longer to reach a reliable sample. Two or three is usually right unless you have a lot of traffic.' },
        { type: 'h2', text: 'Weights' },
        { type: 'p', text: 'Weights decide how visitors who enter the experiment are split. They must add up to 100. Decimals are allowed. Common choices are 50/50, 34/33/33, or 90/10 when you want to limit exposure to a risky change.' },
        { type: 'h2', text: 'Traffic allocation vs weights', id: 'traffic-allocation' },
        { type: 'diagram', name: 'bucketing', caption: 'Two independent checks: one decides whether a visitor enters the experiment, the other picks the variation.' },
        { type: 'p', text: 'Traffic allocation (0 to 100%) decides whether a visitor enters the experiment at all. Weights then split the visitors who did enter. With 50% allocation and a 50/50 split, each variation gets about 25% of all visitors, and the other half see your default page without being counted.' },
        { type: 'h2', text: 'How assignment works' },
        { type: 'p', text: 'Assignment is deterministic. The visitor ID and experiment ID together always map to the same variation, in proportion to the weights. The result is stored, so later requests return the same variation even if the experiment changes. A second, separate hash decides traffic allocation, so changing allocation never reshuffles who gets which variation.' },
        { type: 'h2', text: 'Naming variations' },
        { type: 'p', text: 'Your code usually checks `variation.variation_name`, so pick short names you will not want to rename, such as "Control" and "Annual first". You can also add a description to remind your team what changed.' },
        { type: 'h2', text: 'Split URL tests' },
        { type: 'p', text: 'Give a variation a **Redirect URL** when the change is a whole page rather than an element. On the original page, `ABTest.run` (or `runUrlTest`) sends visitors in that variation to the URL. Leave the control\'s URL empty so control visitors stay where they are.' },
        { type: 'code', label: 'Original page', code: `<script>
  ABTest.init({ apiUrl: 'https://YOUR-HOST', apiKey: 'cro_pk_prod_...' });
  ABTest.runUrlTest('exp_123');
</script>` },
        { type: 'p', text: 'The SDK skips the redirect when the visitor is already on the variation\'s URL path, so it is safe to load the same snippet on both pages.' },
        { type: 'callout', tone: 'warning', text: 'The redirect happens after the assign request returns, so visitors briefly see the original page. Load the snippet in the `<head>` to keep that short.' },
    ],
};
