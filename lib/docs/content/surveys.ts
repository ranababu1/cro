import type { DocPage } from '../types';

export const surveys: DocPage = {
    slug: 'surveys',
    title: 'Surveys',
    description: 'Ask visitors one question on the pages you choose and see the answers. Paid plans.',
    group: 'Guides',
    blocks: [
        { type: 'p', text: 'A survey asks one question in a small box on your page: pick one answer, a rating from 1 to 5, a Net Promoter Score from 0 to 10, or a short written answer. It runs through the install snippet you already have. Surveys are part of the paid plans.' },
        { type: 'callout', tone: 'info', title: 'Loaded only where needed', text: 'The snippet loads the survey script only on pages where an active survey matches. Other pages load nothing extra.' },
        { type: 'h2', text: 'Create a survey' },
        { type: 'steps', items: [
            { title: 'Open Surveys', text: 'Choose **Surveys** in the sidebar, then **New survey**. Surveys belong to the project selected at the top.' },
            { title: 'Write the question', text: 'Start from a template or pick the answer type yourself. For a choice question add 2 to 6 answers. Choice, rating and NPS questions can add an optional comment box.' },
            { title: 'Choose where and when', text: 'Place, trigger, frequency, devices and pages work the same as for [popups](/docs/popups#options).' },
            { title: 'Turn it on', text: 'New surveys start as drafts. Choose **Turn on** in the list. Your site picks up the change within a minute.' },
        ] },
        { type: 'h2', text: 'Templates' },
        { type: 'table', head: ['Template', 'Question'], rows: [
            ['Net Promoter Score', 'How likely are you to recommend us to a friend or colleague? (0 to 10, with a reason box)'],
            ['What almost stopped you', 'Pick one answer: the price, fit, a missing feature, or nothing'],
            ['How did you hear about us', 'Pick one answer: search, a friend, social media, an ad, or other'],
            ['Was this page helpful', 'A rating from 1 to 5, with a comment box'],
            ['Open question', 'What is missing on this page? (written answer)'],
        ] },
        { type: 'h3', text: 'Net Promoter Score', id: 'nps' },
        { type: 'p', text: 'Visitors pick a score from 0 to 10. Promoters answer 9 or 10, passives 7 or 8, and detractors 0 to 6. The score is the percent of promoters minus the percent of detractors, from -100 to +100. The answers view shows the score and each group.' },
        { type: 'h2', text: 'Who sees it' },
        { type: 'list', items: [
            'A visitor who answers never sees that survey again on that browser.',
            'How often sets how often it shows to visitors who close it without answering.',
            'A visitor sees at most one popup or survey per page view.',
        ] },
        { type: 'h2', text: 'Answers' },
        { type: 'p', text: 'Choose **Answers** in the list to see the share of each answer, the average rating or the NPS, and the latest written answers or comments, for the last 7, 30 or 90 days. **Download answers (CSV)** exports every kept answer with its time in UTC and the page path.' },
        { type: 'p', text: 'Each answer stores the answer, the comment and the page path only. No visitor ID, query string or page content is stored. Do not ask visitors for personal details such as email addresses in a survey.' },
        { type: 'h3', text: 'Limits' },
        { type: 'table', head: ['Limit', 'Value'], rows: [
            ['Surveys per project', '20'],
            ['Answers kept per survey per day', '500. Answers past this still count in the answer total and rate.'],
            ['Written answer or comment', '1,000 characters'],
        ] },
        { type: 'callout', tone: 'warning', title: 'After a downgrade', text: 'On the free plan, surveys stop showing and the Surveys page asks you to upgrade. Your surveys and answers are kept, and surveys show again when you upgrade.' },
    ],
};
