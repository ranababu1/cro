import type { DocPage } from '../types';

export const goals: DocPage = {
    slug: 'goals',
    title: 'Goals and conversions',
    description: 'The four goal types, how conversions are counted, and how to track custom events.',
    group: 'Guides',
    blocks: [
        { type: 'p', text: 'A goal is what counts as a conversion. Add one or more goals in the **Goals** step when you create a test, and mark one as primary. Results show every goal separately.' },
        { type: 'h2', text: 'Goal types', id: 'types' },
        { type: 'table', head: ['Type', 'What you enter', 'Counts when'], rows: [
            ['Click', 'A CSS selector, such as `#headerCTA` or `.bodyCTA`', 'A visitor clicks the element or anything inside it.'],
            ['Form submit', 'A CSS selector for the form, such as `form#signup`', 'A visitor submits that form.'],
            ['Page visit', 'A URL, with **URL is**, **URL contains** or **URL matches regex**', 'A visitor in the test loads a matching page.'],
            ['Custom event', 'An event name, such as `signup`', 'Your page calls `ABTest.track(\'signup\')`.'],
        ] },
        { type: 'h3', text: 'Click and form goals' },
        { type: 'p', text: 'These are watched on the control and variation pages. Use selectors that exist on every version of the page.' },
        { type: 'h3', text: 'Page visit goals', id: 'page-visit' },
        { type: 'p', text: 'Use these for thank-you and confirmation pages. The page must be on a registered domain and must have the install snippet in its `<head>`. **URL is** ignores the query string, the hash and a trailing slash. **URL contains** checks the full address. **URL matches regex** is not case sensitive.' },
        { type: 'h3', text: 'Custom event goals', id: 'custom-events' },
        { type: 'p', text: 'Call `ABTest.track` from your own code when something happens that a click or page visit cannot capture, such as a completed checkout in a single-page app. The page needs the install snippet.' },
        { type: 'code', label: 'JavaScript', code: `// After a successful signup
ABTest.track('signup');` },
        { type: 'p', text: 'Event names can use letters, numbers and `_ . : -`. One event counts toward every running test that has a goal with the same name.' },
        { type: 'h2', text: 'How conversions are counted' },
        { type: 'table', head: ['Metric', 'How it is counted'], rows: [
            ['Visitors', 'Unique visitors who entered the test and saw a version.'],
            ['Conversions', 'Unique visitors who completed the goal at least once.'],
            ['Conversion rate', 'Conversions divided by visitors.'],
        ] },
        { type: 'callout', tone: 'info', title: 'Unique, not total', text: 'A visitor who completes a goal five times counts as one conversion. Only visitors who are already in the test count, so a visit from someone who never saw the control or a variation is ignored.' },
    ],
};
