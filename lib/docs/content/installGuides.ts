import { INSTALL_ONCE } from '@/lib/installCopy';
import type { DocPage } from '../types';

export const installGuides: DocPage = {
    slug: 'install-guides',
    title: 'Install with Google Tag Manager or WordPress',
    description: 'Add the snippet through Google Tag Manager or on a WordPress site, without editing theme files by hand.',
    group: 'Getting started',
    blocks: [
        { type: 'p', text: INSTALL_ONCE.replace('<head>', '`<head>`') },
        { type: 'p', text: 'The snippet is one script tag. Copy it from the app (the key is already filled in) and add it to the `<head>` of your control page, every variation page and any page used by a page visit or custom event goal. If you can edit your HTML directly, do that. Otherwise use one of the guides below.' },
        { type: 'code', label: 'HTML', code: `<script src="https://www.freeabtest.com/sdk.js" data-key="cro_pk_prod_..." async></script>` },
        { type: 'h2', text: 'Google Tag Manager', id: 'gtm' },
        { type: 'steps', items: [
            { title: 'Create a tag', text: 'In your container, open **Tags**, select **New** and choose the **Custom HTML** tag type.' },
            { title: 'Paste the snippet', text: 'Paste the script tag from the app into the HTML box, exactly as it is.' },
            { title: 'Fire it as early as possible', text: 'Under **Triggering**, choose **Initialization - All Pages**. If you only want it on some pages, create an Initialization trigger with a Page URL condition that covers the control, variation and goal pages.' },
            { title: 'Raise the priority', text: 'Open **Advanced Settings** and set **Tag firing priority** to a high number, such as 100, so it runs before other tags.' },
            { title: 'Preview and publish', text: 'Use **Preview** to open your control page and check that the tag fired, then select **Submit** to publish.' },
        ] },
        { type: 'callout', tone: 'info', title: 'A short delay is normal', text: 'Tag Manager loads after the page starts to render, so visitors sent to a variation may see the control for a moment before the redirect. For the smoothest result, put the snippet directly in the page `<head>` instead.' },
        { type: 'h3', text: 'Custom events from Tag Manager' },
        { type: 'p', text: 'To count a custom event goal from a Tag Manager trigger, add another Custom HTML tag that runs after the snippet:' },
        { type: 'code', label: 'HTML', code: `<script>
  window.ABTest && ABTest.track('signup');
</script>` },
        { type: 'h2', text: 'WordPress', id: 'wordpress' },
        { type: 'h3', text: 'Recommended: the FreeABTest plugin' },
        { type: 'steps', items: [
            { title: 'Download', text: 'Sign in and choose **Download WordPress plugin** on the Overview page, or visit [the WordPress page](/wordpress). The plugin is free for account holders.' },
            { title: 'Upload and activate', text: 'In WordPress open **Plugins**, **Add New**, **Upload Plugin**, choose the zip and activate it.' },
            { title: 'Connect', text: 'Open **Settings**, **FreeABTest** and paste your public SDK key (it starts with `cro_pk_prod_`). Or choose **Connect WordPress** on the Overview page to fill it in for you.' },
            { title: 'Turn it on', text: 'Tick **Add the snippet to my site**, pick Production or Development and choose **Save settings**. Clear any page cache.' },
        ] },
        { type: 'image', src: '/docs/wordpress-settings.png', alt: 'FreeABTest settings page in WordPress with the snippet turned on', caption: 'Settings, FreeABTest after connecting.' },
        { type: 'p', text: 'Prefer not to install a plugin? Use one of these options instead.' },
        { type: 'p', text: 'Pick one of these options. Both add the snippet to every page, which is fine: the snippet does nothing on pages that are not part of a running test.' },
        { type: 'h3', text: 'Option 1: a header code plugin' },
        { type: 'steps', items: [
            { title: 'Install a plugin', text: 'In **Plugins**, select **Add New** and install a plugin that adds code to the site header, such as WPCode or Insert Headers and Footers. Activate it.' },
            { title: 'Paste the snippet', text: 'Open the plugin settings, find the **Header** box and paste the script tag from the app.' },
            { title: 'Save', text: 'Save the settings and clear any page cache.' },
        ] },
        { type: 'h3', text: 'Option 2: your theme' },
        { type: 'p', text: 'If you use a child theme, add this to its `functions.php`. Changes to a parent theme are lost when it updates, so use a child theme.' },
        { type: 'code', label: 'PHP', code: `add_action('wp_head', function () {
    echo '<script src="https://www.freeabtest.com/sdk.js" data-key="cro_pk_prod_..." async></script>';
}, 1);` },
        { type: 'h3', text: 'Caching and speed plugins' },
        { type: 'p', text: 'Plugins that delay, defer or combine JavaScript can stop the snippet from running in time. If you use one, add `freeabtest.com/sdk.js` to its list of scripts to exclude. After any change, clear the page cache so visitors get the new version.' },
        { type: 'h2', text: 'Check that it works', id: 'check' },
        { type: 'list', items: [
            'Open your control page in a private window. Open the browser console and type `ABTest`. You should see an object, not an error.',
            'Start the test and visit the control page a few times in new private windows. The Results tab shows visitors within a few seconds.',
            'If nothing shows up, check that your domain is registered under **Domains** and see [Troubleshooting](/docs/troubleshooting).',
        ] },
    ],
};
