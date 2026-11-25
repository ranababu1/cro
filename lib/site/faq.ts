/**
 * Product FAQ for /faq. Answers come from the homepage FAQ and the docs so wording stays in one place.
 * Billing and plan questions live on /pricing#faq only; tests/resourcesPages.test.ts checks that no
 * question appears on both pages.
 */
import { HOME_FAQ } from './home';

export type FaqItem = { q: string; a: string; href?: string; link?: string };

const home = (q: string): FaqItem => {
    const f = HOME_FAQ.find((x) => x.q === q);
    if (!f) throw new Error(`HOME_FAQ has no "${q}"`);
    return f;
};

export const FAQ_GROUPS: { id: string; title: string; items: FaqItem[] }[] = [
    {
        id: 'getting-started', title: 'Getting started', items: [
            home('What is A/B testing?'),
            home('How does FreeABTest work?'),
            home('Do I need coding knowledge?'),
            { q: 'What do I need to install?', a: 'A small JavaScript snippet, under 30 KB gzipped. It works on any site, including through Google Tag Manager or WordPress. Paid plans also get a WordPress plugin that adds it for you.', href: '/docs/install-guides', link: 'Install guides' },
            { q: 'Will it slow my site down?', a: 'The script is under 30 KB gzipped and loads asynchronously. It makes one small request on page load. A paid feature adds one more small script only on pages where it applies, such as a heatmap, popup, survey or visual change.', href: '/docs/javascript-sdk#flicker', link: 'Avoiding flicker' },
            { q: 'Can I test on a development or staging site?', a: 'Yes. Every project has Development, Staging and Production environments, each with its own keys. Use a development key locally and a staging key on staging; their visitors and events are kept out of production results.', href: '/docs/environments-and-keys', link: 'Environments and keys' },
        ],
    },
    {
        id: 'running-tests', title: 'Running tests', items: [
            { q: 'What kinds of tests can I run?', a: 'A/B tests and split URL tests on every plan, with a control and 1 variation on Free and up to 50 variations on paid plans. Growth and above add the visual editor, multi-page tests and multivariate tests. Server-side tests work on every plan.', href: '/features', link: 'All features' },
            home('How does visitor assignment work?'),
            { q: 'Can I change a test after it starts?', a: 'You can change the traffic split, pause a variation, change who can enter and add goals from the Edit test tab. Those changes apply to new visitors only. Variation URLs cannot change and variations cannot be added or removed, so results stay valid.', href: '/docs/experiments', link: 'Managing experiments' },
            { q: 'What happens when I find a winner?', a: 'On the Results tab, Roll out a version sends one version to every visitor with one click while you put the change in your site\'s code. Nothing is counted during a rollout. When the change is live, stop the rollout.', href: '/docs/choosing-a-winner#rollout', link: 'Choosing a winner' },
        ],
    },
    {
        id: 'results', title: 'Results and statistics', items: [
            home('How is statistical significance calculated?'),
            { q: 'What does chance to beat control mean?', a: 'It is the probability that a version\'s true conversion rate is higher than the control\'s, worked out from a Beta model of each rate. It shows the direction a test is leaning. The verdict itself comes from the sequential test, which stays valid however often you check.', href: '/statistical-methodology#chance', link: 'Chance to beat control' },
            { q: 'How long should a test run?', a: 'Until the verdict is significant, and for at least one full week so weekday and weekend visitors are both included. The test planner estimates the visitors you need from your conversion rate and the lift you want to detect.', href: '/blog/how-long-to-run-an-ab-test', link: 'How long to run a test' },
            { q: 'What if a test has no winner?', a: 'Many tests end without a significant result. The change did not make a big difference, so ship whichever version is simpler or cheaper and test a bolder idea. Do not keep a test running hoping it will flip.', href: '/docs/results#inconclusive', link: 'Inconclusive results' },
            { q: 'Why does the results page say visitors are not split as expected?', a: 'The number of visitors in each version is far from your traffic split, and a gap that large is very unlikely by chance. A redirect that drops visitors, a broken variation page or a missing snippet is the usual cause. Fix it before trusting the results.', href: '/docs/results#srm', link: 'Sample ratio check' },
        ],
    },
    {
        id: 'developers', title: 'Developers', items: [
            home('How do I integrate the JavaScript SDK?'),
            home('Can I use the REST API?'),
            { q: 'Can I run tests from my own server?', a: 'Yes. With a secret key your server assigns visitors and sends page views and conversions, and the results appear on the same Results tab as browser tests. Targeting rules apply in the browser only, so on the server you decide who enters.', href: '/docs/server-side', link: 'Server-side testing' },
            { q: 'Is there a WordPress plugin, GA4 integration or React package?', a: 'Paid plans get a WordPress plugin. On every plan the snippet sends a GA4 event for each test version a visitor sees. A React package is not available yet; the script tag works in any app.', href: '/docs/integrations', link: 'Integrations' },
        ],
    },
    {
        id: 'privacy', title: 'Privacy and data', items: [
            { q: 'Does it work with a consent banner?', a: 'Yes. Add data-consent="required" to the script tag and nothing is stored or sent until your banner calls ABTest.consent(true). ABTest.optOut() keeps a browser out of every test until ABTest.optIn() is called.', href: '/docs/javascript-sdk#consent', link: 'Consent and opt-out' },
            { q: 'How are visitors identified?', a: 'The snippet generates a visitor ID and keeps it in the browser\'s local storage, so a different browser or device counts as a new visitor. For signed-in users you can pass your own user ID so a person sees the same version everywhere.', href: '/docs/javascript-sdk#init', link: 'Visitor IDs' },
            { q: 'Who can see my test data?', a: 'Each organization\'s data is kept separate, and each environment\'s results are kept apart. Share links show names and numbers only, and stop working as soon as you turn them off.', href: '/security', link: 'Security' },
        ],
    },
];

/** Billing questions answered on /pricing#faq. Listed on /faq as links, never repeated. */
export const BILLING_QUESTIONS = [
    'Is the free plan actually free?',
    'What counts as a tested visitor?',
    'What happens when I hit a limit?',
    'How many tests can I run on the free plan?',
    'Can I change or cancel my plan?',
    'Is there an annual discount?',
    'Do you charge per seat?',
    'What data do you delete, and when?',
    'Are the coming soon features included in my price?',
    'Who should talk to you about Enterprise?',
];

export const allFaqItems = () => FAQ_GROUPS.flatMap((g) => g.items);
