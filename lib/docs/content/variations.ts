import type { DocPage } from '../types';

export const variations: DocPage = {
    slug: 'variations',
    title: 'Variations',
    description: 'Controls, A/B/n tests (up to 50 variations on paid plans), weights, traffic allocation and split URL tests.',
    group: 'Guides',
    blocks: [
        { type: 'h2', text: 'The control' },
        { type: 'p', text: 'Every experiment has exactly one control: the version you have today. Lift and significance are always measured against it. On the new experiment form, choose **Make control** on any row to move it.' },
        { type: 'h2', text: 'How many variations' },
        { type: 'p', text: 'A URL split test has one control URL and one or more variation URLs. The free plan allows 1 variation (A/B only); paid plans allow up to 50. Weights must sum to 100 and default to equal shares.' },
        { type: 'callout', tone: 'info', title: 'More variations need more traffic', text: 'Each extra variation splits your visitors further, so every variation takes longer to reach a reliable sample. Two or three is usually right unless you have a lot of traffic.' },
        { type: 'h2', text: 'Weights' },
        { type: 'p', text: 'Weights decide how visitors who enter the experiment are split. They must add up to 100. Decimals are allowed. Common choices are 50/50, 34/33/33, or 90/10 when you want to limit exposure to a risky change.' },
        { type: 'h2', text: 'Traffic allocation vs weights', id: 'traffic-allocation' },
        { type: 'diagram', name: 'bucketing', caption: 'Two independent checks: one decides whether a visitor enters the experiment, the other picks the variation.' },
        { type: 'p', text: 'Traffic allocation (0 to 100%) decides whether a visitor enters the experiment at all. Weights then split the visitors who did enter. With 50% allocation and a 50/50 split, each variation gets about 25% of all visitors, and the other half see your default page without being counted.' },
        { type: 'h2', text: 'How assignment works' },
        { type: 'p', text: 'Assignment is deterministic. The visitor ID and experiment ID together always map to the same variation, in proportion to the weights. The result is stored, so later requests return the same variation even if the experiment changes. A second, separate hash decides traffic allocation, so changing allocation never reshuffles who gets which variation.' },
        { type: 'h2', text: 'Visual editor', id: 'visual-editor' },
        { type: 'p', text: 'On Growth and above, a variation can run on the control page itself instead of on its own URL. When you create the test, tick **Change the control page with the visual editor** for that variation. Then open **Edit test** and choose **Open visual editor**.' },
        { type: 'p', text: 'Your page opens in a new tab with the editor panel. Click any element to change it, choose **Apply**, and **Save** when you are done. The link from the dashboard works for 2 hours and only for that variation, on your registered domains.' },
        { type: 'list', items: [
            '**Text.** Replace the words of a heading, paragraph, button or link.',
            '**Colors and size.** Text color, background and font size.',
            '**Links and images.** A new link address, image address or image description.',
            '**Hide.** Remove an element, such as a banner, for visitors in this variation.',
        ] },
        { type: 'p', text: 'Visitors in the variation get the changes before the page shows, with the same flicker protection as redirects. A variation holds up to 50 changes. You can also add, check or remove changes by hand on **Edit test**, each with its CSS selector. Changes are plain text and styles, so the editor cannot add scripts or HTML to your site.' },
        { type: 'callout', tone: 'info', title: 'Elements that load later', text: 'Changes also apply to elements that appear while the page loads. Content that appears long after load, for example after a click, may not change. Pick elements that are on the page from the start.' },
        { type: 'h2', text: 'Auto-shift traffic to the winner', id: 'auto-shift' },
        { type: 'p', text: 'On the Growth plan and above, turn on **Auto-shift traffic to the winner** in the **Edit test** tab. About once an hour while the test gets traffic, the split is recalculated so more new visitors see the version most likely to win on the primary goal. This method is often called a multi-armed bandit, using Thompson sampling.' },
        { type: 'list', items: [
            'The split starts to move once every active version has 100 visitors.',
            'Every active version keeps at least 10% of new visitors (less when there are more than 5 versions), so the numbers keep improving.',
            'Visitors already in the test keep their version. Paused versions stay paused.',
            'Turning it off keeps the current split. You can then edit the weights again.',
        ] },
        { type: 'callout', tone: 'info', title: 'When to use it', text: 'Use auto-shift when you want to earn from the best version while the test runs, for example a short promotion. For the clearest answer to which version is better, keep a fixed split. Because the split changes over time, treat the significance test as a guide, and the visitor split warning is turned off while auto-shift is on.' },
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
