import type { DocPage } from '../types';

export const organizations: DocPage = {
    slug: 'organizations-and-projects',
    title: 'Organizations and projects',
    description: 'How your account, projects, plan limits and account status work.',
    group: 'Reference',
    blocks: [
        { type: 'h2', text: 'Your organization' },
        { type: 'p', text: 'When you first sign in, you get an organization named after you, where you are the **owner**. Plans and monthly limits apply to the whole organization.' },
        { type: 'h2', text: 'Projects' },
        { type: 'p', text: 'Your organization starts with one project called **Default project**, with Development, Staging and Production environments. The project switcher in the top bar picks which project the dashboard shows and where new experiments are created. API keys belong to one project and environment.' },
        { type: 'callout', tone: 'later', title: 'Coming later', text: 'Creating more projects from the dashboard, inviting teammates, more roles and SSO are planned.' },
        { type: 'h2', text: 'Plan limits', id: 'limits' },
        { type: 'table', head: ['Limit', 'What happens when you reach it'], rows: [
            ['Visitors per month', 'New visitors are not enrolled (`assigned: false`, reason `quota_exceeded`) and see your default page. Visitors already in an experiment keep their variation.'],
            ['Experiment starts per month', 'Starting a new experiment returns `403`. Resuming a paused experiment is still allowed.'],
        ] },
        { type: 'p', text: 'Limits reset at the start of each calendar month (UTC). Contact support to change your plan.' },
        { type: 'h2', text: 'Audit log', id: 'audit-log' },
        { type: 'p', text: 'On paid plans, **Audit log** in the sidebar lists who changed what in your organization: tests, goals, funnels, traffic splits, visual changes, surveys, popups, domains, API keys and share links, newest first. Filter by type, and choose **Show older entries** to page back. The log is read-only; nobody in your organization can edit or delete entries.' },
        { type: 'p', text: 'Changes made with a secret API key show **API**, traffic splits changed by auto-shift show **Auto**, and plan or account changes made by our team show **Support** without the internal notes.' },
        { type: 'table', head: ['Plan', 'Entries kept'], rows: [['Free', 'Not shown'], ['Starter', '90 days'], ['Growth', '1 year'], ['Enterprise', '2 years']] },
        { type: 'p', text: 'Older entries are deleted automatically. On Free, entries are kept for 30 days but not shown, so after an upgrade you see the last 30 days.' },
        { type: 'h2', text: 'Account status', id: 'suspension' },
        { type: 'p', text: 'If an account is suspended, SDK keys, secret keys and the dashboard return `403 This account is suspended`, and your sites fall back to their default content. Your data is kept. Contact support to restore access.' },
    ],
};
