import type { DocPage } from '../types';

export const environments: DocPage = {
    slug: 'environments-and-keys',
    title: 'Environments and API keys',
    description: 'Keep test traffic out of production data, and manage SDK and secret keys safely.',
    group: 'Reference',
    blocks: [
        { type: 'h2', text: 'Environments' },
        { type: 'p', text: 'Every project has three environments: **Development** (`dev`), **Staging** (`staging`) and **Production** (`prod`). Experiments belong to the project and are shared by all three. Assignments and events are tagged with the environment of the key that sent them.' },
        { type: 'p', text: 'This lets you point your local and staging sites at the same experiment as production without polluting real results: use a dev key locally, a staging key on staging and a prod key on the live site. Filter results with `?environment=prod` on the results API.' },
        { type: 'callout', tone: 'info', text: 'A visitor assigned in one environment keeps that variation in the others, because assignment is per experiment and visitor ID.' },
        { type: 'h2', text: 'Key types' },
        { type: 'table', head: ['', 'SDK key', 'Secret key'], rows: [
            ['Format', '`cro_pk_<env>_` plus 32 characters', '`cro_sk_<env>_` plus 32 characters'],
            ['Where', 'Browsers, page source', 'Servers only'],
            ['Can call', '`/api/assign` and `/api/track`', 'Experiment and results endpoints for its project'],
            ['Safe to expose?', 'Yes', 'No'],
        ] },
        { type: 'h2', text: 'Creating and revoking keys' },
        { type: 'p', text: 'Open **API keys** in the sidebar. Each environment has **New SDK key** and **New secret key** buttons. The full key is shown once, right after you create it. It is not stored in readable form, so nobody can see it again later. The list shows each key\'s prefix, creation date, last use and status.' },
        { type: 'p', text: 'Choose **Revoke** to disable a key. Anything using it gets `401` on the next request. Revoking cannot be undone.' },
        { type: 'h3', text: 'Rotating a key' },
        { type: 'list', ordered: true, items: [
            'Create a new key in the same environment.',
            'Deploy it to your site or server.',
            'Check that **Last used** updates on the new key.',
            'Revoke the old key.',
        ] },
        { type: 'callout', tone: 'warning', title: 'If a secret key leaks', text: 'Revoke it straight away, create a new one, and review recent experiment changes.' },
    ],
};
