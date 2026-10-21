---
title: "How long should you run an A/B test? Worked examples"
meta_description: "Run an A/B test until it reaches its planned sample size, in whole weeks, and for at least 2 weeks. Worked examples for 1,000 to 50,000 weekly visitors."
slug: how-long-to-run-an-ab-test
date: 2026-10-17
updated: 2026-10-21
author: "Imraan, freeabtest.com"
keywords: ["how long to run an a/b test", "a/b test duration", "ab test sample size", "when to stop an ab test", "minimum detectable effect"]
article_schema: |
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "How long should you run an A/B test? Worked examples",
    "datePublished": "2026-10-17",
    "dateModified": "2026-10-21",
    "mainEntityOfPage": "https://www.freeabtest.com/blog/how-long-to-run-an-ab-test",
    "author": {"@type": "Person", "name": "Imraan"},
    "publisher": {"@type": "Organization", "name": "freeabtest.com", "url": "https://www.freeabtest.com"}
  }
breadcrumb_schema: |
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {"@type": "ListItem", "position": 1, "name": "Blog", "item": "https://www.freeabtest.com/blog"},
      {"@type": "ListItem", "position": 2, "name": "A/B testing statistics"},
      {"@type": "ListItem", "position": 3, "name": "How long should you run an A/B test?", "item": "https://www.freeabtest.com/blog/how-long-to-run-an-ab-test"}
    ]
  }
faq_schema: |
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {"@type": "Question", "name": "How long should an A/B test run?",
       "acceptedAnswer": {"@type": "Answer", "text": "Use a sample size calculated before launch as a planning estimate, round up to whole weeks, and never run less than 2 weeks. On freeabtest.com you can also stop earlier once the peeking-safe sequential verdict is significant. Divide the total visitors needed by your weekly traffic to the tested page to get a planning estimate in weeks."}},
      {"@type": "Question", "name": "Can I stop an A/B test as soon as it is significant?",
       "acceptedAnswer": {"@type": "Answer", "text": "Not with a standard fixed-sample z-test: in our simulation of 4,000 tests with no real difference, checking every day for 20 days declared a false winner 24.5% of the time, compared with 4.7% when checking once at the end. freeabtest.com uses a peeking-safe sequential test on all plans, so you can stop when the sequential verdict is significant. Still run at least one full week."}},
      {"@type": "Question", "name": "How many visitors do I need for an A/B test?",
       "acceptedAnswer": {"@type": "Answer", "text": "At a 3% conversion rate, 95% confidence and 80% power, you need about 13,914 visitors per variant to detect a 20% relative lift and about 53,211 per variant to detect a 10% lift."}},
      {"@type": "Question", "name": "What is the minimum length of an A/B test?",
       "acceptedAnswer": {"@type": "Answer", "text": "Two full weeks is a common minimum even when traffic is high, because behavior differs by day of week and returning visitors may react to novelty at first."}},
      {"@type": "Question", "name": "What if my test would take months?",
       "acceptedAnswer": {"@type": "Answer", "text": "Test a bigger change so the effect is larger, measure a more frequent goal higher in the funnel, or put more traffic into the test. If none of those work, a test is the wrong tool for that question."}}
    ]
  }
---

By Imraan, freeabtest.com. Published 17 October 2026. Updated 21 October 2026.

Plan an A/B test with a sample size calculated before launch, rounded up to whole weeks, and run it for at least 2 weeks. With a fixed-sample test, wait until that sample is reached before deciding. With freeabtest.com's peeking-safe sequential test, you can stop earlier once the verdict is significant, but still plan with a sample-size estimate and keep a one-week floor. To get a planning estimate in weeks, divide the total visitors the test needs by the weekly visitors to the page you are testing.

That answer hides one hard part: working out the sample size. This article does it step by step, with numbers you can check. All calculations use the standard two-proportion sample size formula at 95% confidence (two-sided) and 80% power, the same defaults as [Evan Miller's sample size calculator](https://www.evanmiller.org/ab-testing/sample-size.html). We ran them ourselves in Python with SciPy, using this formula for visitors per variant:

**n = (1.96 × √(2p̄(1 - p̄)) + 0.84 × √(p1(1 - p1) + p2(1 - p2)))² ÷ (p2 - p1)²**

Here p1 is the baseline rate, p2 is the rate you want to detect, and p̄ is the average of the two. The 1.96 comes from 95% confidence (two-sided) and the 0.84 from 80% power. Our script uses the unrounded values (1.95996 and 0.84162) and rounds each result up to the next whole visitor, so the rounded formula lands a few visitors lower.

## What decides how long a test takes?

Four inputs decide the sample size. Your traffic then turns sample size into days.

- **Baseline conversion rate.** The conversion rate of your current page. Lower baselines need more visitors.
- **Minimum detectable effect (MDE).** The smallest lift your test is set up to detect. If you set an MDE of 20% relative, a test on a 3% baseline is built to detect a change to 3.6%. Smaller MDEs need far more visitors.
- **Significance level (alpha).** The false positive rate you accept when there is no real difference. 5% is the usual choice, which matches 95% confidence.
- **Power.** The chance the test detects the MDE if it is real. 80% is the usual choice. It means that a real 20% lift will be missed 1 time in 5.

Then:

**Days = (visitors per variant × number of variants) ÷ daily visitors to the tested page**

Round the result up to whole weeks.

## How many visitors per variant do I need?

Here are the visitors needed per variant, at 95% confidence and 80% power, for common baselines and lifts.

| Baseline rate | 5% lift | 10% lift | 20% lift | 30% lift | 50% lift |
|---|---|---|---|---|---|
| 1% | 637,010 | 163,095 | 42,693 | 19,827 | 7,750 |
| 3% | 207,938 | 53,211 | 13,914 | 6,455 | 2,518 |
| 5% | 122,124 | 31,234 | 8,158 | 3,780 | 1,471 |
| 10% | 57,763 | 14,751 | 3,841 | 1,774 | 686 |

Lifts are relative. A 20% lift on a 3% baseline means 3.0% to 3.6%.

Two things stand out.

First, halving the effect you want to detect roughly quadruples the sample. At a 3% baseline, going from a 20% MDE to a 10% MDE takes you from 13,914 to 53,211 visitors per variant. That is because sample size scales with 1 divided by the square of the effect.

Second, the baseline matters a lot. A page converting at 10% needs about a quarter of the visitors a 3% page needs for the same relative lift. Testing a goal that happens often (a click on "See pricing") is much faster than testing one that happens rarely (a paid signup).

## Worked example: a SaaS landing page

Say your pricing page gets 10,000 visitors a week and 3% of them start a trial. You want to know if a new headline lifts trials by 20%.

1. Visitors per variant at 3% baseline, 20% MDE: **13,914**
2. Two variants (control and one challenger): 13,914 × 2 = **27,828** visitors
3. Daily traffic: 10,000 ÷ 7 = **1,429** visitors a day
4. Days: 27,828 ÷ 1,429 = **19.5 days**
5. Round up to whole weeks: **3 weeks**

If you wanted to detect a 10% lift instead, the same page would need 106,422 visitors in total, which is 74.5 days, so 11 weeks. Most teams will not wait that long, and they should know that before they launch, not after.

## How long will my test take at my traffic?

Here is the same calculation for a 3% baseline across different traffic levels, for a two-variant test. "Weeks" is rounded up to whole weeks, with a 2-week floor.

| Weekly visitors to the page | 10% lift | 20% lift | 30% lift |
|---|---|---|---|
| 1,000 | 745 days (107 weeks) | 195 days (28 weeks) | 90 days (13 weeks) |
| 2,500 | 298 days (43 weeks) | 78 days (12 weeks) | 36 days (6 weeks) |
| 5,000 | 149 days (22 weeks) | 39 days (6 weeks) | 18 days (3 weeks) |
| 10,000 | 75 days (11 weeks) | 20 days (3 weeks) | 9 days (2 weeks) |
| 25,000 | 30 days (5 weeks) | 8 days (2 weeks) | 4 days (2 weeks) |
| 50,000 | 15 days (3 weeks) | 4 days (2 weeks) | 2 days (2 weeks) |

If your row only has long numbers, our guide to [A/B testing with low traffic](https://www.freeabtest.com/blog/ab-testing-low-traffic) covers what you can still learn.

## Why at least 2 weeks, even with lots of traffic?

A test can reach its sample size in 4 days at 50,000 weekly visitors. We still recommend running it for 2 full weeks, for three reasons.

- **Day-of-week effects.** Visitors on a Tuesday afternoon are often different from visitors on a Saturday morning. A test that runs Monday to Thursday measures a weekday audience only. Full weeks give each day equal weight.
- **Novelty and learning.** Returning visitors sometimes click a new design because it is new. That effect fades. Ronny Kohavi, Diane Tang and Ya Xu describe novelty and primacy effects in [Trustworthy Online Controlled Experiments](https://www.cambridge.org/core/books/trustworthy-online-controlled-experiments/D97B26382EB0EB2DC2019A7A7B518F59) (Cambridge University Press, 2020), and recommend looking at how the effect changes over time.
- **Business cycles.** Paydays, newsletters and ad campaigns create spikes. Two weeks smooths over more of them.

The 2-week floor is a convention, not a law. If your buying cycle is monthly, test for a month.

## Can I stop the test early if it is already significant?

It depends on the test your tool runs.

With a **standard fixed-sample z-test**, checking again and again and stopping the first time p drops below 0.05 is called peeking, and it inflates false positives. [Evan Miller's "How Not To Run an A/B Test"](https://www.evanmiller.org/how-not-to-run-an-ab-test.html) is the classic explanation. We simulated it: 4,000 A/A tests, both variants at the same 5% conversion rate, 250 visitors per variant per day for 20 days. Any "winner" is a false positive.

| How we checked (fixed-sample z-test) | False winner rate |
|---|---|
| Once, on day 20 | 4.7% |
| Every day, stopping at the first p < 0.05 | 24.5% |

Checking daily made a false winner about 5 times more likely. On a fixed-sample test, the 5% error rate you think you chose only holds if you look once, at the planned end.

**freeabtest.com uses a peeking-safe sequential test** (a mixture sequential probability ratio test) on every plan, including Free. Its p-value stays valid however often you look, so you can check the dashboard and stop when the sequential verdict is significant. Chance to beat control also appears once each version has 100 visitors. Two habits still help: run for at least one full week so weekday and weekend visitors are both included, and pick the primary goal before you start.

The worked sample-size tables in this article stay useful as **planning estimates**. They use the fixed-sample formula. Our [guide to reading results](https://www.freeabtest.com/docs/results) notes that the sequential test needs about 2 to 3 times as many visitors for the same observed lift, or you can stop earlier when the real lift is larger than you planned for. The results API still returns a fixed-sample z-test under `statistical_significance` if you prefer a single-look plan.

## What if I test more than two variants?

Every extra variant adds visitors to the test. A test with 3 variants needs 3 times the per-variant sample, not 2.

There is a second cost. With several challengers, each one is another chance for a false winner, so the chance that at least one "beats" the control by luck is higher than 5% if you leave the threshold at 5% for every comparison. freeabtest.com splits the 5% across the variants compared with the control (Bonferroni), as our [guide to reading results](https://www.freeabtest.com/docs/results) describes: with one challenger the bar is 0.05; with three it is about 0.0167. That keeps A/B/n false positives under control, and it also means each comparison needs a larger sample. At a 3% baseline and 20% MDE, splitting 5% across 2 challengers raises the fixed-sample planning estimate from 13,914 to about 16,850 per variant, so a 3-variant test needs about 50,550 visitors instead of 27,828 for a plain A/B test.

On our [free plan](https://www.freeabtest.com/pricing), tests have a control and 1 variation, so this does not come up. Keep the Free traffic cap in mind too (10,000 tested visitors a month, up to 300 a day): at 300 tested visitors a day, the 27,828-visitor test in the example above would take about 93 days, so on Free, test bigger changes or more frequent goals. Paid plans allow up to 50 variations, and our advice is to add variants only when your traffic can pay for them. If you are still choosing a tool, our comparison of the [best free A/B testing tools](https://www.freeabtest.com/blog/best-free-ab-testing-tools) covers the options and their limits.

## How do I read the result when the test ends?

When the sequential verdict is significant, or when your planned sample is reached:

1. **Check the split.** If you set 50/50 and got 52/48 on large numbers, something may be wrong with assignment or tracking. freeabtest.com shows a sample ratio mismatch (SRM) warning when traffic does not split the way you set it (on every plan, including Free). Investigate before reading results. If you built the test yourself, our guide to [A/B testing with plain JavaScript](/blog/ab-test-javascript) includes the same split check.
2. **Read the interval and chance to beat control, not just the p-value.** Our results show a Wilson score interval for each variant. For example, 60 conversions from 2,000 visitors is 3.0%, with a 95% interval from 2.34% to 3.84%. If the intervals for control and variant overlap heavily, the lift is uncertain even if the point estimates differ. Chance to beat control appears once both versions have 100 visitors.
3. **Don't stop at the 100-visitor gate.** Our dashboard shows "Collecting data" until every variation has at least 100 visitors. That is the point where a significance test can start, not the point where your test is done. Prefer at least one full week, and use your planned sample size as a planning estimate for how long to expect.
4. **Decide.** If the sequential test is significant and the lift is big enough to matter for your business, you can stop and ship it. If you reach the planned sample with no significant difference, the test is inconclusive at the MDE you chose. That is a result too. It tells you the change probably does not have an effect as large as your MDE.

## A pre-launch checklist for test duration

- Write down the baseline rate from the last 4 weeks of real data.
- Choose the MDE based on what is worth shipping, not on what you hope for.
- Calculate visitors per variant, multiply by the number of variants.
- Divide by weekly traffic to the tested page (not the whole site). Round up to whole weeks, minimum 2.
- If the answer is longer than you are willing to wait, change the test before launch: a bigger change, a more frequent goal, or fewer variants.
- Put a review date in your calendar from your planning estimate. On freeabtest.com you can also stop when the sequential verdict is significant, after at least one full week.

When the numbers work, the [quick start](https://www.freeabtest.com/docs/quick-start) walks you from sign-in to a running test in about 15 minutes.

## Frequently asked questions

**How long should an A/B test run?**
Use a sample size calculated before launch as a planning estimate, round up to whole weeks, and never run less than 2 weeks. On freeabtest.com you can also stop earlier once the peeking-safe sequential verdict is significant. Divide total visitors needed by weekly traffic to the tested page for the planning estimate.

**Can I stop an A/B test as soon as it is significant?**
Not with a standard fixed-sample z-test. In our simulation of 4,000 tests with no real difference, checking every day for 20 days produced a false winner 24.5% of the time, compared with 4.7% when checking once at the end. freeabtest.com uses a peeking-safe sequential test on all plans, so you can stop when that verdict is significant. Still run at least one full week.

**How many visitors do I need for an A/B test?**
At a 3% conversion rate, 95% confidence and 80% power: about 13,914 per variant to detect a 20% relative lift, and 53,211 per variant for a 10% lift.

**What is the minimum length of an A/B test?**
Two full weeks is a common minimum, because behavior varies by day of week and novelty effects take time to fade.

**What if my test would take months?**
Test a bigger change, measure a more frequent goal, or send more traffic to the page. If none of those are possible, use research methods such as user interviews instead of an A/B test for that question.

The calculations in this article come from a short Python script using the standard normal approximation for two proportions, the formula shown near the top. You can plug your own baseline and lift into it, or into Evan Miller's calculator, and get the same answers to within a visitor or two. Other calculators can differ slightly because some use a different formula or round differently. If your numbers differ a lot, check whether you entered the MDE as a relative lift (20% of 3%) or an absolute one (20 points), because mixing the two is the most common source of errors.
