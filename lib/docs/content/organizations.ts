import type { DocPage } from '../types';

export const organizations: DocPage = {
    slug: 'organizations-and-admin',
    title: 'Organizations and admin',
    description: 'Organizations, projects and roles, plus the platform admin console: tenants, suspension and quotas.',
    group: 'Reference',
    blocks: [
        { type: 'h2', text: 'Organizations and projects' },
        { type: 'p', text: 'When you first sign in, you get an organization named after you, where you are the **owner**, and one project called **Default project**. The project switcher in the top bar picks which project the dashboard shows and where new experiments are created.' },
        { type: 'callout', tone: 'later', title: 'Coming later', text: 'Creating more projects from the dashboard, inviting teammates, roles beyond owner and member, and SSO are planned. Today each organization has the projects created for it.' },
        { type: 'h2', text: 'Platform admin console', id: 'admin-console' },
        { type: 'p', text: 'People who run a freeabtest.com instance can manage every tenant from **/admin**. The link appears in the sidebar under **Platform** for admins only. Everyone else gets a 404.' },
        { type: 'h3', text: 'Who is an admin' },
        { type: 'p', text: 'Admins are set with the `PLATFORM_ADMIN_EMAILS` environment variable, a comma separated list of email addresses. Matching ignores case. The role is separate from organization roles. Removing an address takes effect on the next request. Leave it empty to disable the console.' },
        { type: 'code', label: '.env', code: `PLATFORM_ADMIN_EMAILS=you@example.com,ops@example.com` },
        { type: 'h3', text: 'What admins can see' },
        { type: 'p', text: 'The console lists all organizations with their plan, status and usage this month. Each tenant\'s page shows members, projects, usage against limits and the latest 50 audit log entries.' },
        { type: 'h3', text: 'Suspension', id: 'suspension' },
        { type: 'p', text: 'Suspending a tenant takes effect immediately and keeps all data:' },
        { type: 'list', items: [
            'SDK keys get `403 This account is suspended`, so the tenant\'s sites fall back to their default content.',
            'Secret keys and the dashboard are blocked the same way.',
            'The reason you enter is saved in the audit log.',
        ] },
        { type: 'p', text: 'Choose **Reactivate tenant** to restore access.' },
        { type: 'h3', text: 'Plans and quotas', id: 'quotas' },
        { type: 'table', head: ['Setting', 'Effect'], rows: [
            ['Plan', 'A free text label, for example `free` or `team`.'],
            ['Visitors per month', 'Once reached, new visitors are not enrolled (`assigned: false`, reason `quota_exceeded`). Visitors already assigned keep their variation.'],
            ['Experiment starts per month', 'Once reached, starting a new experiment returns `403`. Resuming a paused experiment is still allowed.'],
        ] },
        { type: 'p', text: 'Leave a limit blank for unlimited. Limits reset at the start of each calendar month (UTC). Every admin change is audited.' },
        { type: 'callout', tone: 'info', text: 'There is no billing system yet. Plans and limits are set by hand in the console.' },
    ],
};
