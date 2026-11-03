---
title: "Why a confidence interval beats a single winner number"
meta_description: "A 20% lift can mean anywhere from 3% to 40%. How to read and calculate a confidence interval for an A/B test, with worked numbers and a decision table."
slug: confidence-interval-ab-test
date: 2026-11-03
updated: 2026-11-03
author: "Imraan, freeabtest.com"
keywords: ["confidence interval a/b test", "ab test margin of error", "conversion rate interval", "confidence interval for lift", "wilson interval", "reading ab test results"]
article_schema: |
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "Why a confidence interval beats a single winner number",
    "datePublished": "2026-11-03",
    "dateModified": "2026-11-03",
    "mainEntityOfPage": "https://www.freeabtest.com/blog/confidence-interval-ab-test",
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
      {"@type": "ListItem", "position": 3, "name": "Why a confidence interval beats a single winner number", "item": "https://www.freeabtest.com/blog/confidence-interval-ab-test"}
    ]
  }
faq_schema: |
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {"@type": "Question", "name": "What is a confidence interval in an A/B test?",
       "acceptedAnswer": {"@type": "Answer", "text": "A confidence interval is a range of values built from your data so that, across many repeated tests, 95% of such ranges contain the true value. In an A/B test it is usually shown for each conversion rate, or better, for the difference or lift between the versions. A wide interval means the test has not pinned the effect down yet."}},
      {"@type": "Question", "name": "Does a 95% confidence interval mean there is a 95% chance the true value is inside it?",
       "acceptedAnswer": {"@type": "Answer", "text": "Not strictly. The 95% describes the method: in our simulation of 10,000 tests, intervals built this way contained the true difference 95.0% of the time. Any single interval either contains the truth or does not. In practice, reading it as the range of effects your data can support is a reasonable shortcut."}},
      {"@type": "Question", "name": "How do I calculate a confidence interval for A/B test lift?",
       "acceptedAnswer": {"@type": "Answer", "text": "Compute the ratio of the two conversion rates and use the Katz log method to get an interval for that ratio, then subtract 1 to express it as lift. For the difference in points, the Newcombe hybrid score method works well for conversion rates. The article includes a short JavaScript function that does both."}},
      {"@type": "Question", "name": "Why does freeabtest.com use Wilson intervals?",
       "acceptedAnswer": {"@type": "Answer", "text": "The Wilson score interval stays accurate for small samples and for rates close to 0% or 100%, where the simpler normal approximation can be badly off. In our simulation of a 1% conversion rate with 100 visitors, the simple interval covered the truth only 63.3% of the time, against 92.1% for Wilson."}},
      {"@type": "Question", "name": "Can I compare two A/B test versions by checking whether their intervals overlap?",
       "acceptedAnswer": {"@type": "Answer", "text": "Overlap is a rough visual cue, not a test. Two intervals can overlap while the difference between the versions is still significant. In our simulation of a real lift, 66.4% of significant wins had overlapping intervals for the two conversion rates. Use the interval for the difference, or the significance verdict, to decide."}},
      {"@type": "Question", "name": "What interval width is good enough to ship a change?",
       "acceptedAnswer": {"@type": "Answer", "text": "Decide the smallest lift worth shipping before the test starts, then compare it with the interval. If the whole interval sits above that lift, ship. If the whole interval sits below it, stop and move on. If the interval spans it, the test has not answered your question yet."}}
    ]
  }
---

A confidence interval shows the range of effects your data can support, and a single winner number hides that range. A test that reads +20% on 10,000 visitors per version is consistent with a true lift anywhere from 3% to 40%, and which end is true changes whether the change is worth shipping.

Here I explain how to read an interval, how to calculate one for the lift between two versions, and where intervals mislead. Every number below comes from our own calculations in Python with NumPy and SciPy, and the method is described at the end. A confidence interval is a range of values calculated from your data so that, if you repeated the test many times, 95% of the ranges built this way would contain the true value.

## Why is a single winner number not enough?

Because the same observed lift can come from very different amounts of evidence. We took one result, 3.0% against 3.6% (a lift of 20%), and asked what interval it gets at six different sample sizes.

| Visitors per version | p-value (z-test) | Interval for the difference | Interval for the lift |
|---|---|---|---|
| 1,000 | 0.45 | -0.99 to 2.21 points | -25% to 93% |
| 2,500 | 0.24 | -0.40 to 1.60 points | -11% to 62% |
| 5,000 | 0.09 | -0.10 to 1.31 points | -3% to 49% |
| 10,000 | 0.018 | 0.10 to 1.10 points | 3% to 40% |
| 20,000 | 0.0008 | 0.25 to 0.95 points | 8% to 33% |
| 50,000 | below 0.0001 | 0.38 to 0.82 points | 12% to 28% |

All six rows show the same headline: +20%. At 1,000 visitors the interval allows a 25% drop. At 10,000 the result is significant, yet the lift could be as small as 3%. Only at 50,000 does the interval narrow to a range you could plan around.

This is what the p-value cannot tell you. As we explained in [what statistical significance means in an A/B test](https://www.freeabtest.com/blog/statistical-significance-ab-test), a p-value says whether zero is a believable answer. The interval says which sizes are believable, and that is the part you need to decide.

## What does a 95% confidence interval actually mean?

It is a statement about the method, not about one interval. If both versions truly convert at 3.0% and 3.6%, and you run the test over and over, about 95% of the intervals you calculate will contain the true difference of 0.6 points.

We checked this. We simulated 10,000 tests with those true rates and 10,000 visitors per version, and calculated an interval for each one. The interval for the difference contained the truth in 95.0% of tests, and the interval for the lift in 95.2%. In the first 20 tests, 19 intervals contained the true difference and 1 missed it. That is what 95% looks like: about 1 miss in 20, and no way to tell which one it was.

The strict reading, that the 95% belongs to the procedure and not to the interval in front of you, is explained at length by Richard Morey and colleagues in [The fallacy of placing confidence in confidence intervals](https://doi.org/10.3758/s13423-015-0947-8) (Psychonomic Bulletin & Review, 2016). For daily work, reading the interval as the range of effects your data can support is a reasonable shortcut, as long as you remember the 1 in 20.

## How do you calculate an interval for the lift between two versions?

You need three steps, and the result is an interval for the thing you care about: the difference or the relative lift between the versions, not each rate on its own.

1. Calculate a Wilson score interval for each conversion rate.
2. Combine the two Wilson intervals into an interval for the difference in points. This is the hybrid score method from Robert Newcombe, described in [Interval estimation for the difference between independent proportions: comparison of eleven methods](https://doi.org/10.1002/(SICI)1097-0258(19980430)17:8%3C873::AID-SIM779%3E3.0.CO;2-I) (Statistics in Medicine, 1998).
3. For the relative lift, build an interval for the ratio of the two rates on the log scale and subtract 1. This is the method from Katz and colleagues in [Obtaining confidence intervals for the risk ratio in cohort studies](https://doi.org/10.2307/2530610) (Biometrics, 1978).

Lift is the relative change between the rates, (variation minus control) divided by control. Here is the whole calculation as a short JavaScript function that you can run in Node with no libraries:

```js
const Z = 1.959964; // 95% two-sided

function wilson(conversions, visitors) {
  const p = conversions / visitors;
  const d = 1 + (Z * Z) / visitors;
  const centre = (p + (Z * Z) / (2 * visitors)) / d;
  const half = (Z * Math.sqrt((p * (1 - p)) / visitors + (Z * Z) / (4 * visitors * visitors))) / d;
  return [centre - half, centre + half];
}

function compare(c1, n1, c2, n2) {
  const p1 = c1 / n1;
  const p2 = c2 / n2;
  const [l1, u1] = wilson(c1, n1);
  const [l2, u2] = wilson(c2, n2);
  const d = p2 - p1;
  const diff = [d - Math.sqrt((p2 - l2) ** 2 + (u1 - p1) ** 2), d + Math.sqrt((u2 - p2) ** 2 + (p1 - l1) ** 2)];
  const se = Math.sqrt((1 - p2) / (p2 * n2) + (1 - p1) / (p1 * n1));
  const ratio = p2 / p1;
  const lift = [ratio * Math.exp(-Z * se) - 1, ratio * Math.exp(Z * se) - 1];
  return { diffPoints: diff.map((x) => x * 100), liftPercent: lift.map((x) => x * 100) };
}

console.log(compare(300, 10000, 360, 10000));
// diffPoints: about [0.10, 1.10], liftPercent: about [3, 40]
```

The example call, 300 conversions from 10,000 visitors against 360 from 10,000, reproduces the 10,000 row of the table above. We checked the JavaScript against the Python script, and both give 0.10 to 1.10 points and 3% to 40%.

## Why does the interval type matter for small samples?

The simple "normal approximation" interval (also called the Wald interval) is the standard textbook formula, and it fails when samples are small or rates are low. We simulated 100,000 samples for each cell below and counted how often the 95% interval contained the true rate.

| Visitors | True rate 1%: simple interval | True rate 1%: Wilson | True rate 2%: simple interval | True rate 2%: Wilson |
|---|---|---|---|---|
| 100 | 63.3% | 92.1% | 86.5% | 95.0% |
| 200 | 86.4% | 94.8% | 90.8% | 93.4% |
| 500 | 87.2% | 96.3% | 92.7% | 96.4% |
| 1,000 | 92.7% | 96.3% | 95.1% | 94.8% |
| 5,000 | 95.0% | 94.5% | 94.8% | 95.2% |

At 100 visitors and a 1% rate, the simple interval is right only 63.3% of the time, while Wilson reaches 92.1%. Wilson is not perfect either at that size, so a 100-visitor interval deserves little trust. By 5,000 visitors the two agree.

Brown, Cai and DasGupta reach the same conclusion in [Interval Estimation for a Binomial Proportion](https://doi.org/10.1214/ss/1009213286) (Statistical Science, 2001): they recommend the Wilson interval for small samples and call the standard interval's coverage "persistently chaotic". The Wilson interval goes back to Edwin Wilson's [Probable inference, the law of succession, and statistical inference](https://doi.org/10.1080/01621459.1927.10502953) (Journal of the American Statistical Association, 1927). freeabtest.com shows a 95% Wilson interval for each conversion rate for this reason. Our [docs on reading results](https://www.freeabtest.com/docs/results) give the example of 50 conversions from 1,000 visitors: 5.0% with an interval of about 3.8% to 6.5%. We recalculated it and get 3.81% to 6.53%.

## Can you compare two versions by checking whether their intervals overlap?

Not reliably. Overlap is a rough visual cue, and it fails in a specific direction: two intervals can overlap even when the difference between the versions is significant.

Here is a real case from our numbers. Control converts 300 of 10,000 visitors (3.0%, interval 2.68% to 3.35%). The variation converts 360 of 10,000 (3.6%, interval 3.25% to 3.98%). The two ranges overlap between 3.25% and 3.35%, yet the difference has p = 0.0175 and an interval of 0.10 to 1.10 points that excludes zero.

This is not rare. In 10,000 simulated tests of a real lift (5.0% against 5.5%, 10,000 visitors per version), 3,489 gave a significant win, and in 66.4% of those the two rate intervals still overlapped. Nathaniel Schenker and Jane Gentleman showed the general point in [On judging the significance of differences by examining the overlap between confidence intervals](https://doi.org/10.1198/000313001317097960) (The American Statistician, 2001): non-overlap implies significance, but overlap does not imply its absence.

Our docs say the same thing in plain words: overlapping intervals do not prove there is no difference, but they are a sign the test is not done. Use the overlap as a hint to keep waiting, and use the interval for the difference, or the significance verdict, to decide.

## How do you turn an interval into a ship decision?

Decide the smallest lift worth shipping before the test starts, then compare it with the interval. Call it the minimum worthwhile lift. The idea is the same as the minimum detectable effect in our [A/B test sample size guide](https://www.freeabtest.com/blog/ab-test-sample-size), applied to the result instead of the plan.

Suppose the minimum worthwhile lift is 10%. Here is how the intervals from earlier read against it:

| Interval for the lift | Example from our numbers | What it says | What to do |
|---|---|---|---|
| Entirely above 10% | 12% to 28% (50,000 per version) | A worthwhile lift is the only believable answer | Ship it |
| Above 0 but spans 10% | 3% to 40% (10,000 per version) | The lift is real but could be too small to matter | Ship if it is cheap to keep, otherwise gather more data |
| Spans 0 and spans 10% | -3% to 49% (5,000 per version) | The test cannot yet tell a loss from a big win | Keep running |
| Spans 0, entirely below 10% | -3.9% to 6.1% (3,000 against 3,030 conversions, 100,000 per version) | Any lift is too small to bother with | Stop and test a bolder idea |
| Entirely below 0 | Not shown | The variation is worse | Keep the control |

The fourth row is the one a single number cannot give you. A flat result with a narrow interval is evidence that the change does nothing worth having. A flat result with a wide interval is only evidence that you did not collect enough. Our guide to [how long to run an A/B test](https://www.freeabtest.com/blog/how-long-to-run-an-ab-test) shows how to size the test so the interval can reach that kind of answer.

## Does a significant result overstate the lift?

Yes, especially when the test is small, and the interval is how you see it. We simulated a real 10% lift (3.0% against 3.3%) with 10,000 visitors per version. Only 23.1% of those tests reached significance, and among those winners the median reported lift was 20.8%, about double the truth. The typical interval around such a win ran from 3.5% to 41.0%.

That wide range is the warning. A win from an underpowered test is a lucky draw that happened to cross the line, so the point estimate sits too high. When the lower end of the interval is close to zero, plan around the lower end, not the headline.

## What happens to the interval if you stop early?

It loses its guarantee. A 95% interval assumes you looked once, at a sample size you fixed in advance. We simulated 10,000 tests with identical versions (both at 5.0%), checked once a day for 28 days with 1,008 visitors per version per day, and stopped at the first day the z-test gave p below 0.05. We then calculated the standard 95% interval at that stopping point.

| How the test ended | Intervals that contained the true difference |
|---|---|
| One look at day 28, identical versions | 95.3% |
| Stopped at first p below 0.05, identical versions | 72.4% |
| One look at day 28, real 10% lift | 95.3% |
| Stopped at first p below 0.05, real 10% lift | 93.3% |

With identical versions, stopping on the first green number made the interval wrong about 3 times in 10, the same problem as the false winner rate we measured in [the peeking problem](https://www.freeabtest.com/blog/ab-test-peeking-problem). With a real lift the damage was smaller, 93.3% against 95.3%, but the lift reported at an early stop was still inflated, as the previous section shows.

freeabtest.com handles the stop decision with a peeking-safe sequential test, so its verdict stays valid however often you check. The interval is a separate piece of information. In the Results tab, the detailed results table shows a Wilson interval for each version's conversion rate, and the lift against control and the chance to beat control as single figures. The goals table above it shows each lift with a 95% interval, built by dividing Newcombe's interval for the difference by the control rate, so its ends can differ slightly from the Katz figures above (about 3.5% to 36.6% instead of 3% to 40% for the 10,000 example). If you stop the moment the verdict turns significant, treat the size of the lift as an estimate that may be on the high side, and run at least one full week either way.

Sample size sets how narrow the interval can get. The [free plan](https://www.freeabtest.com/pricing) allows 10,000 tested visitors a month, which is about 5,000 per version with an even split. For 3.0% against 3.6%, the table near the top shows that a full month gives a lift interval of -3% to 49%. On a small plan, the tests worth running are the ones where the real change is large enough for a narrow-enough interval to show up. When you are ready to start one, the [quick start](https://www.freeabtest.com/docs/quick-start) takes about 15 minutes.

## Frequently asked questions

**What is a confidence interval in an A/B test?**
A confidence interval is a range of values built from your data so that, across many repeated tests, 95% of such ranges contain the true value. In an A/B test it is usually shown for each conversion rate, or better, for the difference or lift between the versions. A wide interval means the test has not pinned the effect down yet.

**Does a 95% confidence interval mean there is a 95% chance the true value is inside it?**
Not strictly. The 95% describes the method: in our simulation of 10,000 tests, intervals built this way contained the true difference 95.0% of the time. Any single interval either contains the truth or does not. In practice, reading it as the range of effects your data can support is a reasonable shortcut.

**How do I calculate a confidence interval for A/B test lift?**
Compute the ratio of the two conversion rates and use the Katz log method to get an interval for that ratio, then subtract 1 to express it as lift. For the difference in points, the Newcombe hybrid score method works well for conversion rates. The article includes a short JavaScript function that does both.

**Why does freeabtest.com use Wilson intervals?**
The Wilson score interval stays accurate for small samples and for rates close to 0% or 100%, where the simpler normal approximation can be badly off. In our simulation of a 1% conversion rate with 100 visitors, the simple interval covered the truth only 63.3% of the time, against 92.1% for Wilson.

**Can I compare two A/B test versions by checking whether their intervals overlap?**
Overlap is a rough visual cue, not a test. Two intervals can overlap while the difference between the versions is still significant. In our simulation of a real lift, 66.4% of significant wins had overlapping intervals for the two conversion rates. Use the interval for the difference, or the significance verdict, to decide.

**What interval width is good enough to ship a change?**
Decide the smallest lift worth shipping before the test starts, then compare it with the interval. If the whole interval sits above that lift, ship. If the whole interval sits below it, stop and move on. If the interval spans it, the test has not answered your question yet.

Every figure in this article comes from short scripts with fixed random seeds. Intervals for single rates are 95% Wilson score intervals. Intervals for the difference use Newcombe's hybrid score method, and intervals for lift use the Katz log method, both at 95%. The coverage checks simulate 10,000 tests at true rates of 3.0% and 3.6% with 10,000 visitors per version, and the single-rate checks use 100,000 samples per cell. The overlap and overstated-lift checks use 10,000 tests each at 5.0% against 5.5% and 3.0% against 3.3%. The stopping check uses 10,000 tests per scenario with 1,008 visitors per version per day for 28 days, a pooled two-sided z-test at 0.05 each day, and the standard Wald interval for the difference at the stopping day. Rerunning with a different seed moves the percentages by a few tenths of a point.
