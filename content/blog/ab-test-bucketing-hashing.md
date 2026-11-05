---
title: "How A/B testing tools assign visitors to variants"
meta_description: "A/B tools hash a visitor ID with the experiment ID to pick a variant. How bucketing works, where it breaks, with tested code and simulated numbers."
slug: ab-test-bucketing-hashing
date: 2026-11-05
updated: 2026-11-05
author: "Imraan, freeabtest.com"
keywords: ["a/b test bucketing", "sticky bucketing", "hash based assignment", "deterministic bucketing", "ab test traffic allocation", "how ab testing tools assign variants"]
article_schema: |
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "How A/B testing tools assign visitors to variants",
    "datePublished": "2026-11-05",
    "dateModified": "2026-11-05",
    "mainEntityOfPage": "https://www.freeabtest.com/blog/ab-test-bucketing-hashing",
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
      {"@type": "ListItem", "position": 3, "name": "How A/B testing tools assign visitors to variants", "item": "https://www.freeabtest.com/blog/ab-test-bucketing-hashing"}
    ]
  }
faq_schema: |
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {"@type": "Question", "name": "What is bucketing in A/B testing?",
       "acceptedAnswer": {"@type": "Answer", "text": "Bucketing is the step that maps a visitor to a variant. Most tools hash a stable visitor ID together with the experiment ID, turn the result into a number from 0 to 9,999, and compare it with the traffic split. The same inputs always give the same variant, so a returning visitor keeps their version."}},
      {"@type": "Question", "name": "Why do A/B tests use a hash instead of a random number?",
       "acceptedAnswer": {"@type": "Answer", "text": "A random number gives a different answer on every call, so a visitor can see both versions. A hash of a stable ID gives the same answer every time and still looks random across visitors. In our simulation of 1,000,000 visitors, a 50/50 hash split gave 499,997 and 500,003."}},
      {"@type": "Question", "name": "Should the experiment ID be part of the hash?",
       "acceptedAnswer": {"@type": "Answer", "text": "Yes. Without it, a visitor who lands in the variant of one test lands in the variant of every test. In our simulation of two tests on 200,000 visitors, 100.0% of visitors in the variant of the first test were also in the variant of the second. With the experiment ID in the hash, it was 49.9%, which is what independent tests should give."}},
      {"@type": "Question", "name": "What happens to visitors when you change the traffic split on a running test?",
       "acceptedAnswer": {"@type": "Answer", "text": "With a hash alone, many visitors change version. Moving from 50/50 to 70/30 moved 20.0% of visitors in our simulation, and 50/50 to 90/10 moved 40.1%. freeabtest.com applies a changed split to new visitors only, so people already in the test keep their version."}},
      {"@type": "Question", "name": "Can a visitor see both versions of an A/B test?",
       "acceptedAnswer": {"@type": "Answer", "text": "Yes, when the visitor ID is lost. Cleared storage, a different browser or device, and Safari's 7-day cap on script-writable storage after no interaction with the site all create a new ID, and a new ID is a new draw. With a 50/50 split, a new draw matches the old version 1 time in 2. Passing your own stable user ID avoids most of it for logged-in visitors."}},
      {"@type": "Question", "name": "How do I check that bucketing is working?",
       "acceptedAnswer": {"@type": "Answer", "text": "Compare the visitor counts in each version with the planned split using a chi-square test. In 1,000 simulated A/A tests with a sound hash, 4.0% had a p-value below 0.05 and 0.3% below 0.001, close to what chance predicts. freeabtest.com shows a warning on the Results tab when the gap would happen by luck less than 0.1% of the time."}}
    ]
  }
---

A/B testing tools assign visitors by hashing a stable visitor ID together with the experiment ID, turning the result into a bucket number, and mapping that bucket to a variant by the traffic split. The same visitor and the same experiment always give the same variant, so nothing has to be looked up, and across visitors the split looks random.

Bucketing is the step that maps a visitor to a variant. It looks like a detail, yet it is where many silent errors begin: skewed splits, tests that contaminate each other, and visitors who see both versions. Below we show a design that avoids them, test it on a million simulated visitors, and show how each shortcut breaks. The method is described at the end.

## How does deterministic bucketing work?

It has three steps. Take a string made from the experiment ID and the visitor ID, hash it to a 32-bit number, then take that number modulo 10,000 to get a bucket from 0 to 9,999. Compare the bucket with the cumulative weights of the variants, and the first weight it falls under is the variant.

| Step | What happens | Example (50/50 test) |
|---|---|---|
| 1. Build the key | Join the experiment ID and the visitor ID | `exp_123:user_1730800000000_k3j9x0abc` |
| 2. Hash | Turn the key into a 32-bit number | A number between 0 and 4,294,967,295 |
| 3. Bucket | Take the number modulo 10,000 | A bucket from 0 to 9,999 |
| 4. Match the split | Buckets 0 to 4,999 are control, 5,000 to 9,999 are the variant | The visitor sees one version |

Deterministic means the same key always gives the same answer. That is the property that makes a visitor sticky: a returning visitor gets their version back without the tool storing a table of who saw what. Kohavi, Tang and Xu describe the same idea in [Trustworthy Online Controlled Experiments](https://www.cambridge.org/core/books/trustworthy-online-controlled-experiments/D97B26382EB0EB2DC2019A7A7B518F59) (Cambridge University Press, 2020): a pseudo-randomization process such as hashing maps each unit to a variant in a persistent and independent way. Microsoft's Bing used a pseudo-random hash of an anonymous user ID for the same reason, as described in [Online controlled experiments at large scale](https://dl.acm.org/doi/10.1145/2487575.2488217) (KDD 2013).

We use 10,000 buckets instead of 100 so a split such as 99.5/0.5 is possible. Our guide to [running an A/B test with plain JavaScript](https://www.freeabtest.com/blog/ab-test-javascript) walks through the smallest working version. The code below adds the two details that guide leaves out: a final mixing step and a separate hash for deciding who enters the test.

```js
function hash32(text) {
  // FNV-1a over the characters, then a final mix so nearby inputs spread out.
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// weights: variant names with whole-number shares that add up to 100
// allocation: share of visitors who enter the test, 0 to 100
function assign(visitorId, experimentId, weights, allocation) {
  const entry = hash32(experimentId + ':enter:' + visitorId) % 10000;
  if (entry >= allocation * 100) return null; // not in the test, show the original page
  const pick = hash32(experimentId + ':variant:' + visitorId) % 10000;
  let edge = 0;
  for (const [name, share] of Object.entries(weights)) {
    edge += share * 100;
    if (pick < edge) return name;
  }
  return null;
}
```

FNV-1a is a short non-cryptographic hash, with its constants listed in the [IETF FNV draft](https://datatracker.ietf.org/doc/html/draft-eastlake-fnv). [`Math.imul()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul) does the 32-bit multiply. The last three lines are the finalizing mix used in [MurmurHash3](https://en.wikipedia.org/wiki/MurmurHash). Each of the next sections explains one choice in this code.

## Does a hash really split traffic evenly?

Yes, when the hash mixes its input well. We ran the code above on 1,000,000 simulated visitor IDs shaped like the ones a browser SDK generates, with a 50/50 split. It gave 499,997 visitors in control and 500,003 in the variant, a chi-square p-value of 0.995. A 90/10 split gave 900,137 and 99,863, so 9.986% in the variant (p = 0.648). A three-way 40/30/30 split gave 399,692, 300,892 and 299,416 (p = 0.134).

Even a good hash will not give exactly 50/50 on a small test, and it should not. We ran 1,000 A/A tests, where both versions are identical, each with 20,000 visitors and its own experiment ID.

| Result across 1,000 A/A tests of 20,000 visitors | Value |
|---|---|
| Tests with a split gap significant at p below 0.05 | 4.0% (chance predicts about 5%) |
| Tests with a split gap significant at p below 0.01 | 0.8% (about 1% expected) |
| Tests with a split gap significant at p below 0.001 | 0.3% (about 0.1% expected) |
| Median gap from 50% | 0.23 points |
| Largest gap from 50% in any one test | 1.26 points |

So a sound hash produces split gaps the way coin flips do, with an occasional unlucky one. Whether the gap you see is luck or a bug is a question for a sample ratio test, which compares the observed counts with the planned split and reports how unlikely the gap is. We cover that check further down.

## Why does the experiment ID go into the hash?

Because without it, every test uses the same split of the same visitors. If the key is only the visitor ID, a visitor who falls in the variant half of one test falls in the variant half of every test.

We tested both versions on 200,000 simulated visitors across two experiments, each split 50/50.

| Key that is hashed | In both controls | Control in test one, variant in test two | Variant in test one, control in test two | In both variants |
|---|---|---|---|---|
| Visitor ID only | 99,679 | 0 | 0 | 100,321 |
| Experiment ID and visitor ID | 50,048 | 50,155 | 50,010 | 49,787 |

With the visitor ID alone, 100.0% of visitors in the variant of test one were also in the variant of test two. The two tests are the same test, so any effect of the first change leaks into the second. With the experiment ID in the key, the overlap is 49.9%, which is what independent tests give (chi-square p = 0.46).

Kohavi and colleagues documented the real-world version of this problem in [Trustworthy Online Controlled Experiments: Five Puzzling Outcomes Explained](https://exp-platform.com/Documents/puzzlingOutcomesInControlledExperiments.pdf) (KDD 2012). When user buckets are reused from one experiment to the next, effects carry over. In one example the carryover lasted until about the third week after the experiment ended, and after a bug gave users a very bad experience, the buckets had not fully recovered three months later. Their mitigation is the one in our code: a different hash seed for each experiment. The cost, they note, is that each experiment then needs its own control rather than a shared one.

## Why use one hash to enter the test and another to pick the variant?

Because one number cannot do both jobs. If a single bucket decides whether a visitor is in the test and also which version they get, the two decisions are tied together, and a partial rollout can end up with a single version.

Take a test that sends 20% of visitors to a 50/50 split. With a single bucket, a visitor enters if the bucket is below 2,000. The same bucket picks control if it is below 5,000. Every bucket that enters is below 2,000, so every one of them is also below 5,000.

| Design (20% allocation, 200,000 visitors, 50/50 split) | Entered the test | Control | Variant |
|---|---|---|---|
| One hash for entry and variant | 40,105 | 40,105 | 0 |
| Separate hashes for entry and variant | 39,898 (19.9%) | 20,003 | 19,895 |

The single-hash version looks fine on the dashboard at first, because visitors are entering. There is simply no variant group, and the test never gets a result. The split-hash version put 50.14% in control, p = 0.589.

Separate hashes also make ramping safe. Ramping means starting with a small share of visitors and raising it in steps, a practice Kohavi, Tang and Xu cover in the chapter on [ramping experiment exposure](https://www.cambridge.org/core/books/trustworthy-online-controlled-experiments/D97B26382EB0EB2DC2019A7A7B518F59). In our simulation, 19,940 visitors entered at 10% allocation. After raising the allocation to 50%, all 19,940 were still in the test and all 19,940 kept the same version. Entry is a threshold on a stable number, so raising the threshold only adds visitors. Our guide on [sample size](https://www.freeabtest.com/blog/ab-test-sample-size) covers what uneven splits and ramps do to the number of visitors you need.

## Which hash function is good enough?

One that spreads similar inputs apart. A hash for bucketing does not need to be secure, but it does need to avoid patterns, because visitor IDs are full of them: timestamps, counters and prefixes.

We tried two weak choices and the hash above on realistic IDs.

| Hash and input | Result for a 50/50 split |
|---|---|
| Sum of character codes, 100,000 sequential IDs (`user_1` to `user_100000`), buckets 0 to 9,999 | 100,000 control, 0 variant, because the sums only reached 136 distinct buckets, all below 5,000 |
| Sum of character codes, 200,000 realistic random IDs, split by sum modulo 100 | 99,469 control, 100,531 variant (49.73%), p = 0.018 |
| Hash above, 100,000 sequential IDs | 49,805 control, 50,195 variant (50.20%), p = 0.217 |

The first row is an obvious failure. The second is easier to miss: a 49.73% share looks fine on a dashboard, yet at 200,000 visitors it fails a sample ratio test at the 5% level. The third row is what a clean hash gives on the hardest kind of input, a counter.

Do not use `Math.random()` per page view either. It is not deterministic, so a visitor can see both versions. In our guide to [A/B testing with plain JavaScript](https://www.freeabtest.com/blog/ab-test-javascript), 100,000 simulated visitors with 3 page views each saw both versions 74.8% of the time.

## What happens when you change the split on a running test?

With a hash alone, visitors move. The bucket for a visitor never changes, but the edges between variants do, so everyone whose bucket falls between the old and new edge switches version.

We measured it with the code above on 200,000 visitors in a test that was entered by everyone.

| Change on a running test | Share of visitors whose version changes with a hash alone |
|---|---|
| 50/50 to 70/30 | 20.0% |
| 50/50 to 90/10 | 40.1% |

A visitor who saw the variant on Monday sees the original on Tuesday, and their earlier exposure stays in the data. That mixes the two groups. The fix is to record each assignment on first sight and to apply a changed split to new visitors only.

That is how freeabtest.com works. Per our [experiment docs](https://www.freeabtest.com/docs/experiments), every change to the split applies to new visitors only, people already in the test keep their version, raising the traffic allocation adds new visitors without moving anyone, and lowering it stops some new visitors from entering while visitors already assigned keep their version. We hash the visitor ID with the experiment ID and the assignment is recorded, so both properties hold. Changing a split mid-test still has a cost: the [results docs](https://www.freeabtest.com/docs/results) note that the unexpected-split warning can appear for that reason alone, since the early and late visitors were let in at different rates.

## When does a visitor see both versions anyway?

When the ID that goes into the hash changes. A deterministic hash is only as stable as its input, and the input is usually a browser ID.

The freeabtest.com [SDK docs](https://www.freeabtest.com/docs/sdk) are direct about it: a generated visitor ID lives in localStorage, so it survives reloads but not a different browser, a different device or cleared storage. Safari adds a time limit. WebKit's [tracking prevention policy](https://webkit.org/tracking-prevention/) says Intelligent Tracking Prevention deletes all script-writable storage, including localStorage, after 7 days of no user interaction with the website. A Safari visitor who comes back after more than 7 days without interacting with your site can arrive with a new ID.

A new ID is a new draw, and in a 50/50 test a new draw matches the old version 1 time in 2. That gives a simple estimate of how much cross-over to expect.

| Share of visitors who get a new ID after joining | Share of all visitors who then see both versions (50/50 test) |
|---|---|
| 5% | 2.5% |
| 10% | 5.0% |
| 20% | 10.0% |

This is arithmetic, not a measurement of any site, and the real share depends on your audience and browsers. Visitors who see both versions dilute the result toward zero, because their conversions count for one group while part of their experience came from the other. For logged-in visitors, the fix is to pass your own stable ID, such as an account ID, instead of a browser-generated one. The SDK accepts a `userId` option for that. For anonymous visitors, this loss is a limit of any tool that keys on a browser ID, including ours.

## How do you check that assignment is working?

Count visitors in each version and compare them with the planned split using a chi-square test. For a 50/50 test, the expected count is half the total in each version, and the test turns the gap into a p-value.

The size of the skew matters less than the number of visitors. With 100,000 visitors, a split of 50,800 against 49,200 (a 50.8% share) gives a chi-square p-value of 0.0000004, which no hash gives by chance. A split of 50,300 against 49,700 gives p = 0.058, which could be chance. Fabijan and colleagues, in [Diagnosing Sample Ratio Mismatch in Online Controlled Experiments](https://doi.org/10.1145/3292500.3330722) (KDD 2019), describe a mismatch as a symptom of several data quality problems, and sort the causes into groups so teams can find the root one. Bucketing is one possible cause. The results docs list others: a redirect that drops visitors, a slow or broken variation page, and the snippet missing from one page.

freeabtest.com runs this check for you. Per the [results docs](https://www.freeabtest.com/docs/results), the Results tab shows a warning once a test has at least 100 visitors and the observed split would happen by luck less than 0.1% of the time. Fix the cause before trusting the numbers. A dedicated article on sample ratio mismatch is planned.

## How does freeabtest.com assign visitors?

The snippet sends a visitor ID to the platform, and we hash it together with the experiment ID. The same visitor always lands in the same variant, and the assignment is recorded, so a change to the split or the allocation only affects new visitors. You add one script tag to the control page and every variation page, and the SDK handles bucketing, redirects and click goals. There is no bucketing code to write.

The free plan includes all of this: 10,000 tested visitors a month (300 a day), 1 running test, and a control plus 1 variation, with a click on a CSS selector as the goal. Past the visitor limit, new visitors see the original page and are not counted, and visitors already in a test keep their version. Paid plans allow up to 50 variations. See [pricing](https://www.freeabtest.com/pricing) for the details, and the [quick start](https://www.freeabtest.com/docs/quick-start) for a first test in about 15 minutes.

## Frequently asked questions

**What is bucketing in A/B testing?**
Bucketing is the step that maps a visitor to a variant. Most tools hash a stable visitor ID together with the experiment ID, turn the result into a number from 0 to 9,999, and compare it with the traffic split. The same inputs always give the same variant, so a returning visitor keeps their version.

**Why do A/B tests use a hash instead of a random number?**
A random number gives a different answer on every call, so a visitor can see both versions. A hash of a stable ID gives the same answer every time and still looks random across visitors. In our simulation of 1,000,000 visitors, a 50/50 hash split gave 499,997 and 500,003.

**Should the experiment ID be part of the hash?**
Yes. Without it, a visitor who lands in the variant of one test lands in the variant of every test. In our simulation of two tests on 200,000 visitors, 100.0% of visitors in the variant of the first test were also in the variant of the second. With the experiment ID in the hash, it was 49.9%, which is what independent tests should give.

**What happens to visitors when you change the traffic split on a running test?**
With a hash alone, many visitors change version. Moving from 50/50 to 70/30 moved 20.0% of visitors in our simulation, and 50/50 to 90/10 moved 40.1%. freeabtest.com applies a changed split to new visitors only, so people already in the test keep their version.

**Can a visitor see both versions of an A/B test?**
Yes, when the visitor ID is lost. Cleared storage, a different browser or device, and Safari's 7-day cap on script-writable storage after no interaction with the site all create a new ID, and a new ID is a new draw. With a 50/50 split, a new draw matches the old version 1 time in 2. Passing your own stable user ID avoids most of it for logged-in visitors.

**How do I check that bucketing is working?**
Compare the visitor counts in each version with the planned split using a chi-square test. In 1,000 simulated A/A tests with a sound hash, 4.0% had a p-value below 0.05 and 0.3% below 0.001, close to what chance predicts. freeabtest.com shows a warning on the Results tab when the gap would happen by luck less than 0.1% of the time.

Every figure in this article comes from short scripts with fixed random seeds, using the `assign` function shown above unchanged. Visitor IDs were generated in the format `user_<13-digit timestamp>_<9 base-36 characters>`. The single-test check used 1,000,000 IDs, the A/A check used 1,000 experiment IDs on 20,000 IDs each, and the cross-test, entry and split-change checks used 200,000 IDs. Chi-square p-values for counts come from SciPy. The ID-loss table is arithmetic, not a simulation. Product behavior was checked against the freeabtest.com pricing page and the experiments, SDK and results docs on 5 November 2026.
