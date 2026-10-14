import type { DocPage } from '../types';

export const goals: DocPage = {
    slug: 'goals',
    title: 'Goals and conversions',
    description: 'How page views and conversions are tracked and counted, and how to track common goals.',
    group: 'Guides',
    blocks: [
        { type: 'p', text: 'Today every experiment has one implicit goal: a conversion. You decide what counts as a conversion by calling `ABTest.trackConversion` at the right moment.' },
        { type: 'h2', text: 'How events are counted' },
        { type: 'table', head: ['Metric', 'How it is counted'], rows: [
            ['Visitors', 'Unique visitor IDs with any event for the variation. The automatic `page_view` sent after assignment is what puts most visitors here.'],
            ['Conversions', 'Unique visitor IDs with at least one `conversion` event for the variation.'],
            ['Conversion rate', 'Conversions divided by visitors.'],
        ] },
        { type: 'callout', tone: 'info', title: 'Unique, not total', text: 'A visitor who converts five times counts as one conversion. Results measure how many people converted, not how many times.' },
        { type: 'h2', text: 'Event names and metadata' },
        { type: 'p', text: 'The event name (for example `signup`) and metadata are stored with each event but are not yet used to split results. Every conversion event for an experiment counts toward the same goal, whatever its name. Use one experiment per goal for now, and keep names consistent so they are ready for per-goal reporting.' },
        { type: 'h2', text: 'Common goals' },
        { type: 'h3', text: 'Button click' },
        { type: 'code', label: 'JavaScript', code: `document.querySelector('#buy').addEventListener('click', function () {
  ABTest.trackConversion('exp_123', 'buy_click');
});` },
        { type: 'h3', text: 'Form submit' },
        { type: 'code', label: 'JavaScript', code: `document.querySelector('form#signup').addEventListener('submit', function () {
  ABTest.trackConversion('exp_123', 'signup');
});` },
        { type: 'p', text: 'If the form navigates away immediately, the request may be cut off. Tracking on the confirmation page is more reliable.' },
        { type: 'h3', text: 'Reaching a page' },
        { type: 'code', label: 'Thank-you page', code: `ABTest.getVariation('exp_123').then(function (v) {
  if (v.assigned) ABTest.trackConversion('exp_123', 'purchase', { order_value: 49 });
});` },
        { type: 'p', text: 'This works because the visitor already has an assignment on the server. `getVariation` returns the same variation without creating a new one.' },
        { type: 'h3', text: 'From your server' },
        { type: 'p', text: 'You can send the same event from a backend with `POST /api/track` and an SDK key, as long as you know the visitor ID and variation ID. See the [REST API](/docs/rest-api#track).' },
        { type: 'callout', tone: 'later', title: 'Coming later', text: 'Phase 1 adds named goals defined in the dashboard (click, form, page visit, custom), multiple goals per experiment, a primary metric and revenue metrics.' },
    ],
};
