import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CompareView, type Report } from '@/app/(app)/experiments/[id]/HeatmapsPanel';

const variations = [{ id: 'c', name: 'Control', url: null, is_control: true }, { id: 'b', name: 'Variation B', url: null, is_control: false }];
function report(id: string, cells: Array<[number, number, number]>, list: Array<[string, number]>): Report {
    const clicks = list.reduce((a, [, n]) => a + n, 0);
    return {
        variation: variations.find((v) => v.id === id)!,
        variations,
        devices: { desktop: { clicks, sessions: 1 }, tablet: { clicks: 0, sessions: 0 }, mobile: { clicks: 0, sessions: 0 } },
        grid: cells.map(([gx, gy, c]) => ({ gx, gy, clicks: c })),
        list: list.map(([selector, c]) => ({ selector, clicks: c, rage: 0, dead: 0 })),
        scroll: [{ depth: 50, reach: 40 }],
        confetti: [],
        totals: { clicks, rage: 0, dead: 0, sessions: 1 },
        cols: 100, rowPx: 10,
    };
}

describe('side-by-side heatmap comparison', () => {
    const a = report('c', [[1, 1, 5], [2, 2, 10]], [['#cta', 10], ['#nav', 5]]);
    const b = report('b', [[1, 1, 5], [3, 3, 20]], [['#cta', 20], ['#new', 5]]);
    it('shows both versions on one colour scale', () => {
        const html = renderToStaticMarkup(createElement(CompareView, { a, b, view: 'click', width: 1280 }));
        expect(html).toContain('Control (control)');
        expect(html).toContain('Variation B');
        expect(html).toContain('same colour scale');
        // A 5-click cell has the same colour on both sides because the scale is shared (max 20).
        const fives = [...html.matchAll(/background:([^"]+)" title="5 clicks"/g)].map((m) => m[1]);
        expect(fives).toHaveLength(2);
        expect(fives[0]).toBe(fives[1]);
    });
    it('merges element lists with clicks and shares for each side', () => {
        const html = renderToStaticMarkup(createElement(CompareView, { a, b, view: 'list', width: 1280 }));
        expect(html).toContain('heat-compare-list');
        const order = ['#cta', '#new', '#nav'].map((k) => html.indexOf(`>${k}<`));
        expect(order.every((i) => i > 0)).toBe(true);
        expect(order[0]).toBeLessThan(order[1]);
        expect(html).toContain('66.7%'); // #cta: 10 of 15 on the control
        expect(html).toContain('80.0%'); // #cta: 20 of 25 on B
    });
    it('renders scroll maps for both sides', () => {
        const html = renderToStaticMarkup(createElement(CompareView, { a, b, view: 'scroll', width: 390 }));
        expect(html.match(/heat-scroll/g)).toHaveLength(2);
    });
});
