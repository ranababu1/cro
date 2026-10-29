---
title: "How to run a split URL test without a plugin"
meta_description: "Run a split URL test with one script in the head of two pages: a stable visitor ID, a 302-style redirect, a canonical tag and logging that catches lost visitors."
slug: split-url-testing
date: 2026-10-29
updated: 2026-10-29
author: "Imraan, freeabtest.com"
keywords: ["split url testing", "split url test", "redirect test", "split url vs ab test", "split url test seo"]
article_schema: |
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "How to run a split URL test without a plugin",
    "datePublished": "2026-10-29",
    "dateModified": "2026-10-29",
    "mainEntityOfPage": "https://www.freeabtest.com/blog/split-url-testing",
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
      {"@type": "ListItem", "position": 3, "name": "How to run a split URL test without a plugin", "item": "https://www.freeabtest.com/blog/split-url-testing"}
    ]
  }
howto_schema: |
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to run a split URL test without a plugin",
    "description": "Send half of the visitors on an original page to a second URL and compare conversions, using one inline script, a canonical tag and logging on both pages.",
    "totalTime": "PT1H",
    "step": [
      {"@type": "HowToStep", "position": 1, "name": "Build the variant page", "text": "Publish the new version at its own URL on the same domain, for example /pricing-b, and add a rel=canonical link on it that points to the original page."},
      {"@type": "HowToStep", "position": 2, "name": "Add the same script to both pages", "text": "Put one inline script in the head of the original and the variant page. It gives each visitor a stored ID and hashes it with the test name, so the same visitor always gets the same version."},
      {"@type": "HowToStep", "position": 3, "name": "Redirect the variant group", "text": "On the original page, send visitors in the variant group to the variant URL with location.replace, keeping the query string and hash. Hide the page while the redirect runs so the original does not flash."},
      {"@type": "HowToStep", "position": 4, "name": "Log assignment and landing", "text": "Log an assigned event on the original page for every visitor and a landed event on the page each visitor actually sees. The gap between the two counts is your redirect loss."},
      {"@type": "HowToStep", "position": 5, "name": "Check the split before reading results", "text": "Run a chi-square check on landed visitors per version. If the split is far from what you set, fix the redirect before you trust any lift."},
      {"@type": "HowToStep", "position": 6, "name": "End the test and remove the redirect", "text": "When the test reaches its planned sample, ship the winner on the original URL, remove the script and the variant page, or redirect the variant URL to the original."}
    ]
  }
faq_schema: |
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {"@type": "Question", "name": "What is split URL testing?",
       "acceptedAnswer": {"@type": "Answer", "text": "Split URL testing is an A/B test where each version lives at its own URL and visitors are redirected between them. Some visitors to the original page are sent to the variant URL, and you compare conversions on the two pages. It suits whole-page redesigns that would be hard to build as changes on one page."}},
      {"@type": "Question", "name": "What is the difference between a split URL test and an A/B test?",
       "acceptedAnswer": {"@type": "Answer", "text": "A split URL test is a kind of A/B test. In an on-page A/B test, both versions are served on the same URL and the change is applied in the page. In a split URL test, each version has its own URL and a redirect decides who sees which. The statistics and the sample size are the same."}},
      {"@type": "Question", "name": "Do split URL tests hurt SEO?",
       "acceptedAnswer": {"@type": "Answer", "text": "Not if you follow Google's testing guidance: use a temporary 302 or a JavaScript redirect, put a rel=canonical link on the variant that points to the original, show Googlebot the same versions as people, and end the test once you have an answer. Google says small changes usually have little or no effect on ranking."}},
      {"@type": "Question", "name": "Should a split URL test use a 301 or a 302 redirect?",
       "acceptedAnswer": {"@type": "Answer", "text": "Use a 302 or a JavaScript redirect. Google's guidance says a 301 tells search engines the move is permanent and can lead them to replace the original URL with the test page in the index. A 302 says the redirect is temporary."}},
      {"@type": "Question", "name": "How many visitors does a split URL test need?",
       "acceptedAnswer": {"@type": "Answer", "text": "The same as any A/B test with the same goal. At a 3% conversion rate, 95% confidence and 80% power, you need about 13,914 visitors per version to detect a 20% relative lift. At a 10% rate, a 30% lift needs about 1,774 per version."}},
      {"@type": "Question", "name": "Why does my split URL test show fewer visitors on the variant?",
       "acceptedAnswer": {"@type": "Answer", "text": "Usually because some visitors leave or block the redirect before the variant page logs them. This is a sample ratio mismatch. In our calculation, losing 5% of the variant group at 5,000 assigned visitors per version gives a chi-square p-value of 0.011, which a standard check flags. Fix the redirect before you read the result."}}
    ]
  }
---

By Imraan, freeabtest.com. Published 29 October 2026. Product details checked 29 October 2026.

A split URL test sends some of the visitors who open your original page to a second URL, then compares conversions on the two pages. To run one without a plugin, you need one inline script in the `<head>` of both pages that gives each visitor a stable ID, sends the variant group to the new URL with a temporary redirect that keeps the query string, and logs which page each visitor actually saw.

This guide gives you that script, the SEO rules Google publishes for redirect tests, and the check that catches the most common split URL bug: visitors lost in the redirect. We tested the script in Node against a stubbed browser and ran the statistics in Python with SciPy. Both files are named in the note at the end, and every input is stated so you can check any number.

## What is split URL testing?

Split URL testing is an A/B test where each version lives at its own URL. A visitor who opens `/pricing` either stays there (the control) or is redirected to `/pricing-b` (the variant), and you compare a goal, such as clicks on "Start free", between the two groups. It is also called a redirect test.

The method is not exotic. Google's [guide to minimizing A/B testing impact in Search](https://developers.google.com/search/docs/crawling-indexing/website-testing) describes both ways to test: creating versions of a page "each with its own URL" and redirecting some users to them, or "inserting variations dynamically on the page" with JavaScript.

| | Split URL test | On-page A/B test |
|---|---|---|
| Where each version lives | Its own URL, such as `/pricing-b` | The same URL |
| How the version is shown | A redirect from the original page | Script or server changes the page in place |
| Best for | Redesigns, new templates, a different page builder, long-form rewrites | Headlines, buttons, images, copy, single sections |
| Extra page load | One redirect for the variant group | None |
| SEO setup | Canonical tag on the variant, temporary redirect | Usually nothing |
| Statistics and sample size | Same | Same |

## When should you use a split URL test instead of an A/B test?

Use a split URL test when the variant is easier to build as a whole new page than as a set of changes to the current one. Three common cases:

1. **A redesign.** A new layout, new sections and new order. Expressing that as changes on the old page would be a large script that is hard to check.
2. **A different template or tool.** For example, the new pricing page is built in a landing page builder and the old one is in your app.
3. **A different flow.** A one-step signup against a three-step one, where the variant needs its own route.

Use an on-page test for small, local changes. A button label does not need a second URL, and the redirect adds a page load you do not need. Our guide on [how to run an A/B test with plain JavaScript](https://www.freeabtest.com/blog/ab-test-javascript) covers that case.

## What does a split URL test need without a plugin?

Five parts, all of which fit in one short script plus your own logging endpoint:

1. **A variant page** on the same domain, with a `rel="canonical"` link pointing to the original.
2. **A stable visitor ID**, stored in the browser, so the same person gets the same version on every visit.
3. **Deterministic assignment**: hash the ID with the test name and compare it with your split. No random draw on each page view.
4. **A redirect** that runs in the `<head>`, keeps UTM tags and other query parameters, and does not leave the original page in the back-button history.
5. **Two log events**: `assigned` on the original page for everyone, and `landed` on the page each visitor actually sees. You analyse `landed`, and the gap between the two is your redirect loss.

## What does the redirect script look like?

Put the same script inline at the top of the `<head>` on both pages, above your stylesheets. Change the test name, the split and the variant path.

```html
<script>
(function () {
  var EXPERIMENT = 'pricing-page-2';
  var SPLIT = 50;                 // percent of visitors sent to the variant
  var VARIANT_PATH = '/pricing-b'; // the variant page on the same domain

  // FNV-1a, 32-bit: the same string always gives the same number
  function fnv1a(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
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
  var bucket = fnv1a(EXPERIMENT + ':' + visitorId) % 100;
  var variant = bucket < SPLIT ? 'variant' : 'control';

  function log(type) {
    if (isBot) return; // bots are redirected like anyone else, just not counted
    navigator.sendBeacon('/ab-log', JSON.stringify({
      experiment: EXPERIMENT, variant: variant,
      visitor: visitorId, type: type, ts: Date.now()
    }));
  }

  if (location.pathname === VARIANT_PATH) {
    // Only count people who were assigned here. Others opened the URL directly.
    if (variant === 'variant') log('landed');
  } else {
    log('assigned');
    if (variant === 'variant') {
      document.documentElement.style.visibility = 'hidden';
      setTimeout(function () {
        document.documentElement.style.visibility = '';
      }, 1500); // show the original if the redirect never happens
      location.replace(VARIANT_PATH + location.search + location.hash);
    } else {
      log('landed');
    }
  }

  window.diyAB = { variant: variant, log: log };
})();
</script>
```

How each part works:

- **Assignment** uses the same FNV-1a hash and stored ID as our plain JavaScript guide. The test name is part of the hashed string, so a visitor's group in this test says nothing about their group in the next one.
- **The redirect** uses [`location.replace()`](https://developer.mozilla.org/en-US/docs/Web/API/Location/replace), which MDN notes does not save the current page in session history. A visitor who presses Back goes to where they came from, not to the original page, which would redirect them again.
- **The query string and hash are kept**, so `?utm_source=newsletter` still reaches your analytics on the variant page.
- **The page is hidden** while the redirect starts, so the original does not flash. The 1.5 second timer shows the original if the redirect never happens, for example when a browser blocks it.
- **Bots are redirected like anyone else** but never logged. That matters for SEO, as the next section explains.
- **A control visitor who opens `/pricing-b` directly** is not counted, because they were never assigned to it.

We loaded this exact script into a stubbed browser in Node and checked its behaviour:

| Check | Result |
|---|---|
| 100,000 visitors with sequential IDs, 50% split | 50,174 redirected (50.17%), chi-square p = 0.271, so no mismatch |
| 100,000 visitors with fresh random IDs | 50,270 redirected (50.27%); this row changes slightly on each run |
| Variant visitor opens `/pricing?utm_source=newsletter&utm_campaign=oct#plans` | Redirected to `/pricing-b?utm_source=newsletter&utm_campaign=oct#plans`, page hidden, `assigned` logged |
| Same visitor on `/pricing-b` | No redirect, `landed` logged |
| Control visitor on `/pricing` | No redirect, page not hidden, `assigned` and `landed` logged |
| Control visitor opens `/pricing-b` directly | No redirect, nothing logged |
| Same browser, 3 visits | Same version all 3 times |
| Googlebot user agent | Redirected the same way, nothing logged |

The script logs with [`navigator.sendBeacon()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon), which MDN describes as sending data "without delaying unload or the next navigation", so the `assigned` event usually survives the redirect without slowing it down. You still need a `/ab-log` endpoint that stores the JSON it receives.

## How do you keep a split URL test safe for SEO?

Follow the four rules in [Google's testing guidance](https://developers.google.com/search/docs/crawling-indexing/website-testing). Google says small changes such as button text often have "little or no impact" on ranking, and a full redesign can still be tested safely if you set it up this way:

| Rule | What Google says | How the script above handles it |
|---|---|---|
| Don't cloak | Don't show Googlebot one set of URLs and people another. Cloaking is against Google's spam policies "whether you're running a test or not" | Bots go through the same assignment and redirect. They are only left out of the log |
| Use rel="canonical" | Put it on every alternate URL, pointing to the original. Google prefers it to `noindex` for tests | Add `<link rel="canonical" href="https://www.example.com/pricing">` to `/pricing-b` |
| Use 302, not 301 | A 302 says the redirect is temporary, so the original stays in the index. "JavaScript-based redirects are also fine" | `location.replace()` is a JavaScript redirect. If you redirect on the server, send a [302 Found](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/302) |
| Run only as long as needed | Remove alternate URLs and test scripts soon after the test ends. Running a test "for an unnecessarily long time" can be read as an attempt to deceive | Plan the sample size first and set an end date |

Speed is the other cost. Chrome's Lighthouse documentation on [page redirects](https://developer.chrome.com/docs/lighthouse/performance/redirects) says each redirect is another trip across the network that can delay the page "by hundreds of milliseconds". In a split URL test only the variant group pays that cost, and it is part of what you are measuring. Keep the variant page light, and never chain a second redirect after the first.

## Why do redirect tests lose visitors, and how do you catch it?

A redirect is one more step where a visitor can drop out before you count them. Someone on a slow phone closes the tab, a privacy tool blocks the script, or the variant page errors. They were assigned to the variant, but they never reach it, so the variant group ends up smaller than the control.

That imbalance is a sample ratio mismatch (SRM): the share of visitors in each group differs from the split you set by more than chance allows. A [KDD 2019 paper by researchers at Microsoft, Booking.com and Outreach](https://exp-platform.com/Documents/2019_KDDFabijanGupchupFuptaOmhoverVermeerDmitriev.pdf) found that about 6% of experiments at Microsoft showed an SRM, and lists failed redirects as one cause. Its suggested fix is to redirect both control and treatment when one of them needs a redirect, so both groups take the same step.

Here is how loss in the variant group shows up in a standard chi-square check of the split (50/50 intended):

| Assigned per version | Loss in variant | Control logged | Variant logged | SRM p-value |
|---|---|---|---|---|
| 1,000 | 5% | 1,000 | 950 | 0.258 |
| 5,000 | 2% | 5,000 | 4,900 | 0.315 |
| 5,000 | 5% | 5,000 | 4,750 | 0.011 |
| 20,000 | 1% | 20,000 | 19,800 | 0.316 |
| 20,000 | 2% | 20,000 | 19,600 | 0.044 |
| 20,000 | 5% | 20,000 | 19,000 | 0.0000004 |

Small tests cannot see small losses, which is exactly why you also log `assigned`. Compare `assigned` and `landed` for the variant group directly: if 5% of assigned visitors never land, you know the size of the loss even when the chi-square check is too weak to flag it.

The loss also biases the result. The people who drop out of a redirect tend to be the impatient ones, who convert less. If both groups really convert at 3%, and the 5% lost from the variant would never have converted, the variant's logged rate becomes 3.158%: an apparent 5.26% lift from nothing. At 20,000 assigned per version that fake lift is not significant (p = 0.367), but it adds to whatever real effect the variant has and can tip a close test the wrong way.

Three fixes, in order of effort:

1. **Load the script first in the `<head>`**, so the redirect starts before anything else downloads.
2. **Log `assigned` before the redirect** and report the loss next to the result, as the script does.
3. **Redirect both groups**, for example `/pricing` sends control visitors to `/pricing-a` and variant visitors to `/pricing-b`, as the KDD paper suggests. Both groups then take the same step. The cost is a redirect for everyone during the test.

A dedicated article on sample ratio mismatch is planned.

## How many visitors does a split URL test need?

Exactly as many as an on-page A/B test with the same goal. The redirect changes how the variant is delivered, not the statistics. At 95% confidence (two-sided) and 80% power:

| Goal conversion rate | 20% lift | 30% lift | 50% lift |
|---|---|---|---|
| 3% | 13,914 per version | 6,455 per version | 2,518 per version |
| 10% | 3,841 per version | 1,774 per version | 686 per version |

Lifts are relative, so a 30% lift on 10% means 10% to 13%. Our guide to [A/B test sample size](https://www.freeabtest.com/blog/ab-test-sample-size) explains each input and includes a calculator, and our guide on [how long to run an A/B test](https://www.freeabtest.com/blog/how-long-to-run-an-ab-test) turns visitors into weeks.

Split URL tests are often redesigns, and redesigns tend to produce bigger changes than a new button label, which helps on small sites. If your page gets a few thousand visitors a month, measure a goal that happens often, such as a click on the main call to action, rather than paid signups. Our guide to [A/B testing with low traffic](https://www.freeabtest.com/blog/ab-testing-low-traffic) shows what lift your traffic can detect. When you read the result, our explainer on [statistical significance in an A/B test](https://www.freeabtest.com/blog/statistical-significance-ab-test) covers what the p-value does and does not tell you.

## How do you run a split URL test with freeabtest.com?

Split URL tests are the core test type on every plan, including Free. You add one script tag and the snippet does the assignment, the redirect and the counting. The [quick start](https://www.freeabtest.com/docs/quick-start) walks through it in full:

1. **Add your domain** under Domains. Each variation must be a full URL on that domain.
2. **Create the test** with your original page as the control URL and your new page as the variation URL.
3. **Add a goal.** On the Free plan each test has 1 goal, a click on a CSS selector such as `#headerCTA`. Use a selector that exists on both pages, because click goals are watched on the control and variation pages. Page visit goals for a thank-you page, form submit goals and custom events are on paid plans.
4. **Put the snippet in the `<head>` of both pages.** When a visitor in the variation opens the original page, the SDK sends them to the variation URL and keeps the query string. It skips the redirect on the variation page itself, and the page stays hidden for at most 0.8 seconds while it decides. Add the canonical tag to your variation page yourself.
5. **Check each version with a preview link** before you start. Preview visits are never counted.
6. **Read the results.** You get conversion rate, lift, 95% intervals and a peeking-safe significance verdict, plus a sample ratio mismatch warning if the split drifts from your weights.
7. **Roll out the winner.** For a split URL winner, visitors who open the original page are sent to the winning page until you put the change in your code, then you stop the rollout.

The Free plan covers 10,000 tested visitors a month (up to 300 a day), 1 running test, 1 new test a month, and a control plus 1 variation. At a 10% click rate and a 30% lift, a test needs 3,548 visitors in total, about 12 days at 300 a day, so plan for 2 full weeks. Our significance test stays valid however often you check, and in exchange it needs about 2 to 3 times as many visitors to call the same observed lift, so treat that table as the minimum. Paid plans start at $10 a month and allow up to 50 variations. Full details are on the [pricing page](https://www.freeabtest.com/pricing).

Two limits worth knowing before you start: variation URLs cannot be changed after the test is created, and you cannot add or remove variations on a running test. If you need a different page, create a new test.

## Should you write the redirect yourself or use a snippet?

| | Your own script | freeabtest.com snippet |
|---|---|---|
| Cost | Your time, plus a logging endpoint | Free plan, or paid plans for more traffic and goals |
| Assignment and redirect | The script above | Built in, on both pages |
| Query string kept | Yes, if you write it | Yes |
| Redirect loss and SRM | You log `assigned` and run the check | SRM warning in the results |
| Goals | You write each listener | 1 CSS click goal on Free; page visit, form submit and custom event goals on paid plans |
| Statistics | You run the test yourself | Peeking-safe sequential test, Wilson intervals, chance to beat control |
| Canonical tag | You add it | You add it |
| Raw data | Every event is yours | Dashboard, CSV download and REST API |

Write it yourself for a one-off test on a site where you cannot add third-party scripts, or to see how a redirect test works end to end. Use a snippet when you test every month and would rather spend the time on what to test.

## Frequently asked questions

**What is split URL testing?**
Split URL testing is an A/B test where each version lives at its own URL and visitors are redirected between them. Some visitors to the original page are sent to the variant URL, and you compare conversions on the two pages. It suits whole-page redesigns that would be hard to build as changes on one page.

**What is the difference between a split URL test and an A/B test?**
A split URL test is a kind of A/B test. In an on-page A/B test, both versions are served on the same URL and the change is applied in the page. In a split URL test, each version has its own URL and a redirect decides who sees which. The statistics and the sample size are the same.

**Do split URL tests hurt SEO?**
Not if you follow Google's testing guidance: use a temporary 302 or a JavaScript redirect, put a `rel="canonical"` link on the variant that points to the original, show Googlebot the same versions as people, and end the test once you have an answer. Google says small changes usually have little or no effect on ranking.

**Should a split URL test use a 301 or a 302 redirect?**
Use a 302 or a JavaScript redirect. Google's guidance says a 301 tells search engines the move is permanent and can lead them to replace the original URL with the test page in the index. A 302 says the redirect is temporary.

**How many visitors does a split URL test need?**
The same as any A/B test with the same goal. At a 3% conversion rate, 95% confidence and 80% power, you need about 13,914 visitors per version to detect a 20% relative lift. At a 10% rate, a 30% lift needs about 1,774 per version.

**Why does my split URL test show fewer visitors on the variant?**
Usually because some visitors leave or block the redirect before the variant page logs them. This is a sample ratio mismatch. In our calculation, losing 5% of the variant group at 5,000 assigned visitors per version gives a chi-square p-value of 0.011, which a standard check flags. Fix the redirect before you read the result.

The script results come from `split_url_demo.js`, which loads the exact snippet above into a stubbed browser, and the SRM, bias and sample size figures come from `split_url_calculations.py` (SciPy, chi-square with 1 degree of freedom, two-proportion z-test, and the standard two-proportion sample size formula). Build the variant page, add the canonical tag, put the script on both pages, and watch `assigned` against `landed` for the first day. If those two numbers match, the rest of the test is the same as any A/B test.
