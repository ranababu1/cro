import type { DocPage } from '../types';

export const popups: DocPage = {
    slug: 'popups',
    title: 'Popups and calls to action',
    description: 'Show a message with one button on the pages you choose, and see how many visitors click. Paid plans.',
    group: 'Guides',
    blocks: [
        { type: 'p', text: 'A popup is a short message with a title, optional text and one button: a discount, a newsletter signup or an announcement. It runs through the install snippet you already have, so there is nothing new to add to your site. Popups are part of the paid plans.' },
        { type: 'callout', tone: 'info', title: 'Loaded only where needed', text: 'The snippet loads the popup script only on pages where an active popup matches. Other pages load nothing extra.' },
        { type: 'h2', text: 'Create a popup' },
        { type: 'steps', items: [
            { title: 'Open Popups', text: 'Choose **Popups** in the sidebar, then **New popup**. Popups belong to the project selected at the top.' },
            { title: 'Write the message', text: 'Add a title, optional text, the button text and the button link. The link can be a full address, a path such as `/pricing`, a `#section`, `mailto:` or `tel:`.' },
            { title: 'Choose where and when', text: 'Pick the place on the page, the trigger, how often it shows, the devices and the pages. The preview updates as you type.' },
            { title: 'Turn it on', text: 'New popups start as drafts. Choose **Turn on** in the list. Your site picks up the change within a minute.' },
        ] },
        { type: 'h2', text: 'Options' },
        { type: 'table', head: ['Option', 'Choices'], rows: [
            ['Where on the page', 'Center of the page (with a dimmed background), bottom right or bottom left corner, or a bar at the top or bottom'],
            ['When it shows', 'After a number of seconds, after scrolling a percent of the page, or when the visitor is about to leave'],
            ['How often', 'Once per visitor, once per visit, or on every page view'],
            ['Devices', 'All devices, computers only or phones only'],
            ['Pages', 'All pages, or pages whose address is, contains or starts with what you enter'],
        ] },
        { type: 'p', text: 'Leaving intent uses the mouse moving out through the top of the window, so it shows on computers only. A visitor sees at most one popup or survey per page view. Visitors close a popup with the close button, the Escape key, or a click outside a centered popup.' },
        { type: 'h3', text: 'Matching pages' },
        { type: 'p', text: 'A path such as `/pricing` matches that path on any of your domains. A full address such as `https://shop.example.com/pricing` also checks the domain. Query strings and a trailing slash are ignored.' },
        { type: 'h2', text: 'Numbers' },
        { type: 'p', text: 'The list shows views, button clicks and the click rate (clicks divided by views) for the last 30 days. Counts are daily totals per popup: no visitor IDs, page content or field values are stored.' },
        { type: 'h2', text: 'Content and styling' },
        { type: 'p', text: 'Popup text is shown as plain text, never as HTML. Popups render in an isolated layer, so your site styles do not change them and they do not change your site. The button uses the color you choose.' },
        { type: 'p', text: 'A project can have up to 20 popups. Deleting a popup removes its numbers too.' },
        { type: 'callout', tone: 'warning', title: 'After a downgrade', text: 'On the free plan, popups stop showing and the Popups page asks you to upgrade. Your popups are kept, and show again when you upgrade.' },
    ],
};
