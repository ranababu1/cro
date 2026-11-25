import { PRODUCT_PAGES } from '@/lib/site/product';
import { SOLUTIONS } from '@/lib/site/solutions';
import { Subnav } from './Subnav';

/** Links between the four Product pages, shown under each page hero. */
export function ProductSubnav({ current }: { current: string }) {
    return <Subnav label="Product pages" items={PRODUCT_PAGES} current={current} />;
}

export const SOLUTION_PAGES = [{ href: '/solutions', title: 'All solutions' }, ...SOLUTIONS.map((s) => ({ href: `/solutions/${s.slug}`, title: s.name }))];

/** Links between /solutions and its four audience pages. */
export function SolutionsSubnav({ current }: { current: string }) {
    return <Subnav label="Solutions pages" items={SOLUTION_PAGES} current={current} />;
}
