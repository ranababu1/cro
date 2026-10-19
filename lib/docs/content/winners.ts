import type { DocPage } from '../types';

export const winners: DocPage = {
    slug: 'choosing-a-winner',
    title: 'Choosing a winner',
    description: 'When to call a test, how to stop it and how to roll out the winning version.',
    group: 'Analysis',
    blocks: [
        { type: 'h2', text: 'Before you call it' },
        { type: 'list', items: [
            'You reached the sample size you planned (see [Reading results](/docs/results#sample-size)).',
            'The test ran for at least one full week.',
            'The visitor split between variations roughly matches your weights. A big mismatch usually means a bug in your snippet.',
            'Results for Production only (`GET /api/experiments/{id}/results?environment=prod`) agree with the dashboard, which combines all environments.',
        ] },
        { type: 'h2', text: 'Stop the experiment', id: 'stop' },
        { type: 'p', text: 'Choose **Stop** on the experiment page. Stopping is final: no new visitors join, the test cannot be restarted and its results stay available. After you stop, every visitor sees whatever your page shows by default, which is usually the control.' },
        { type: 'h2', text: 'Roll out the winner', id: 'rollout' },
        { type: 'p', text: 'On the **Results** tab, **Roll out a version** sends one version to every visitor with one click, while you put the change in your site\'s code. The winner is selected for you when there is one, and you can pick any version, including the control. Rolling out a running or paused test stops it.' },
        { type: 'list', items: [
            'A split URL winner: visitors who open the original page or another variation are sent to the winning page.',
            'A visual editor winner: its changes are applied on the original page.',
            'The control: visitors on a variation page are sent back to the original.',
            'Targeting still applies, so only the test\'s audience gets the rolled-out version.',
            'Nothing is counted during a rollout: no visitors, events or Google Analytics impressions. Page views still count toward your plan\'s monthly page views.',
        ] },
        { type: 'p', text: 'A rollout is a bridge, not a replacement for your code. When the change is live on your site, choose **Stop rollout**, and visitors see your page as it is. Starting and stopping a rollout are recorded in the audit log on paid plans.' },
        { type: 'p', text: 'To move traffic gradually instead, you can change the traffic split on a running test from **Edit test**, up to 100% for one version. Visitors who are already in the test keep the version they saw, and they are still counted.' },
        { type: 'steps', items: [
            { title: 'Make the change permanent', text: 'Update your page so the winning version is the default content.' },
            { title: 'Stop the rollout', text: 'Once the change is live, stop the rollout so the snippet no longer changes the page.' },
            { title: 'Record what you learned', text: 'Write the outcome in the experiment description, so the next test builds on it.' },
        ] },
        { type: 'h2', text: 'When the control wins' },
        { type: 'p', text: 'Stop the experiment and keep your page as it is. A losing variant is a result too: you avoided shipping a change that would have hurt.' },
    ],
};
