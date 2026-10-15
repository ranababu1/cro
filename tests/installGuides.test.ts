import { describe, it, expect } from 'vitest';
import { blockText, getDocPage } from '@/lib/docs';

describe('install guides page', () => {
    const page = getDocPage('install-guides')!;
    const text = page.blocks.map(blockText).join('\n');

    it('covers Google Tag Manager and WordPress with anchors', () => {
        expect(page).toBeTruthy();
        const ids = page.blocks.filter((b) => b.type === 'h2').map((b) => ('id' in b ? b.id : ''));
        expect(ids).toEqual(expect.arrayContaining(['gtm', 'wordpress', 'check']));
        expect(text).toMatch(/Custom HTML/);
        expect(text).toMatch(/Initialization - All Pages/);
        expect(text).toMatch(/wp_head/);
    });

    it('uses the live snippet and no placeholders to replace', () => {
        expect(text).toContain('https://www.freeabtest.com/sdk.js');
        expect(text).not.toMatch(/YOUR_SDK_KEY|YOUR_HOST|YOUR-HOST/);
    });

    it('is linked from quick start', () => {
        expect(getDocPage('quick-start')!.blocks.map(blockText).join('\n')).toContain('/docs/install-guides');
    });
});
