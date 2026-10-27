---
title: "A/B test sample size, explained with a calculator"
meta_description: "How many visitors an A/B test needs: about 13,914 per version for a 20% lift on a 3% rate. See how each input changes it, with tables and a free calculator."
slug: ab-test-sample-size
date: 2026-10-27
updated: 2026-10-27
author: "Imraan, freeabtest.com"
keywords: ["a/b test sample size calculator", "sample size for ab test", "minimum detectable effect", "ab test sample size formula", "how many visitors for an ab test"]
article_schema: |
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "A/B test sample size, explained with a calculator",
    "datePublished": "2026-10-27",
    "dateModified": "2026-10-27",
    "mainEntityOfPage": "https://www.freeabtest.com/blog/ab-test-sample-size",
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
      {"@type": "ListItem", "position": 3, "name": "A/B test sample size, explained with a calculator", "item": "https://www.freeabtest.com/blog/ab-test-sample-size"}
    ]
  }
faq_schema: |
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {"@type": "Question", "name": "How many visitors do I need for an A/B test?",
       "acceptedAnswer": {"@type": "Answer", "text": "At a 3% conversion rate, 95% confidence and 80% power, you need about 13,914 visitors per version to detect a 20% relative lift, so 27,828 for a plain A/B test. Detecting a 10% lift takes 53,211 per version. A higher baseline or a bigger lift needs fewer visitors."}},
      {"@type": "Question", "name": "What is a minimum detectable effect in A/B testing?",
       "acceptedAnswer": {"@type": "Answer", "text": "The minimum detectable effect (MDE) is the smallest lift your test is set up to detect with the power you chose. It is usually written as a relative lift, so a 20% MDE on a 3% baseline means detecting a change to 3.6%. Pick it from the smallest change worth shipping, not the change you hope for."}},
      {"@type": "Question", "name": "What is the formula for A/B test sample size?",
       "acceptedAnswer": {"@type": "Answer", "text": "Visitors per version = (z for confidence times the square root of 2 p-bar (1 minus p-bar), plus z for power times the square root of p1(1 minus p1) plus p2(1 minus p2)) squared, divided by (p2 minus p1) squared. At 95% confidence and 80% power the z values are 1.96 and 0.84. A quick rule of thumb is 16 p(1 minus p) divided by the absolute difference squared."}},
      {"@type": "Question", "name": "Does a 90/10 traffic split need more visitors?",
       "acceptedAnswer": {"@type": "Answer", "text": "Yes. At a 3% baseline and a 20% lift, a 50/50 split needs 27,828 visitors in total, while a 90/10 split needs 75,042, about 2.7 times as many. Use uneven splits to limit risk, and expect the test to take longer."}},
      {"@type": "Question", "name": "Do I need a bigger sample with a peeking-safe sequential test?",
       "acceptedAnswer": {"@type": "Answer", "text": "For the same observed lift, yes. freeabtest.com's sequential test needs about 2 to 3 times as many visitors as a single-look test, in exchange for a p-value that stays valid however often you check. It can also stop earlier when the real lift is bigger than you planned for."}},
      {"@type": "Question", "name": "Can I use a one-sided test to cut the sample size?",
       "acceptedAnswer": {"@type": "Answer", "text": "It cuts the sample by about 21% at 95% confidence and 80% power (13,914 to 10,960 per version in our example), but a one-sided test cannot tell you when the variant is worse. Most teams keep the two-sided default."}}
    ]
  }
---

By Imraan, freeabtest.com. Published 27 October 2026.

An A/B test needs about 13,914 visitors per version to detect a 20% relative lift on a 3% conversion rate, at 95% confidence and 80% power, so about 27,828 visitors for a plain A/B test. The smallest lift you want to detect matters more than any other input: halving it from 20% to 10% multiplies the sample by about 3.8, to 53,211 per version.

This article explains each input to a sample size calculator, shows how much each one moves the answer, and gives you a short calculator in JavaScript that you can paste into your browser console. Every number here comes from a Python script we ran with SciPy, using the standard two-proportion formula, the same one behind [Evan Miller's sample size calculator](https://www.evanmiller.org/ab-testing/sample-size.html) and the planning table in our [guide to reading results](https://www.freeabtest.com/docs/results). Our docs table lands within 2 visitors of these figures because of rounding in the z values.

## How do you calculate the sample size for an A/B test?

Sample size is the number of visitors each version needs so that a real lift of a chosen size is likely to show up as significant. You need four inputs:

- **Baseline conversion rate.** The baseline is the conversion rate your current page gets today, taken from the last few weeks of real data.
- **Minimum detectable effect (MDE).** The MDE is the smallest lift your test is set up to detect. A 20% relative MDE on a 3% baseline means detecting a change to 3.6%.
- **Significance level (alpha).** Alpha is the false positive rate you accept when there is no real difference. 5% is standard, which is the same as 95% confidence.
- **Power.** Power is the chance the test detects the MDE if the lift is real. 80% is standard, so a real lift of exactly that size is missed 1 time in 5.

The formula for visitors per version, with equal groups and a two-sided test:

**n = (z₁ × √(2p̄(1 - p̄)) + z₂ × √(p1(1 - p1) + p2(1 - p2)))² ÷ (p2 - p1)²**

Here p1 is the baseline, p2 is the baseline after the lift, p̄ is their average, z₁ is 1.96 for 95% confidence (two-sided) and z₂ is 0.84 for 80% power. For a 3% baseline and a 20% MDE, p1 = 0.03 and p2 = 0.036, which gives 13,914 visitors per version after rounding up.

To turn that into time, multiply by the number of versions and divide by the daily visitors to the tested page. At 1,500 visitors a day, 27,828 visitors takes 18.6 days, so plan for 3 full weeks. Our guide to [how long to run an A/B test](https://www.freeabtest.com/blog/how-long-to-run-an-ab-test) covers the duration side in more depth, including why you should run whole weeks.

## Which input changes the sample size the most?

The MDE, by a wide margin. The sample grows with the square of 1 divided by the difference, so small MDEs get expensive fast. Here is a 3% baseline at 95% confidence and 80% power:

| MDE (relative) | Rate you are trying to detect | Visitors per version | Total for an A/B test |
|---|---|---|---|
| 5% | 3.15% | 207,938 | 415,876 |
| 10% | 3.30% | 53,211 | 106,422 |
| 15% | 3.45% | 24,193 | 48,386 |
| 20% | 3.60% | 13,914 | 27,828 |
| 30% | 3.90% | 6,455 | 12,910 |
| 50% | 4.50% | 2,518 | 5,036 |

Going from a 20% MDE to a 5% MDE multiplies the sample by about 15. If your traffic can only support one row of this table, that row tells you how big a change you need to test.

The baseline matters too. For the same 20% relative lift, a lower baseline needs more visitors:

| Baseline | 20% lift means | Visitors per version |
|---|---|---|
| 1% | 1.0% to 1.2% | 42,693 |
| 2% | 2.0% to 2.4% | 21,109 |
| 3% | 3.0% to 3.6% | 13,914 |
| 5% | 5.0% to 6.0% | 8,158 |
| 10% | 10% to 12% | 3,841 |
| 20% | 20% to 24% | 1,683 |

This is one reason to measure a goal that happens often. A click on "Start free trial" might convert at 10% where completed signups convert at 2%, and the click test needs about a fifth of the visitors for the same relative lift.

## Is your MDE relative or absolute?

Most calculators let you enter the MDE either way, and mixing them up is the most common sample size mistake. A relative MDE is a percentage of the baseline: 20% of 3% is 0.6 points, so the target is 3.6%. An absolute MDE is in percentage points: 20 points on 3% would mean detecting a jump to 23%.

At a 3% baseline, "20%" read as relative needs 13,914 visitors per version. Read as 20 absolute points, it needs 44. If a calculator gives you a number that looks too good to be true, check this first.

Relative lifts also hide something. The same absolute change of 0.6 points needs a very different sample depending on the baseline:

| Baseline | 0.6-point lift as a relative lift | Visitors per version |
|---|---|---|
| 1% | 60% | 5,594 |
| 3% | 20% | 13,914 |
| 5% | 12% | 21,885 |
| 10% | 6% | 40,286 |
| 20% | 3% | 70,548 |

Conversion counts are noisier near 50% than near 0%, so the same point change is harder to see on a page that already converts well.

## What happens if you change confidence, power or test one side?

Each of these trades certainty for visitors. The table holds the 3% baseline and 20% MDE fixed:

| Confidence (alpha) | Power | Two-sided, per version | One-sided, per version |
|---|---|---|---|
| 90% (0.10) | 80% | 10,960 | 7,991 |
| 90% (0.10) | 90% | 15,181 | 11,645 |
| 95% (0.05) | 80% | 13,914 | 10,960 |
| 95% (0.05) | 90% | 18,626 | 15,181 |
| 99% (0.01) | 80% | 20,704 | 17,791 |
| 99% (0.01) | 90% | 26,377 | 23,075 |

Raising power from 80% to 90% adds 34% more visitors. Moving from 95% to 99% confidence adds 49%. A one-sided test saves about 21% at the standard settings, but it only looks for a lift, so it cannot warn you when the variant is worse. We keep the two-sided defaults and change the MDE instead, because that is the input you can reason about in business terms.

## How do more variants and uneven splits change the sample?

Every extra version needs its own share of traffic. On top of that, testing several variants against one control raises the chance of a false winner, so the significance bar should drop. freeabtest.com divides 0.05 by the number of variants compared with the control (a Bonferroni correction), as our [guide to reading results](https://www.freeabtest.com/docs/results) explains. Each comparison then needs more visitors:

| Variants compared with the control | Significance bar | Visitors per version | Total visitors |
|---|---|---|---|
| 1 | 0.05 | 13,914 | 27,828 |
| 2 | 0.025 | 16,850 | 50,550 |
| 3 | 0.0167 | 18,559 | 74,236 |
| 4 | 0.0125 | 19,768 | 98,840 |

Going from an A/B test to an A/B/C/D/E test multiplies the total by about 3.6. Add a variant only when you have a real reason to think it could win.

Uneven splits cost visitors too. Sending only 10% of traffic to the variant limits risk, but the small group sets the pace:

| Control share | Control visitors | Variant visitors | Total |
|---|---|---|---|
| 50% | 13,914 | 13,914 | 27,828 |
| 60% | 17,269 | 11,513 | 28,782 |
| 70% | 22,858 | 9,797 | 32,655 |
| 80% | 34,030 | 8,508 | 42,538 |
| 90% | 67,537 | 7,505 | 75,042 |

A 70/30 split costs only 17% more than 50/50. A 90/10 split costs 170% more. If you want to limit risk early, a better option is a gradual ramp: keep the 50/50 split, let only a small share of new visitors into the test at first, and raise that share step by step. freeabtest.com offers this on every plan under scheduling in [managing experiments](https://www.freeabtest.com/docs/experiments).

## Is there a quick rule of thumb?

Yes. For 95% confidence and 80% power, visitors per version is roughly 16 × p(1 - p) ÷ δ², where p is the baseline and δ is the absolute difference you want to detect. Ronny Kohavi, Diane Tang and Ya Xu give this approximation in [Trustworthy Online Controlled Experiments](https://www.cambridge.org/core/books/trustworthy-online-controlled-experiments/D97B26382EB0EB2DC2019A7A7B518F59) (Cambridge University Press, 2020). It runs a little low because it uses only the baseline's variance:

| Baseline and MDE | Rule of thumb | Full formula | Gap |
|---|---|---|---|
| 3%, 20% lift | 12,934 | 13,914 | 7% low |
| 5%, 10% lift | 30,400 | 31,234 | 3% low |
| 10%, 20% lift | 3,600 | 3,841 | 6% low |
| 1%, 30% lift | 17,600 | 19,827 | 11% low |

It is close enough to decide in a meeting whether a test is realistic. Use the full formula, or the calculator below, for the real plan.

## What lift can my traffic detect?

Turn the question around when traffic is fixed. Here is the smallest relative lift a 2-version test can detect in 4 weeks, at 95% confidence and 80% power:

| Weekly visitors to the page | Visitors per version in 4 weeks | MDE at 3% baseline | MDE at 5% baseline | MDE at 10% baseline |
|---|---|---|---|---|
| 1,000 | 2,000 | 56.8% | 42.3% | 28.2% |
| 2,500 | 5,000 | 34.4% | 25.9% | 17.4% |
| 5,000 | 10,000 | 23.8% | 18.0% | 12.2% |
| 10,000 | 20,000 | 16.6% | 12.6% | 8.6% |
| 25,000 | 50,000 | 10.3% | 7.9% | 5.4% |
| 50,000 | 100,000 | 7.2% | 5.5% | 3.8% |

If your page gets 2,500 visitors a week and converts at 3%, a 4-week test can only reliably catch a lift of about 34%. Button color tweaks will not get there. A new offer, a rewritten headline or a shorter form might.

The same math applies to plan limits. Our [free plan](https://www.freeabtest.com/pricing) allows up to 10,000 tested visitors a month and 300 a day. At the daily cap, 4 weeks gives 8,400 tested visitors, or 4,200 per version, enough to detect a lift of about 38% at a 3% baseline or 19% at a 10% baseline. Starter at $10 a month raises the limit to 250,000 tested visitors. For small sites, our guide to [A/B testing with low traffic](https://www.freeabtest.com/blog/ab-testing-low-traffic) covers what else you can learn.

## Can I get a sample size calculator I can run myself?

Yes. Paste this into your browser's developer console, or run it with Node.js. It uses the same formula as the tables above, with a Bonferroni split when you test more than one variant, and it matches our Python results for every row we checked.

```javascript
// Inverse of the standard normal CDF (Acklam's approximation, error under 1.2e-9)
function normInv(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687,
             138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866,
             66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838,
             -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398,
             2.445134137142996, 3.754408661907416];
  const lo = 0.02425, hi = 1 - lo;
  let q, r;
  if (p < lo) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  if (p > hi) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  q = p - 0.5; r = q * q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
         (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}

// Visitors needed per version for a two-sided test with equal groups.
// baseline: 0.03 for 3%. lift: relative, 0.2 for +20%.
// variants: number of versions compared with the control (Bonferroni split of alpha).
function sampleSize({ baseline, lift, alpha = 0.05, power = 0.8, variants = 1 }) {
  const p1 = baseline;
  const p2 = baseline * (1 + lift);
  const zA = normInv(1 - alpha / variants / 2);
  const zB = normInv(power);
  const pBar = (p1 + p2) / 2;
  const n = (zA * Math.sqrt(2 * pBar * (1 - pBar)) +
             zB * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2 / (p2 - p1) ** 2;
  const perVersion = Math.ceil(n);
  return { perVersion, total: perVersion * (variants + 1) };
}

console.log(sampleSize({ baseline: 0.03, lift: 0.2 }));
// { perVersion: 13914, total: 27828 }
```

Try `sampleSize({ baseline: 0.05, lift: 0.1 })` for a 5% page and a 10% lift (31,234 per version), or add `variants: 3` to plan an A/B/n test with three challengers (18,559 per version, 74,236 in total).

If you use freeabtest.com, the Test planner in the dashboard does the same job on every plan, including Free. Enter the page's conversion rate, the smallest lift worth detecting and the visitors per day who would enter the test, and it shows the visitors each version needs and how many days that takes, using the same 95% confidence and 80% power. The [managing experiments guide](https://www.freeabtest.com/docs/experiments) describes it.

## How does sample size work with a peeking-safe test?

The formula above assumes you look at the result once, at the planned end. If you check a standard z-test every day and stop at the first significant reading, false winners become far more common. Our article on [what statistical significance means](https://www.freeabtest.com/blog/statistical-significance-ab-test) shows how this happens.

freeabtest.com runs a peeking-safe sequential test (a mixture sequential probability ratio test) on every plan. Its p-value stays valid however often you look, so you can stop the moment the verdict is significant. The cost, as our [guide to reading results](https://www.freeabtest.com/docs/results) states, is that the sequential test needs about 2 to 3 times as many visitors for the same observed lift. The other side is that it can stop earlier when the real lift is bigger than your MDE.

In practice, treat the fixed-sample number as a planning estimate and the 2 to 3 times figure as the upper range. For our 1,500-visitors-a-day example, that means planning for 3 weeks while accepting that a lift exactly at the 20% MDE could take 37 to 56 days to clear the sequential bar. The Test planner shows both figures. The results API still returns a fixed-sample z-test under `statistical_significance` if you prefer to plan one look in advance.

## What mistakes lead to the wrong sample size?

- **Using sitewide traffic.** Only visitors who reach the tested page count. A pricing page with 800 visitors a week does not get your homepage's 20,000.
- **Picking the MDE you hope for.** If a 20% lift would be a surprise, planning for it means most real effects will be missed. Plan for the smallest lift worth the cost of the change.
- **Forgetting the extra versions.** The sample is per version. An A/B/C test needs at least 3 times the per-version number, plus the Bonferroni increase.
- **Using a baseline from a different goal.** The baseline must be the rate of the exact goal you will measure, on the same page and audience.
- **Mixing relative and absolute MDE.** As shown above, this can turn 13,914 into 44.
- **Stopping at the sample size before a full week.** Even when the numbers are in, run whole weeks so weekday and weekend visitors both count.

When the numbers look workable, the [quick start](https://www.freeabtest.com/docs/quick-start) takes you from sign-in to a running test in about 15 minutes.

## Frequently asked questions

**How many visitors do I need for an A/B test?**
At a 3% conversion rate, 95% confidence and 80% power, you need about 13,914 visitors per version to detect a 20% relative lift, so 27,828 for a plain A/B test. Detecting a 10% lift takes 53,211 per version. A higher baseline or a bigger lift needs fewer visitors.

**What is a minimum detectable effect in A/B testing?**
The minimum detectable effect (MDE) is the smallest lift your test is set up to detect with the power you chose. It is usually written as a relative lift, so a 20% MDE on a 3% baseline means detecting a change to 3.6%. Pick it from the smallest change worth shipping, not the change you hope for.

**What is the formula for A/B test sample size?**
Visitors per version = (z₁ × √(2p̄(1 - p̄)) + z₂ × √(p1(1 - p1) + p2(1 - p2)))² ÷ (p2 - p1)², with z₁ = 1.96 for 95% confidence and z₂ = 0.84 for 80% power. A quick rule of thumb is 16 × p(1 - p) ÷ δ², where δ is the absolute difference. It runs 3% to 11% low in our examples.

**Does a 90/10 traffic split need more visitors?**
Yes. At a 3% baseline and a 20% lift, a 50/50 split needs 27,828 visitors in total, while a 90/10 split needs 75,042, about 2.7 times as many. Use uneven splits to limit risk, and expect the test to take longer.

**Do I need a bigger sample with a peeking-safe sequential test?**
For the same observed lift, yes. freeabtest.com's sequential test needs about 2 to 3 times as many visitors as a single-look test, in exchange for a p-value that stays valid however often you check. It can also stop earlier when the real lift is bigger than you planned for.

**Can I use a one-sided test to cut the sample size?**
It cuts the sample by about 21% at 95% confidence and 80% power (13,914 to 10,960 per version in our example), but a one-sided test cannot tell you when the variant is worse. Most teams keep the two-sided default.

We calculated every table in this article with a short Python script using SciPy's normal distribution and the two-proportion formula above, rounding each result up to the next whole visitor. The uneven-split table uses the same formula with unequal group sizes, and the "what lift can my traffic detect" table searches for the smallest lift whose required sample fits the visitors available. You can check any row in Evan Miller's calculator or with the JavaScript above. Small differences of a visitor or two come from rounding; large ones usually mean the MDE was entered as absolute instead of relative.
