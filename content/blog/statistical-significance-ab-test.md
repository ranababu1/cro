---
title: "What statistical significance means in an A/B test"
meta_description: "A significant A/B test result means a gap this big would be rare if the versions converted the same. What a p-value tells you, what it doesn't, with examples."
slug: statistical-significance-ab-test
date: 2026-10-25
updated: 2026-10-29
author: "Imraan, freeabtest.com"
keywords: ["statistical significance a/b test", "p value ab test", "ab test significance explained", "what does 95% significance mean", "false positive risk"]
article_schema: |
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "What statistical significance means in an A/B test",
    "datePublished": "2026-10-25",
    "dateModified": "2026-10-29",
    "mainEntityOfPage": "https://www.freeabtest.com/blog/statistical-significance-ab-test",
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
      {"@type": "ListItem", "position": 3, "name": "What statistical significance means in an A/B test", "item": "https://www.freeabtest.com/blog/statistical-significance-ab-test"}
    ]
  }
faq_schema: |
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {"@type": "Question", "name": "What does statistical significance mean in an A/B test?",
       "acceptedAnswer": {"@type": "Answer", "text": "It means the gap between the versions is bigger than random variation would usually produce if both versions really converted at the same rate. At the usual 5% level, a test with no real difference will still show a significant result about 1 time in 20. It does not tell you how big the lift is or whether it is worth shipping."}},
      {"@type": "Question", "name": "Does 95% significance mean there is a 95% chance the variant is better?",
       "acceptedAnswer": {"@type": "Answer", "text": "No. 95% describes the false positive rate you accept when there is no real difference, not the chance your variant wins. The share of significant wins that are false depends on how many of your ideas work. Kohavi, Deng and Vermeer (KDD 2022) estimate it at 22% when 1 idea in 10 works, even with 80% power."}},
      {"@type": "Question", "name": "What p-value is significant for an A/B test?",
       "acceptedAnswer": {"@type": "Answer", "text": "Most teams use p below 0.05 for a test with one variant. With several variants the bar should drop: freeabtest.com divides 0.05 by the number of variants compared with the control, so three variants need p below about 0.0167. For risky or surprising changes, a stricter bar such as 0.01 is reasonable."}},
      {"@type": "Question", "name": "Why is my A/B test not significant even though the variant is ahead?",
       "acceptedAnswer": {"@type": "Answer", "text": "Usually the sample is too small for the size of the gap. In our example, 3.0% against 3.6% gives p = 0.45 with 1,000 visitors per version and p = 0.018 with 10,000. Keep the test running to its planned sample, or accept that the effect is smaller than your test can detect."}},
      {"@type": "Question", "name": "Can a statistically significant result be too small to matter?",
       "acceptedAnswer": {"@type": "Answer", "text": "Yes. With 1,000,000 visitors per version, 3.00% against 3.06% is significant (p = 0.013), but the interval for the gap runs from 0.01 to 0.11 points. Decide before launch what lift is worth shipping, and judge the result against that, not against the p-value alone."}},
      {"@type": "Question", "name": "Can I check significance every day?",
       "acceptedAnswer": {"@type": "Answer", "text": "Not with a standard fixed-sample z-test, because repeated checks inflate false winners. freeabtest.com uses a peeking-safe sequential test on every plan, so the p-value stays valid however often you look. Still run at least one full week."}}
    ]
  }
---

By Imraan, freeabtest.com. Published 25 October 2026. Updated 29 October 2026.

A statistically significant A/B test result means the gap between your versions is larger than chance would usually produce if they really converted at the same rate. At the standard 5% level, it does not mean there is a 95% chance your variant is better, and it says nothing about whether the lift is big enough to ship.

That gap between what significance sounds like and what it says is where most bad test decisions start. This article explains the idea in plain terms, then shows what it looks like with real numbers. We ran every calculation ourselves in Python with NumPy and SciPy (the script is described at the end), using a two-proportion z-test, the same test most A/B calculators use for a single look at the data.

## What does statistically significant mean in an A/B test?

Statistical significance is a verdict that the observed difference would be unlikely if there were no real difference. It comes from a p-value compared with a threshold you set before the test.

Three terms do the work:

- **Null hypothesis.** The null hypothesis is the assumption that both versions have the same true conversion rate. The test asks how surprising your data would be if that were true.
- **P-value.** The p-value is the probability of seeing a difference at least as large as yours if the null hypothesis were true. A p-value of 0.02 means a gap this big, or bigger, would turn up about 2% of the time between two identical pages.
- **Significance level (alpha).** Alpha is the false positive rate you accept when there is no real difference. The common choice is 0.05. A result is called significant when p is below alpha.

So "significant at 5%" is a statement about the test procedure: if you ran many tests where nothing changed, about 5% of them would still be called significant. It is a guard against fooling yourself with noise, and a limited one.

## What does a significant result look like with real numbers?

Say your control converts 300 of 10,000 visitors (3.0%) and the variant converts 360 of 10,000 (3.6%). That is a 20% relative lift, or 0.6 percentage points.

| Measure | Control | Variant |
|---|---|---|
| Visitors | 10,000 | 10,000 |
| Conversions | 300 | 360 |
| Conversion rate | 3.00% | 3.60% |
| 95% Wilson interval for the rate | 2.68% to 3.35% | 3.25% to 3.98% |

The z-test gives z = 2.375 and p = 0.0175, so the result is significant at the 5% level. The 95% interval for the difference runs from 0.10 to 1.10 points. That interval is the more useful part: the true lift could be as small as a tenth of a point or as large as about a full point. Both ends are consistent with this data.

Notice that the two rate intervals overlap (3.25% to 3.35%) even though the difference is significant. Overlapping intervals for each rate do not mean "no difference". The interval for the difference itself is what you check.

## Why does the same lift become significant with more visitors?

Significance depends on the size of the gap and on how much data you have. Here is the same 3.0% against 3.6% at different sample sizes, per version:

| Visitors per version | Conversions (control vs variant) | p-value | 95% interval for the difference | Significant at 5%? |
|---|---|---|---|---|
| 1,000 | 30 vs 36 | 0.453 | -0.97 to 2.17 points | No |
| 2,500 | 75 vs 90 | 0.235 | -0.39 to 1.59 points | No |
| 5,000 | 150 vs 180 | 0.093 | -0.10 to 1.30 points | No |
| 10,000 | 300 vs 360 | 0.018 | 0.10 to 1.10 points | Yes |
| 20,000 | 600 vs 720 | 0.0008 | 0.25 to 0.95 points | Yes |

The observed rates are identical in every row. Only the amount of evidence changes. At 1,000 visitors per version, the interval runs from a loss of almost a point to a gain of over 2 points, so the data cannot tell the versions apart.

This is why "not significant" rarely means "no effect". It usually means "not enough data to tell", which is why you work out the sample size before launch. Our guide to [A/B test sample size](https://www.freeabtest.com/blog/ab-test-sample-size) shows how many visitors a given lift needs, with a calculator, and our guide to [how long to run an A/B test](https://www.freeabtest.com/blog/how-long-to-run-an-ab-test) turns that into weeks. If your traffic is small, our guide to [A/B testing with low traffic](https://www.freeabtest.com/blog/ab-testing-low-traffic) covers what you can still learn.

## What does a p-value not tell you?

In 2016 the American Statistical Association published a [statement on statistical significance and p-values](https://www.amstat.org/asa/files/pdfs/p-valuestatement.pdf) with six principles, written because the same misreadings kept appearing in published research. Three of them apply directly to A/B tests: p-values do not measure the probability that a hypothesis is true, business decisions should not rest only on whether p crosses a threshold, and a p-value does not measure the size or importance of an effect.

Here are the misreadings we see most in A/B testing, set against what a p-value of 0.03 actually supports:

| Common reading of p = 0.03 | What it actually means |
|---|---|
| "There's a 97% chance the variant is better." | No. If the versions were identical, a gap this large would show up about 3% of the time. The chance the variant is better depends on other things too, including how often your ideas work. |
| "There's a 3% chance this result is a fluke." | No. That figure is the false positive risk, and it is usually much higher than the p-value (see the next section). |
| "The lift is large." | Not implied. Huge samples make tiny lifts significant. |
| "A test with p = 0.20 proved the change does nothing." | No. It failed to show a difference. The interval tells you which effects are still plausible. |
| "p = 0.049 is a win and p = 0.051 is a loss." | The evidence in those two results is nearly the same. The threshold is a decision rule, not a law of nature. |

## If a test is significant, how likely is it that the win is real?

Less likely than most people assume, and the answer depends on your success rate: the share of ideas you test that truly improve the metric.

False positive risk is the probability that a statistically significant result is a false positive. Ron Kohavi, Alex Deng and Lukas Vermeer work through it in [A/B Testing Intuition Busters](https://exp-platform.com/abtestingintuitionbusters/) (KDD 2022) using Bayes' rule, a 0.05 threshold (0.025 in the winning direction, since only improvements count as wins) and 80% power. Their table uses success rates published by large companies:

| Organization (as reported in the paper) | Success rate | False positive risk |
|---|---|---|
| Microsoft | 33% | 5.9% |
| Bing | 15% | 15.0% |
| Booking.com, Google Ads, Netflix | 10% | 22.0% |
| Airbnb search | 8% | 26.4% |

Read the Booking.com row this way: if 1 idea in 10 really works and every test is properly powered, then about 1 in 5 significant wins is still false. Our own run of the same formula gives the same 22.0% at a 10% success rate and 11.1% at 20%.

Small teams usually run tests with less than 80% power, and lower power pushes the false positive risk higher. The paper's advice is to replicate surprising results and to use a lower p-value threshold for claims that look too good. A 300% lift on a button test should make you suspicious, not excited.

## Why do significant results overstate the lift?

When a test is underpowered, the results that happen to clear the bar are the ones where chance pushed the gap upward. So the average significant result exaggerates the true effect.

We simulated this. We ran 10,000 tests where the variant truly lifted conversion from 3.0% to 3.6% (a real 20% lift), with 10,000 visitors per version and one look at the end. That setup has 66% power, a little below the usual 80%.

| What we measured (10,000 simulated tests, true lift 20%) | Result |
|---|---|
| Tests that reached significance in the right direction | 66.2% |
| Average observed lift among the significant tests | 25.4% |

A third of the tests missed a real 20% lift, and the ones that caught it reported 25% on average. Expect the lift you see after launch to be smaller than the lift in the test, and plan your business case around the lower end of the interval, not the point estimate.

## How often does a test with no real difference come out significant?

About 5% of the time at a 5% threshold, if you look once. We simulated 10,000 A/A tests (both versions at the same 3% rate, 10,000 visitors each, one look at the end):

| Threshold | Share of A/A tests called significant |
|---|---|
| p < 0.05 | 5.03% |
| p < 0.01 | 1.10% |

The p-values were spread evenly from 0 to 1, which is what a correct test produces when there is no effect. That 5% only holds under two conditions.

**You look once.** With a fixed-sample z-test, checking every day and stopping at the first p below 0.05 inflates false winners. In our [test duration simulation](https://www.freeabtest.com/blog/how-long-to-run-an-ab-test), daily checks over 20 days pushed the false winner rate from 4.7% to 24.5%. A separate article on the peeking problem is planned.

**You test one comparison.** Each extra variant is another chance to find a false winner. Without a correction, the chance that at least one of several variants "beats" an identical control by luck grows quickly:

| Variants compared with the control | Chance of at least 1 false winner at p < 0.05 each | Corrected bar (0.05 divided by variants) |
|---|---|---|
| 1 | 5.0% | 0.05 |
| 2 | 9.8% | 0.025 |
| 3 | 14.3% | 0.0167 |
| 4 | 18.5% | 0.0125 |

The same logic applies to goals. If you track 10 goals and call a winner on whichever one is significant, you are running 10 tests. Pick one primary goal before launch.

## How does freeabtest.com decide a result is significant?

We use a peeking-safe sequential test on every plan, including Free. A sequential test is a significance test whose p-value stays valid however often you check, so you can look at results daily and stop when the verdict is significant. As our [guide to reading results](https://www.freeabtest.com/docs/results) puts it, the chance of calling a winner that is not real stays at 5% or less. The specific test is a mixture sequential probability ratio test.

The rest of the rules, all on the results page:

- **Bonferroni correction.** A result is significant when p is below 0.05 divided by the number of variants compared with the control. With one variant the bar is 0.05; with three it is about 0.0167.
- **100-visitor minimum.** Significance is only tested once every variation has at least 100 visitors. Until then the dashboard shows "Collecting data".
- **Wilson intervals.** Every conversion rate shows a 95% Wilson score interval, which stays accurate at small samples and rates near 0%.
- **Chance to beat control.** Shown once the variation and the control both have 100 visitors. It moves quickly with small samples, so use the significance verdict to decide.
- **Fixed-sample z-test on request.** The results API still returns a classic z-test under `statistical_significance` if you plan a single look in advance.

The trade-off is sample size. For the same observed difference, the sequential test needs about 2 to 3 times as many visitors as a single-look z-test, though it lets you stop sooner when the real lift is bigger than you planned for. On our [free plan](https://www.freeabtest.com/pricing), tests compare a control with 1 variation, with up to 10,000 tested visitors a month, so the Bonferroni split does not come up there. Paid plans allow up to 50 variations.

## How should you use significance to make a decision?

Treat significance as one gate out of several. A sequence that works:

1. **Before launch, write down three numbers:** the primary goal, the smallest lift worth shipping, and the sample size or minimum duration. Fixing these first stops you from moving the goalposts later.
2. **Check the traffic split.** If you set 50/50 and the counts are far off, the test is broken. freeabtest.com shows a sample ratio mismatch warning on every plan.
3. **Check significance on the primary goal.** If it is not significant at your planned sample, the result is inconclusive at the lift you chose. That is a real answer: the change probably does not have an effect that large.
4. **Read the interval for the lift.** Ask whether the low end is still worth shipping. A significant result with an interval from 0.01 to 0.11 points may not cover the cost of the change.
5. **Be stricter with surprises.** A lift far larger than anything you have seen before is more likely to be a bug or a fluke. Rerun it.

Here is how much the interval matters. With 1,000,000 visitors per version, 3.00% against 3.06% gives p = 0.013, which is significant. The interval for the gap runs from 0.01 to 0.11 points. Whether that is worth anything depends on your revenue per conversion, not on the p-value. A separate article on reading confidence intervals instead of a single winner number is planned.

When you are ready to try it, the [quick start](https://www.freeabtest.com/docs/quick-start) takes you from sign-in to a running test in about 15 minutes.

## Frequently asked questions

**What does statistical significance mean in an A/B test?**
It means the gap between the versions is bigger than random variation would usually produce if both versions really converted at the same rate. At the usual 5% level, a test with no real difference will still show a significant result about 1 time in 20. It does not tell you how big the lift is or whether it is worth shipping.

**Does 95% significance mean there is a 95% chance the variant is better?**
No. 95% describes the false positive rate you accept when there is no real difference, not the chance your variant wins. The share of significant wins that are false depends on how many of your ideas work. Kohavi, Deng and Vermeer (KDD 2022) estimate it at 22% when 1 idea in 10 works, even with 80% power.

**What p-value is significant for an A/B test?**
Most teams use p below 0.05 for a test with one variant. With several variants the bar should drop: freeabtest.com divides 0.05 by the number of variants compared with the control, so three variants need p below about 0.0167. For risky or surprising changes, a stricter bar such as 0.01 is reasonable.

**Why is my A/B test not significant even though the variant is ahead?**
Usually the sample is too small for the size of the gap. In our example, 3.0% against 3.6% gives p = 0.45 with 1,000 visitors per version and p = 0.018 with 10,000. Keep the test running to its planned sample, or accept that the effect is smaller than your test can detect.

**Can a statistically significant result be too small to matter?**
Yes. With 1,000,000 visitors per version, 3.00% against 3.06% is significant (p = 0.013), but the interval for the gap runs from 0.01 to 0.11 points. Decide before launch what lift is worth shipping, and judge the result against that, not against the p-value alone.

**Can I check significance every day?**
Not with a standard fixed-sample z-test, because repeated checks inflate false winners. freeabtest.com uses a peeking-safe sequential test on every plan, so the p-value stays valid however often you look. Still run at least one full week.

All figures in this article come from a short Python script using a pooled two-proportion z-test for p-values, an unpooled normal interval for the difference, Wilson score intervals for each rate, and simulations of 10,000 tests with a fixed random seed. You can reproduce the single-test numbers in any standard A/B significance calculator by entering the same visitors and conversions; small differences in the last decimal place come from rounding or from calculators that use a different version of the test. The false positive risk table is taken from Kohavi, Deng and Vermeer, and our own run of their formula matches it.
