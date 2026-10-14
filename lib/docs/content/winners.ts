import type { DocPage } from '../types';

export const winners: DocPage = {
    slug: 'choosing-a-winner',
    title: 'Choosing a winner',
    description: 'When to call a test, how to complete it and how to roll out the winning version.',
    group: 'Analysis',
    blocks: [
        { type: 'h2', text: 'Before you call it' },
        { type: 'list', items: [
            'You reached the sample size you planned (see [Reading results](/docs/results#sample-size)).',
            'The test ran for at least one full week.',
            'The visitor split between variations roughly matches your weights. A big mismatch usually means a bug in your snippet.',
            'Results for Production only (`GET /api/experiments/{id}/results?environment=prod`) agree with the dashboard, which combines all environments.',
        ] },
        { type: 'h2', text: 'Complete the experiment' },
        { type: 'p', text: 'Choose **Complete** on the experiment page. Completing is final: no new visitors are assigned, the SDK returns `assigned: false` to everyone, and the experiment becomes read only. Results stay available.' },
        { type: 'callout', tone: 'warning', title: 'Completing does not ship the winner', text: 'After you complete, every visitor sees whatever your page shows by default, which is usually the control. To keep the winning version, change your site.' },
        { type: 'h2', text: 'Roll out the winner' },
        { type: 'steps', items: [
            { title: 'Make the change permanent', text: 'Update your page so the winning version is the default content.' },
            { title: 'Remove the experiment code', text: 'Delete the `ABTest.run` callback for this experiment. Keep `sdk.js` and `init` if other experiments use them.' },
            { title: 'Record what you learned', text: 'Write the outcome in the experiment description, so the next test builds on it.' },
        ] },
        { type: 'h3', text: 'A gradual rollout today' },
        { type: 'p', text: 'There are no feature flags yet. If you want to keep showing the winner through the SDK for a while, leave the experiment running and keep the winning code in your callback, but remember the control share still sees the old version. Weights cannot be changed after creation, so you cannot move a running test to 100%.' },
        { type: 'callout', tone: 'later', title: 'Coming later', text: 'Feature flags with percentage rollouts are planned for Phase 2, and a one-click "ship winner" flow will build on them.' },
        { type: 'h2', text: 'When the control wins' },
        { type: 'p', text: 'Complete the experiment, remove the variant code and keep your page as it is. A losing variant is a result too: you avoided shipping a change that would have hurt.' },
    ],
};
