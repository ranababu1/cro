---
title: "The peeking problem: why daily checks create false winners"
meta_description: "Checking an A/B test daily and stopping at the first p < 0.05 turned 5% false winners into 27% in our simulation. Why peeking breaks tests, and 3 safe fixes."
slug: ab-test-peeking-problem
date: 2026-11-01
updated: 2026-11-01
author: "Imraan, freeabtest.com"
keywords: ["a/b test peeking", "peeking problem", "stopping ab test early", "optional stopping", "sequential testing ab test", "checking ab test results daily"]
article_schema: |
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "The peeking problem: why daily checks create false winners",
    "datePublished": "2026-11-01",
    "dateModified": "2026-11-01",
    "mainEntityOfPage": "https://www.freeabtest.com/blog/ab-test-peeking-problem",
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
      {"@type": "ListItem", "position": 3, "name": "The peeking problem: why daily checks create false winners", "item": "https://www.freeabtest.com/blog/ab-test-peeking-problem"}
    ]
  }
faq_schema: |
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {"@type": "Question", "name": "What is peeking in an A/B test?",
       "acceptedAnswer": {"@type": "Answer", "text": "Peeking is checking a fixed-sample A/B test before its planned end and stopping, or deciding, as soon as it looks significant. A standard z-test assumes you look once. Every extra look is another chance for random noise to cross the 5% bar, so the real false winner rate climbs well above 5%."}},
      {"@type": "Question", "name": "How much does peeking increase false positives?",
       "acceptedAnswer": {"@type": "Answer", "text": "In our simulation of 10,000 A/A tests over 28 days, stopping at the first p below 0.05 gave false winners 5.1% of the time with one look, 12.5% with weekly looks, 27.4% with daily looks and 48.4% with hourly looks. The exact numbers depend on traffic and test length, but the pattern is always the same: more looks, more false winners."}},
      {"@type": "Question", "name": "Is it OK to look at A/B test results before the test ends?",
       "acceptedAnswer": {"@type": "Answer", "text": "Looking is fine. Deciding is the problem. With a fixed-sample test you can check for bugs, a broken traffic split or a version that is clearly hurting the business, but you should only call a winner at the planned sample size. With a sequential test built for repeated looks, you can stop whenever its verdict is significant."}},
      {"@type": "Question", "name": "Can I stop an A/B test early if it is significant?",
       "acceptedAnswer": {"@type": "Answer", "text": "Only if the test was designed for it. A group sequential plan, such as O'Brien-Fleming bounds at planned weekly looks, or an always-valid sequential test such as a mixture SPRT, keeps false winners near 5% when you stop early. With a standard z-test, an early significant result is not reliable."}},
      {"@type": "Question", "name": "Does peeking make the lift look bigger?",
       "acceptedAnswer": {"@type": "Answer", "text": "Yes. Tests that stop early stop because chance pushed the gap up. In our simulation of a real 10% lift, daily peeking with a z-test reported an average lift of 20.8% among winners, and winners stopped in the first week reported 32.3%. Expect the lift after launch to be smaller than an early stop suggests."}},
      {"@type": "Question", "name": "Does freeabtest.com protect against peeking?",
       "acceptedAnswer": {"@type": "Answer", "text": "Yes. Every plan, including Free, uses a peeking-safe sequential test (a mixture sequential probability ratio test) whose p-value stays valid however often you check. The trade-off is sample size: the docs say it needs about 2 to 3 times as many visitors for the same observed lift. Still run at least one full week."}}
    ]
  }
---

By Imraan, freeabtest.com. Published 1 November 2026. Sources checked 1 November 2026.

Peeking is checking a fixed-sample A/B test before it ends and stopping as soon as it looks significant, and it turns a 5% false winner rate into something far higher. In our simulation of 10,000 tests where both versions were identical, checking a standard z-test once a day for 4 weeks and stopping at the first p below 0.05 declared a winner 27.4% of the time, against 5.1% for a single look at the end.

Everyone who runs tests feels the pull to check the dashboard. That habit is not the mistake. The mistake is acting on a number that was only valid if you had looked once. This article shows how big the problem is with our own simulations, why it also inflates real wins, and the three ways to check results often without fooling yourself. We ran every number below in Python with NumPy and SciPy, and the method is described at the end.

## What is the peeking problem in A/B testing?

The peeking problem is the rise in false positives that happens when you test for significance repeatedly on growing data and stop the first time the result crosses the threshold. Statisticians also call it optional stopping or repeated significance testing.

A standard A/B significance test, the two-proportion z-test, answers one question: if both versions converted at the same rate, how often would a gap this large appear at this sample size? The 5% threshold is only correct if the sample size was fixed before the test and you check once. As visitors arrive, the test statistic drifts up and down. Even with no real difference, it often wanders past the significance line for a while and comes back. If you stop the moment it crosses, you catch every one of those passing moments as a "winner".

This is not new. Peter Armitage, C. K. McPherson and B. C. Rowe described it for clinical trials in [Repeated Significance Tests on Accumulating Data](https://doi.org/10.2307/2343787) (Journal of the Royal Statistical Society, Series A, 1969). For web tests, Evan Miller's [How Not To Run an A/B Test](https://www.evanmiller.org/how-not-to-run-an-ab-test.html) (2010) is the standard explanation. His example, checking after every visitor for up to 150 visitors, gives a 26.1% false positive rate. His advice is blunt: fix the sample size in advance and wait.

## How much does peeking inflate false winners?

We simulated 10,000 A/A tests, where both versions convert at exactly 5.0%. Each version got 42 visitors an hour (about 1,008 a day) for 28 days, so about 28,224 visitors per version at the end. We only tested once each version had 100 visitors, the same minimum freeabtest.com uses, and stopped the first time the two-sided p-value fell below 0.05.

| How often you check | Looks in 28 days | Tests that declared a false winner |
|---|---|---|
| Once, at day 28 | 1 | 5.1% |
| Twice (day 14 and day 28) | 2 | 8.1% |
| Weekly | 4 | 12.5% |
| Daily | 28 | 27.4% |
| Every hour | 672 | 48.4% |

A single look behaves as promised: 5.1%, which is 5% plus simulation noise. Checking twice already pushes it past 8%. Checking every hour and stopping at the first green number makes almost every other identical test look like a win.

The rise is steep at first and then slows. With 5 evenly spaced looks we got 14.2%, with 10 looks 19.1% and with 20 looks 24.6%. In theory it never stops rising: with enough looks, a test with no real difference will eventually cross any fixed threshold. Our earlier simulation for [how long to run an A/B test](https://www.freeabtest.com/blog/how-long-to-run-an-ab-test) used different traffic (250 visitors a day per version) and found a similar 24.5% with daily checks over 20 days. The setup changes the exact figure, not the pattern.

## When do false winners show up?

Early. Of the false winners from daily checks, 59.9% stopped in the first week, 19.4% in the second, 12.2% in the third and 8.5% in the fourth. Small samples swing the most, so the first days produce the most crossings.

Most of those winners would not have survived. Only 18.5% of the tests that daily checking called a false winner were still significant on day 28. The other 81.5% had faded back inside the noise by the planned end. This is the familiar pattern of a "winner" on day 3 that is flat by day 14. It was never a winner.

## Does peeking also distort real wins?

Yes, in a way that is easy to miss. We ran a second set of 10,000 tests where the variant really converts better: 5.5% against 5.0%, a true relative lift of 10%. Same traffic, same 28 days.

| Method | Caught the real lift (right direction) | Called the loser a winner | Average lift reported by winners | Median day it stopped |
|---|---|---|---|---|
| z-test, one look at day 28 | 75.4% | 0.00% | 11.7% | 28 |
| z-test, checked daily, stop at first p < 0.05 | 85.0% | 1.18% | 20.8% | 9 |

At first glance daily peeking looks better: it catches the lift more often and finishes three weeks sooner. Look at the other columns. In 1.18% of tests it crowned the version that is actually worse, which a single look never did in our runs. And the winners reported an average lift of 20.8%, about double the real 10%. Winners that stopped in the first week, 45.1% of all daily-peek winners, reported 32.3% on average.

The reason is the same as before. A test that stops early stops because chance pushed the gap up on that day. So the lifts you see at early stops are the lucky ones. If you plan revenue or the next test around a 32% lift that is really 10%, the decision is wrong even though the direction was right.

Even the single look overstates the lift a little (11.7% against a true 10%), because underpowered tests only reach significance when the gap happens to be large. Our explainer on [what statistical significance means](https://www.freeabtest.com/blog/statistical-significance-ab-test) covers that effect in detail.

## How do you check results often without fooling yourself?

There are three sound approaches. They differ in how often you may look and what they cost in visitors.

**1. Fix the sample size and decide once.** Work out the visitors you need before launch, then decide only at that point. For this example (5.0% baseline, 10% lift, 95% confidence, 80% power) that is 31,234 visitors per version, or about 31 days at 1,008 a day. Our guide to [A/B test sample size](https://www.freeabtest.com/blog/ab-test-sample-size) shows the formula and a calculator. You can still open the dashboard to catch bugs. You just do not act on the p-value until the end.

**2. Plan a few looks with stricter bars (group sequential testing).** Decide in advance how many interim looks you will take, and use a stricter threshold at each one so the total false positive rate stays at 5%. Stuart Pocock introduced equal bars at each look in [Group sequential methods in the design and analysis of clinical trials](https://doi.org/10.1093/biomet/64.2.191) (Biometrika, 1977). Peter O'Brien and Thomas Fleming proposed bars that are very strict early and close to normal at the end in [A Multiple Testing Procedure for Clinical Trials](https://doi.org/10.2307/2530245) (Biometrics, 1979). Evan Miller's [Simple Sequential A/B Testing](https://www.evanmiller.org/sequential-ab-testing.html) describes a simpler sequential rule based on counting conversions.

For 4 weekly looks, these are the standard bars we used, written as z-scores and two-sided p-values:

| Look | Pocock bar | O'Brien-Fleming bar |
|---|---|---|
| Week 1 | z above 2.361 (p < 0.018) | z above 4.048 (p < 0.00005) |
| Week 2 | z above 2.361 (p < 0.018) | z above 2.862 (p < 0.004) |
| Week 3 | z above 2.361 (p < 0.018) | z above 2.337 (p < 0.019) |
| Week 4 | z above 2.361 (p < 0.018) | z above 2.024 (p < 0.043) |
| False winners in our 10,000 A/A tests | 5.2% | 5.1% |

O'Brien-Fleming bars are often preferred because they almost never stop in week 1 on noise, yet cost very little at the end. On the real 10% lift it caught 74.5% of tests (against 75.4% for a single look), with a median stop on day 21 and an average reported lift of 13.0%.

**3. Use an always-valid sequential test.** An always-valid p-value is a p-value that stays correct however often you check and whenever you stop. Ramesh Johari, Leo Pekelis and David Walsh describe one, built on a mixture sequential probability ratio test (mSPRT), in [Always Valid Inference: Bringing Sequential Analysis to A/B Testing](https://arxiv.org/abs/1512.04922). Their abstract states that ordinary p-values are "wholly unreliable" when people continuously monitor tests and choose when to stop.

We ran our own mSPRT on the same A/A tests and checked it every hour, all 672 looks. It declared a false winner in 2.8% of tests, below the 5% limit. The price is sample size:

| Day | Visitors per version | Real 10% lift caught by our mSPRT, checked hourly |
|---|---|---|
| 14 | 14,112 | 23.1% |
| 28 | 28,224 | 47.9% |
| 42 | 42,336 | 67.9% |
| 56 | 56,448 | 82.1% |
| 84 | 84,672 | 96.0% |

(These come from a separate run of 5,000 tests over 84 days, which is why day 28 reads 47.9% here and 47.4% in our 28-day run.) Our mSPRT needed about 56 days to catch the lift 80% of the time, against 31 days for a single planned look, so about 1.8 times the visitors. The exact factor depends on how the test is tuned. We used a mixing distribution with a standard deviation of 1 percentage point, which is our choice for this simulation. Winners that stop early still overstate the lift: our mSPRT winners reported 20.4% on average by day 28. Being valid under peeking protects the yes-or-no verdict, not the size estimate.

## Which approach should you use?

| Approach | How often you can look | False winners | Cost in visitors | Best for |
|---|---|---|---|---|
| Standard z-test, peeking | Any time | 12.5% (weekly) to 48.4% (hourly) in our runs | None | Never use for decisions |
| Fixed sample, one decision | Look any time, decide once | 5% | Baseline | Teams who can wait for the planned end |
| Group sequential (O'Brien-Fleming) | A few planned looks | 5% | Small | Weekly reviews with a set plan |
| Always-valid sequential (mSPRT) | Any time | 5% or less | About 1.8 times in our run, 2 to 3 times for the same observed lift per our docs | Dashboards people check daily |

Two habits matter whichever method you pick. Run whole weeks, because weekday and weekend visitors behave differently and an early stop can catch only one kind. And pick one primary goal before launch. Checking 10 goals and stopping on whichever one turns green is peeking across goals instead of across days.

## What counts as peeking, and what is fine?

Looking is not the problem. Acting on an invalid number is. With a fixed-sample test, these are fine at any time:

- Checking that both versions get traffic and that a 50/50 split is close to 50/50. A sample ratio mismatch is a bug, not a result.
- Checking that conversions are being recorded at all.
- Stopping a version that is clearly breaking something, such as a checkout error or a sharp drop in signups. That is a safety stop, and you do not call a winner from it.

These are peeking, and they inflate false results:

- Stopping because p dipped below 0.05 before the planned sample.
- Extending a test past its plan because it is "almost significant". Adding data until it crosses the line is the same optional stopping in the other direction.
- Restarting a test, or switching to a different goal, after seeing the early numbers.

## How does freeabtest.com handle peeking?

We use a peeking-safe sequential test on every plan, including Free. Every variant is compared with the control using a mixture sequential probability ratio test. As our [guide to reading results](https://www.freeabtest.com/docs/results) puts it, you can check the dashboard every hour and stop the moment a result is significant, and the chance of calling a winner that is not real stays at 5% or less.

The other rules on the results page:

- **100-visitor minimum.** Significance is only tested once every variation has at least 100 visitors. Until then the dashboard shows "Collecting data".
- **Bonferroni correction.** With several variants, a result is significant when p is below 0.05 divided by the number of variants compared with the control.
- **Wilson intervals.** Each conversion rate shows a 95% Wilson score interval, so you can see how wide the plausible range still is.
- **Fixed-sample z-test on request.** The results API still returns a classic z-test under `statistical_significance` if you plan a single look in advance.

The cost is the one shown above. Our docs say the sequential test needs about 2 to 3 times as many visitors for the same observed lift, and it can stop sooner when the real lift is larger than you planned for. The Test planner, on every plan, shows the fixed-sample estimate and that range. Our simulation does not replace those numbers.

Traffic still decides what you can test. The [free plan](https://www.freeabtest.com/pricing) allows 10,000 tested visitors a month, up to 300 a day, with 1 running test. At 150 visitors per version a day, a 10% lift on a 5% page would take months even with a single look, so on Free the tests worth running are the ones that can move conversion a lot. Our list of [A/B test ideas for SaaS landing pages](https://www.freeabtest.com/blog/ab-test-ideas-saas-landing-pages) ranks 25 tests by the traffic each needs. When you are ready, the [quick start](https://www.freeabtest.com/docs/quick-start) gets a test running in about 15 minutes.

## Frequently asked questions

**What is peeking in an A/B test?**
Peeking is checking a fixed-sample A/B test before its planned end and stopping, or deciding, as soon as it looks significant. A standard z-test assumes you look once. Every extra look is another chance for random noise to cross the 5% bar, so the real false winner rate climbs well above 5%.

**How much does peeking increase false positives?**
In our simulation of 10,000 A/A tests over 28 days, stopping at the first p below 0.05 gave false winners 5.1% of the time with one look, 12.5% with weekly looks, 27.4% with daily looks and 48.4% with hourly looks. The exact numbers depend on traffic and test length, but the pattern is always the same: more looks, more false winners.

**Is it OK to look at A/B test results before the test ends?**
Looking is fine. Deciding is the problem. With a fixed-sample test you can check for bugs, a broken traffic split or a version that is clearly hurting the business, but you should only call a winner at the planned sample size. With a sequential test built for repeated looks, you can stop whenever its verdict is significant.

**Can I stop an A/B test early if it is significant?**
Only if the test was designed for it. A group sequential plan, such as O'Brien-Fleming bounds at planned weekly looks, or an always-valid sequential test such as a mixture SPRT, keeps false winners near 5% when you stop early. With a standard z-test, an early significant result is not reliable.

**Does peeking make the lift look bigger?**
Yes. Tests that stop early stop because chance pushed the gap up. In our simulation of a real 10% lift, daily peeking with a z-test reported an average lift of 20.8% among winners, and winners stopped in the first week reported 32.3%. Expect the lift after launch to be smaller than an early stop suggests.

**Does freeabtest.com protect against peeking?**
Yes. Every plan, including Free, uses a peeking-safe sequential test (a mixture sequential probability ratio test) whose p-value stays valid however often you check. The trade-off is sample size: the docs say it needs about 2 to 3 times as many visitors for the same observed lift. Still run at least one full week.

Every simulation in this article comes from a short Python script with a fixed random seed. Each test adds 42 visitors per version every hour for 28 days, at a true conversion rate of 5.0% for both versions (A/A) or 5.0% against 5.5% (a real 10% lift), with 10,000 runs for each set. Significance uses a pooled two-proportion z-test, two-sided, at 0.05, and nothing is tested before each version has 100 visitors. The group sequential runs apply the Pocock and O'Brien-Fleming bars shown above at days 7, 14, 21 and 28. The mSPRT follows the normal-approximation form in Johari, Pekelis and Walsh, with a normal mixing distribution with a standard deviation of 1 percentage point, and calls a result when the likelihood ratio reaches 20 (an always-valid p-value of 0.05). The 84-day mSPRT table is a separate run of 5,000 tests. Rerunning with a different seed moves the percentages by up to about a point.
