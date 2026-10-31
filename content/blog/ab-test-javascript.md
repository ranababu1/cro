---
title: "How to run an A/B test with plain JavaScript"
meta_description: "Build a client-side A/B test in plain JavaScript: hash a stored visitor ID, show the variant without flicker, log conversions. Tested code and pitfalls."
slug: ab-test-javascript
date: 2026-10-21
updated: 2026-10-31
author: "Imraan, freeabtest.com"
keywords: ["a/b test javascript", "javascript split test", "ab testing without framework", "client side ab test", "deterministic bucketing javascript"]
article_schema: |
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "How to run an A/B test with plain JavaScript",
    "datePublished": "2026-10-21",
    "dateModified": "2026-10-31",
    "mainEntityOfPage": "https://www.freeabtest.com/blog/ab-test-javascript",
    "author": {"@type": "Person", "name": "Imraan"},
    "publisher": {"@type": "Organization", "name": "freeabtest.com", "url": "https://www.freeabtest.com"}
  }
breadcrumb_schema: |
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {"@type": "ListItem", "position": 1, "name": "Blog", "item": "https://www.freeabtest.com/blog"},
      {"@type": "ListItem", "position": 2, "name": "Developer how-tos"},
      {"@type": "ListItem", "position": 3, "name": "How to run an A/B test with plain JavaScript", "item": "https://www.freeabtest.com/blog/ab-test-javascript"}
    ]
  }
howto_schema: |
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to run an A/B test with plain JavaScript",
    "description": "Build a minimal client-side A/B test without a framework: a stored visitor ID, deterministic hashing, an early variant switch that avoids flicker, and exposure and conversion logging.",
    "totalTime": "PT1H",
    "step": [
      {"@type": "HowToStep", "position": 1, "name": "Give each visitor a stable ID", "text": "Create a random ID with crypto.randomUUID() on the first visit and keep it in localStorage, so the same browser always has the same ID."},
      {"@type": "HowToStep", "position": 2, "name": "Hash the ID with the test name", "text": "Hash the string test name plus visitor ID with FNV-1a, take the result modulo 100 and compare it with your split, so the same visitor always lands in the same variant."},
      {"@type": "HowToStep", "position": 3, "name": "Apply the variant in the head", "text": "Run the script inline in the head and set a data attribute on the html element. CSS keyed on that attribute shows the right version before the page is painted, so nothing flickers."},
      {"@type": "HowToStep", "position": 4, "name": "Log one exposure per page view", "text": "Send the test name, variant and visitor ID with navigator.sendBeacon when the page loads. Skip known bots and automated browsers."},
      {"@type": "HowToStep", "position": 5, "name": "Log conversions", "text": "Listen for the goal action, such as a click on the trial button, and send a conversion event with the same visitor ID."},
      {"@type": "HowToStep", "position": 6, "name": "Check the split, then analyse once", "text": "Count unique visitors per variant and run a sample ratio mismatch check. If the split is healthy, compare conversion rates at the sample size you planned before launch."}
    ]
  }
faq_schema: |
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {"@type": "Question", "name": "Can I run an A/B test with just JavaScript?",
       "acceptedAnswer": {"@type": "Answer", "text": "Yes. You need a stable visitor ID, a deterministic hash that maps that ID to a variant, a script in the head that applies the variant before the page paints, and a way to log exposures and conversions. The hard parts are the checks around it: bots, the traffic split, and when to stop."}},
      {"@type": "Question", "name": "Should I use Math.random() to assign variants?",
       "acceptedAnswer": {"@type": "Answer", "text": "Only once per visitor, with the result stored. If you call Math.random() on every page view, visitors switch versions: in our simulation of 100,000 visitors with 3 page views each, 74.8% saw both versions. Hashing a stored visitor ID gives the same answer on every visit without storing the variant itself."}},
      {"@type": "Question", "name": "Is localStorage or a cookie better for an A/B test visitor ID?",
       "acceptedAnswer": {"@type": "Answer", "text": "Either works for one browser on one device, and localStorage is not sent with every request, which keeps requests small. Neither survives a different device or cleared storage. Safari caps script-written storage at 7 days in some cases, so returning visitors can be counted as new."}},
      {"@type": "Question", "name": "How do I stop an A/B test from flickering?",
       "acceptedAnswer": {"@type": "Answer", "text": "Assign the variant in a small inline script in the head, not in a deferred or async file, and switch versions with CSS keyed on an attribute set on the <html> element. The variant is then chosen before the body is painted, so visitors never see the original first."}},
      {"@type": "Question", "name": "How many visitors does a JavaScript A/B test need?",
       "acceptedAnswer": {"@type": "Answer", "text": "The same as any A/B test: it depends on your baseline conversion rate and the lift you want to detect. At a 3% baseline, 95% confidence and 80% power, you need about 13,914 visitors per variant to detect a 20% relative lift. Writing the test in plain JavaScript does not change the math."}}
    ]
  }
---

By Imraan, freeabtest.com. Published 21 October 2026. Updated 31 October 2026.

To run an A/B test with plain JavaScript, give each visitor a random ID stored in localStorage, hash that ID together with the test name to pick a variant, and apply the variant from a small inline script in the `<head>` so the page never flickers. Then log one exposure per page view and any conversions, check that traffic split the way you set it, and compare conversion rates at a sample size you chose before launch.

The code is about 50 lines, and we ran it in Node against 100,000 simulated visitors to check the split. The harder part of a client-side A/B test is everything around the code: bots, broken splits, peeking and statistics.

## What do you need for an A/B test without a framework?

Four pieces, all built into modern browsers:

- **A visitor ID.** A random string created on the first visit and kept in the browser. [`crypto.randomUUID()`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID) creates one, and [`localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) keeps it with no expiry date.
- **Deterministic bucketing.** Bucketing is the step that maps a visitor to a variant. Deterministic means the same visitor ID and test name always give the same variant, so you never have to store the variant itself.
- **An early switch.** Code that runs before the page is painted and shows the right version.
- **Logging.** One event when a visitor sees the test (an exposure) and one when they convert, sent to any endpoint that can append rows to a log.

Kohavi, Tang and Xu give client-side experiments, randomization units and sample ratio mismatch a chapter each in [Trustworthy Online Controlled Experiments](https://www.cambridge.org/core/books/trustworthy-online-controlled-experiments/D97B26382EB0EB2DC2019A7A7B518F59) (Cambridge University Press, 2020). The code below is the same structure at a much smaller scale.

## How do you assign visitors to a variant consistently?

Hash the visitor ID with the test name, take the result modulo 100, and compare it with your split. We use FNV-1a, a short non-cryptographic hash whose 32-bit offset basis (0x811C9DC5) and prime (16777619, or 0x01000193) are listed in the [IETF FNV draft](https://datatracker.ietf.org/doc/html/draft-eastlake-fnv). [`Math.imul()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul) does the 32-bit multiply the hash needs.

Put this inline in the `<head>`, above your stylesheets:

```html
<script>
(function () {
  var EXPERIMENT = 'pricing-headline-1';
  var SPLIT = 50; // percent of visitors who see the variant

  // FNV-1a, 32-bit: the same string always gives the same number
  function fnv1a(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function assign(experiment, visitorId) {
    var bucket = fnv1a(experiment + ':' + visitorId) % 100;
    return bucket < SPLIT ? 'variant' : 'control';
  }

  function getVisitorId() {
    var id = null;
    try { id = localStorage.getItem('diy_ab_vid'); } catch (e) {}
    if (!id) {
      id = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2);
      try { localStorage.setItem('diy_ab_vid', id); } catch (e) {}
    }
    return id;
  }

  var isBot = navigator.webdriver === true ||
    /bot|crawl|spider|slurp|headless/i.test(navigator.userAgent);
  var visitorId = getVisitorId();
  var variant = isBot ? 'control' : assign(EXPERIMENT, visitorId);

  // Runs in <head> before the body is painted, so nothing flickers
  document.documentElement.setAttribute('data-ab-' + EXPERIMENT, variant);

  function log(type) {
    if (isBot) return;
    navigator.sendBeacon('/ab-log', JSON.stringify({
      experiment: EXPERIMENT, variant: variant,
      visitor: visitorId, type: type, ts: Date.now()
    }));
  }

  log('exposure');
  window.diyAB = { variant: variant, log: log, assign: assign };
})();
</script>
```

Three details matter. The `try` blocks keep the page working when storage is blocked (MDN notes that `localStorage` can throw a `SecurityError`). The fallback ID covers pages served over plain HTTP, because `crypto.randomUUID()` only works in secure contexts. And the test name is part of the hashed string, so a visitor's bucket in one test says nothing about their bucket in the next.

IDs still get lost. `localStorage` does not follow a visitor to another device, private windows start empty, and WebKit announced a [7-day cap on all script-writeable storage](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/) in Safari under certain conditions. Cookies set from JavaScript have the same limits. For logged-in users, hash your own account ID.

## Does the hash really split traffic 50/50?

Yes, if you use the full hash. We ran the snippet above, unchanged, in Node 20 with a stubbed browser, then fed its `assign` function 100,000 IDs.

| Check (test name `pricing-headline-1`, 50/50 split) | Result |
|---|---|
| 100,000 sequential IDs (`visitor-1` to `visitor-100000`) | 49,994 control, 50,006 variant (50.01%); chi-square 0.001, p = 0.97 |
| 100 runs of 100,000 fresh random UUIDs | Mean variant share 50.01%, range 49.60% to 50.38%; 7 of 100 runs had p below 0.05 (about 5 expected by chance) |
| All 200,000 IDs assigned a second time | 0 changed variant |
| 20 reloads of the snippet with the same storage | Same visitor ID and variant 20 of 20 times |
| Same 100,000 IDs in a second test (`checkout-copy-1`) | 25.21% in the variant of both tests (25% expected if independent) |
| Same two tests bucketed with `hash % 2` instead of `% 100` | 0.00% in the variant of both tests |

The last row is the trap. In FNV-1a, the lowest bit of the result depends only on the lowest bits of the input characters, so `hash % 2` is a parity check. Each test still splits 50/50, but a visitor's bucket in one test fixes their bucket in every other test. Using `% 100`, or a hash with a final mixing step, avoids it.

Calling `Math.random()` on every page view instead of once has the opposite problem. In the same script, 100,000 simulated visitors with 3 page views each saw both versions 74.8% of the time. With 5 page views, 93.7% did.

## How do you show the variant without flicker?

Flicker, also called a flash of original content, is when a visitor briefly sees the control before the variant replaces it. It happens when the variant is applied after the browser has already painted the page, for example from a script loaded with `defer` or at the end of the body.

The snippet avoids it by deciding in the `<head>` and setting one attribute on the `<html>` element. CSS does the rest, and CSS keyed on that attribute applies before the first paint:

```html
<style>
  .headline-b { display: none; }
  html[data-ab-pricing-headline-1="variant"] .headline-a { display: none; }
  html[data-ab-pricing-headline-1="variant"] .headline-b { display: inline; }
</style>

<h1>
  <span class="headline-a">Simple pricing for small teams</span>
  <span class="headline-b">Plans that grow with your traffic</span>
</h1>
```

Our planned guide on how to avoid flicker in client-side A/B tests will cover layout shifts and late-loading content.

## How do you log exposures and conversions?

The snippet already sends an exposure on every page load. For the goal, add a listener once the page has loaded:

```js
document.addEventListener('click', function (e) {
  if (e.target.closest('#start-trial')) window.diyAB.log('conversion');
});
```

[`navigator.sendBeacon()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon) is the right call here. MDN describes it as the way to send analytics data when the user leaves a page, which is exactly when a click on a link happens and when an ordinary request may be dropped.

When you analyse the log, count unique visitors, not events: a visitor is in a variant if they have at least one exposure, and converted if they have at least one conversion.

For bots, the snippet checks [`navigator.webdriver`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/webdriver), which MDN says indicates a browser controlled by automation, plus a user agent pattern for crawlers. Bots get the control and send nothing. That catches honest crawlers and test tools, not every bot, so also look for visitors with dozens of exposures and nothing else.

## What goes wrong with a homemade A/B test?

The code above is the easy part. These are the common problems, with a fix for each.

| Pitfall | What you see | Fix |
|---|---|---|
| Flicker | Visitors see the old version first; the variant underperforms for no real reason | Decide in an inline `<head>` script and switch with CSS |
| Non-sticky assignment | Visitors see both versions (74.8% after 3 views with per-view `Math.random()`) | Hash a stored ID with the test name |
| Correlated buckets across tests | Two tests always put the same people together | Hash `test name + ID` and use `% 100`, not `% 2` |
| Bots in the data | Huge visitor counts, tiny conversion rates, odd splits | Skip `navigator.webdriver` and crawler user agents; check for outliers |
| Sample ratio mismatch | 50/50 test logs 10,000 vs 9,700 visitors | Treat it as a bug and find the cause before reading results |
| Peeking | A "winner" on day 3 that fades by day 14 | Fix the sample size in advance and look once, or use a sequential test |
| Lost IDs | Returning visitors counted as new, sometimes in the other variant | Use your own user ID for logged-in visitors; keep tests short |

**Sample ratio mismatch (SRM)** is a gap between the split you set and the split you got that is too large to be chance. Our script ran a chi-square check on 50/50 splits: 10,000 vs 9,900 gives p = 0.48 (fine), 10,000 vs 9,700 gives p = 0.03 (suspicious), and 5,500 vs 4,500 gives p below 0.0001 (broken). Usual causes are a variant that errors before logging its exposure, or a redirect that loses visitors. Chapter 21 of Kohavi, Tang and Xu covers SRM, and so will our planned article on sample ratio mismatch.

**Peeking** is checking a fixed-sample test repeatedly and stopping the first time it looks significant. In our simulation for [how long to run an A/B test](https://www.freeabtest.com/blog/how-long-to-run-an-ab-test), checking a classic z-test daily for 20 days gave a false winner 24.5% of the time instead of about 5%. That article also shows how to set the sample size. On a small site, read [A/B testing with low traffic](https://www.freeabtest.com/blog/ab-testing-low-traffic) before you write any code.


## How do you read the result of a JavaScript A/B test?

In this order:

1. **Check the split.** Run the SRM check on unique visitors per variant. If p is below about 0.001, stop and debug.
2. **Compute each conversion rate** as unique converters divided by unique visitors, with an interval, not just a point estimate.
3. **Compare once, at the planned sample**, with a two-proportion z-test. [Evan Miller's "How Not To Run an A/B Test"](https://www.evanmiller.org/how-not-to-run-an-ab-test.html) explains why the single look matters.
4. **Or use a sequential test** if you want to look often. Johari, Pekelis and Walsh describe [always valid p-values](https://arxiv.org/abs/1512.04922) that stay correct under continuous monitoring. They are more work to implement correctly than a z-test.

This is where homemade tests stop being cheap. The assignment code is short; the analysis, alerts and a dashboard someone else can read take weeks.

## How do you run the same test with freeabtest.com?

On freeabtest.com, the same test is a [split URL test](https://www.freeabtest.com/blog/split-url-testing): your current page is the control, and the variant lives at its own URL, such as `/pricing-b`. Add one line to the `<head>` of both pages, copied from the app with your public key already filled in:

```html
<script src="https://www.freeabtest.com/sdk.js" data-key="cro_pk_prod_..." async></script>
```

Nothing else is needed for a standard test. Per our [SDK docs](https://www.freeabtest.com/docs/sdk), the snippet matches the test by URL, assigns the visitor, sends variant visitors to the variant URL, records the visit and counts goals: a CSS click goal on every plan, plus form submit and page visit goals on paid plans. Assignment hashes the visitor ID with the experiment ID, so visitors keep their variant. The SDK keeps that ID in localStorage, like the DIY code, and you can pass your own ID to `init` for logged-in users. The page is hidden for at most 0.8 seconds while the SDK decides, which handles flicker.

The `#start-trial` click from the DIY version becomes a click goal: you type the CSS selector `#start-trial` when you create the test, and no code is needed. On Free, that click goal is the test's one goal. **Paid plans only (Starter and up):** for a conversion that happens in your own code, such as a completed signup, add a custom event goal named `signup` and call:

```js
ABTest.track('signup');
```

If your code needs to know the version, `ABTest.bootstrap()` returns the variation name, and `ABTest.getUserId()` returns the visitor ID for joining with your own analytics.

Results cover the parts that take longest to build: live stats, a Wilson 95% interval for each conversion rate, a peeking-safe sequential test (a mixture sequential probability ratio test) so you can stop once a result is significant, chance to beat control once both versions have 100 visitors, and a warning when the split is off. See [reading results](https://www.freeabtest.com/docs/results). To try it, the [quick start](https://www.freeabtest.com/docs/quick-start) goes from sign-in to a running test.

The limits, plainly: our [Free plan](https://www.freeabtest.com/pricing) allows 10,000 tested visitors a month (300 a day), 1 running test, 1 new test a month on 1 page URL, exactly 1 goal per test (a click on a CSS selector), 1 project, 1 domain and a control plus 1 variation, with no card needed. Custom events and `trackConversion` are paid-only. Paid plans allow up to 50 variations. On Free and Starter each variation has its own URL; editing the original page in place without code is the visual editor, on Growth and up. Session recordings are not available yet.

## Should you build it yourself or use a snippet?

| Question | Plain JavaScript (DIY) | freeabtest.com snippet |
|---|---|---|
| Cost | Your time, plus wherever you store the log | Free plan, or paid plans for more traffic and features |
| Where the variant lives | Same page, switched with CSS | Its own URL on Free and Starter; same page with the visual editor on Growth and up |
| Flicker | None, if the script is inline in the `<head>` | Page hidden for at most 0.8 seconds while the SDK decides |
| Sticky assignment | You write it (hash plus stored ID) | Built in |
| Goals | You write each listener | 1 CSS click goal per test on Free; form submit, page visit and custom event goals on paid plans |
| Statistics | You write the z-test or sequential test | Sequential test, Wilson intervals, chance to beat control |
| SRM check | You run it | Warning in the results |
| Control over data | Every raw event is yours | Results in the dashboard, CSV download and REST API |
| GA4 | You send your own event | `experience_impression` sent on every plan |

Build it yourself to learn how testing works, for a variant no tool can render, or for one test a year that you will analyse by hand. Use a snippet when you test regularly and would rather spend the time on what to test than on plumbing. If you are replacing Google Optimize and want results in GA4, our guide to [Google Optimize alternatives for developers](https://www.freeabtest.com/blog/google-optimize-alternatives-developers) compares the options.

## Frequently asked questions

**Can I run an A/B test with just JavaScript?**
Yes. You need a stable visitor ID, a deterministic hash that maps that ID to a variant, a script in the head that applies the variant before the page paints, and a way to log exposures and conversions. The hard parts are the checks around it: bots, the traffic split, and when to stop.

**Should I use Math.random() to assign variants?**
Only once per visitor, with the result stored. If you call `Math.random()` on every page view, visitors switch versions: in our simulation of 100,000 visitors with 3 page views each, 74.8% saw both versions. Hashing a stored visitor ID gives the same answer on every visit without storing the variant itself.

**Is localStorage or a cookie better for an A/B test visitor ID?**
Either works for one browser on one device, and `localStorage` is not sent with every request, which keeps requests small. Neither survives a different device or cleared storage. Safari caps script-written storage at 7 days in some cases, so returning visitors can be counted as new.

**How do I stop an A/B test from flickering?**
Assign the variant in a small inline script in the head, not in a deferred or async file, and switch versions with CSS keyed on an attribute set on the `<html>` element. The variant is then chosen before the body is painted, so visitors never see the original first.

**How many visitors does a JavaScript A/B test need?**
The same as any A/B test: it depends on your baseline conversion rate and the lift you want to detect. At a 3% baseline, 95% confidence and 80% power, you need about 13,914 visitors per variant to detect a 20% relative lift. Writing the test in plain JavaScript does not change the math.

Every number here comes from one Node script that loads the exact snippet above into a stubbed browser, checks the attribute and beacons, then runs the hashing checks on 100,000 IDs (sequential IDs for the reproducible rows, fresh `crypto.randomUUID()` values for the random ones, which vary slightly between runs). Copy the snippet, change the test name and selector, and run it on one page first. If the split checks out after a day of real traffic, you have a working A/B test with no framework, and a clear idea of what a testing tool would save you.
