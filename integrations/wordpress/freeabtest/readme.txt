=== FreeABTest ===
Contributors: freeabtest
Tags: ab testing, split testing, conversion, optimization, experiments
Requires at least: 6.0
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Adds the freeabtest.com A/B testing snippet to your WordPress site. Install it once and run every future test without touching your theme.

== Description ==

FreeABTest connects your WordPress site to [freeabtest.com](https://www.freeabtest.com), an A/B testing service. The plugin adds one small script to the head of every page. Tests, goals and results are managed in your freeabtest.com dashboard.

* Paste your public SDK key, or use the one-click connect link in your dashboard.
* Choose Production or Development.
* Turn the snippet on or off at any time.
* Loads asynchronously and early in the head to avoid flicker.
* Stores one setting. No database queries on your pages beyond reading that setting.
* No admin scripts or styles outside its own settings page.
* The plugin itself collects no data and adds no tracking of its own.

You install the snippet once per site. Every future test runs through it, so new tests never need changes to your theme.

== External services ==

This plugin loads the freeabtest.com SDK from https://www.freeabtest.com/sdk.js on the front end of your site when the snippet is turned on. The SDK is needed to run your A/B tests: it decides which version of a page a visitor sees and sends test events (page views, the assigned variation and the goals you set up) to freeabtest.com. Nothing is loaded while the snippet is off.

The service is provided by freeabtest.com. Details about the service and how it handles data: https://www.freeabtest.com

== Installation ==

1. Sign in to your freeabtest.com account and download the plugin from the dashboard.
2. In WordPress go to Plugins, Add New, Upload Plugin, choose the zip and activate it.
3. Go to Settings, FreeABTest. Paste your Production SDK key (it starts with cro_pk_prod_), or use Connect WordPress in your dashboard to fill it in.
4. Tick Add the snippet to my site and choose Save settings.

== Frequently Asked Questions ==

= Where do I find my key? =

In your freeabtest.com dashboard under API keys. Use the public SDK key, never a secret key.

= Do I need to change anything when I start a new test? =

No. The snippet is installed once per site and every future test runs through it.

= Does it work on multisite? =

Yes. Each site has its own setting.

== Changelog ==

= 1.0.0 =
* First release.

== Upgrade Notice ==

= 1.0.0 =
First release.
