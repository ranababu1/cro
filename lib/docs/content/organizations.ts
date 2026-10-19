import type { DocPage } from '../types';

export const organizations: DocPage = {
    slug: 'organizations-and-projects',
    title: 'Organizations and projects',
    description: 'How your organization, projects, team, plan limits and account status work.',
    group: 'Reference',
    blocks: [
        { type: 'h2', text: 'Your organization' },
        { type: 'p', text: 'When you first sign in, you get an organization named after you, where you are the **owner**. Plans and monthly limits apply to the whole organization.' },
        { type: 'h2', text: 'Projects' },
        { type: 'p', text: 'Your organization starts with one project called **Default project**, with Development, Staging and Production environments. The project switcher in the top bar picks which project the dashboard shows and where new experiments are created. API keys belong to one project and environment.' },
        { type: 'p', text: 'Owners add projects under **Team and projects** in the sidebar, up to the plan limit: 1 on Free, 3 on Starter, 10 on Growth, and a custom number on Enterprise. Each new project gets its own Development, Staging and Production environments with an SDK key ready to install, and its own domains and tests. Owners can rename projects.' },
        { type: 'h2', text: 'Team', id: 'team' },
        { type: 'p', text: 'Owners invite people from **Team and projects**: pick **Member** or **Owner**, choose **Create invite link**, and send the link yourself, for example in chat. No email is sent. Each link works once, for 7 days, and is shown only when you create it. The person opens it, signs in with Google and joins. Owners can cancel an open invite at any time.' },
        { type: 'table', head: ['Role', 'Can do'], rows: [
            ['Owner', 'Everything a member can, plus invite people, change roles, remove members, and add or rename projects.'],
            ['Member', 'See and change every project, test, popup, survey, domain and key in the organization. Leave the organization.'],
        ] },
        { type: 'p', text: 'Seats: 1 on Free, 5 on Starter, 15 on Growth and unlimited on Enterprise. Members and open invites both use a seat. Every organization keeps at least one owner. Someone who is removed loses access at once. People who join keep their own organization too, and the project switcher shows both.' },
        { type: 'callout', tone: 'later', title: 'Coming later', text: 'More roles, such as read-only, and single sign-on are planned.' },
        { type: 'h2', text: 'Plan limits', id: 'limits' },
        { type: 'table', head: ['Limit', 'What happens when you reach it'], rows: [
            ['Tested visitors per month (and per day on Free)', 'New visitors are not enrolled (`assigned: false`, reason `quota_exceeded`) and see your default page. Visitors already in an experiment keep their variation.'],
            ['Running tests at a time, and tests over the life of a Free account', 'Starting another test returns `403` with the reason. Pause or complete a running test first.'],
            ['Experiment starts per month, when your plan has one', 'Starting a new experiment returns `403`. Resuming a paused one is not a new start.'],
            ['Projects and team seats', 'Adding a project or creating an invite returns `403` with an upgrade note. Existing projects and members are kept after a downgrade.'],
        ] },
        { type: 'p', text: 'Monthly limits reset at the start of each calendar month (UTC). Contact support to change your plan.' },
        { type: 'h2', text: 'Audit log', id: 'audit-log' },
        { type: 'p', text: 'On paid plans, **Audit log** in the sidebar lists who changed what in your organization: tests, goals, funnels, traffic splits, visual changes, surveys, popups, domains, API keys and share links, newest first. Filter by type, and choose **Show older entries** to page back. The log is read-only; nobody in your organization can edit or delete entries.' },
        { type: 'p', text: 'Changes made with a secret API key show **API**, traffic splits changed by auto-shift show **Auto**, and plan or account changes made by our team show **Support** without the internal notes.' },
        { type: 'table', head: ['Plan', 'Entries kept'], rows: [['Free', 'Not shown'], ['Starter', '90 days'], ['Growth', '1 year'], ['Enterprise', '2 years']] },
        { type: 'p', text: 'Older entries are deleted automatically. On Free, entries are kept for 30 days but not shown, so after an upgrade you see the last 30 days.' },
        { type: 'h2', text: 'Account status', id: 'suspension' },
        { type: 'p', text: 'If an account is suspended, SDK keys, secret keys and the dashboard return `403 This account is suspended`, and your sites fall back to their default content. Your data is kept. Contact support to restore access.' },
    ],
};
