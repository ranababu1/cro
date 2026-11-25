/**
 * Non-blog pages never name other products (tests/publicContent.test.ts). Lists of blog posts shown
 * outside /blog (the resources hub) skip posts whose title or description names one. This file holds
 * the names only to filter them out; it renders nothing, so it is not in the public file list.
 */
export const NAMES_OTHER_PRODUCTS = /optimizely|google optimize|\bvwo\b|\bconvert\b|crazy ?egg|hotjar|ab tasty|clarity|alternatives/i;
export const listablePost = (p: { title: string; description: string }) => !NAMES_OTHER_PRODUCTS.test(p.title) && !NAMES_OTHER_PRODUCTS.test(p.description);
