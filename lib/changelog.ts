/**
 * Public, customer-facing release notes for /changelog, read from content/changelog/releases.json.
 * Curated by hand: shipped features only, no internals. It is not the engineering log in docs/changelog.md.
 * An item names a feature from lib/site/product.ts and takes its plan from there, so plans never drift.
 * tests/resourcesPages.test.ts checks features, plans, links, dates and wording.
 */
import releases from '@/content/changelog/releases.json';
import { ANALYTICS_EXTRAS, FEATURE_GROUPS, type Plan } from '@/lib/site/product';

export type ReleaseItem = { text: string; href?: string; feature?: string; plan?: Plan; doc?: string };
export type Release = { id: string; date: string; title: string; summary?: string; items: ReleaseItem[] };

export const RELEASES: Release[] = releases as Release[];

/** Plan for a feature name, from the Features page data or the analytics extras. */
export function featurePlan(name: string): Plan | undefined {
    for (const g of FEATURE_GROUPS) for (const f of g.features) if (f.name === name) return f.plan;
    return ANALYTICS_EXTRAS.find((a) => a.title === name)?.plan;
}

/** The plan badge for an item: from its feature, or an explicit plan checked against a docs page. */
export const itemPlan = (i: ReleaseItem): Plan | undefined => (i.feature ? featurePlan(i.feature) : i.plan);

export const latestReleases = (n: number) => RELEASES.slice(0, n);
