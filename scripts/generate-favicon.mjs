/**
 * Rasterizes the freeabtest leaf mark into App Router favicon assets.
 * Source path geometry matches app/components/ui/Logo.tsx LeafMark.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const leafSvg = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-2 -2 36 36">
  <defs>
    <linearGradient id="leaf-g" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
      <stop stop-color="#2563eb"/>
      <stop offset="1" stop-color="#14b8a6"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="6" fill="#ffffff" fill-opacity="0"/>
  <path d="M5 27C5 14 13 5 28 4c0 15-8 24-21 24-.7 0-1.4 0-2-.1z" fill="url(#leaf-g)"/>
  <path d="M7 25C12 19 17 14 23 9" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" fill="none" opacity=".85"/>
</svg>`;

async function png(size, out, { opaque = false } = {}) {
    const svg = opaque
        ? leafSvg(size).replace('fill-opacity="0"', 'fill-opacity="1"').replace('<rect width="32" height="32" rx="6" fill="#ffffff" fill-opacity="1"/>', `<rect width="32" height="32" fill="#ffffff"/>`)
        : leafSvg(size);
    // Prefer sharp SVG; fall back to writing buffer
    const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
    fs.writeFileSync(out, buf);
    console.log('wrote', out, buf.length);
    return buf;
}

const app = path.join(root, 'app');
const pub = path.join(root, 'public');

// App Router icons
await png(32, path.join(app, 'icon.png'));
await png(180, path.join(app, 'apple-icon.png'));
await png(180, path.join(pub, 'apple-touch-icon.png'));
await png(192, path.join(pub, 'icon-192.png'));
await png(512, path.join(pub, 'icon-512.png'));

// Also keep a vector source
fs.writeFileSync(path.join(pub, 'leaf.svg'), leafSvg(32).replace('fill-opacity="0"', 'fill-opacity="0"'));

// Build multi-size favicon.ico via sharp pngs + to-ico style with png-to-ico if available,
// otherwise use a single 32px ico through sharp... sharp doesn't write ico well.
// Use `png-to-ico` dynamic import or pillow via child process.
const sizes = [16, 32, 48];
const pngs = [];
for (const s of sizes) {
    const buf = await sharp(Buffer.from(leafSvg(s))).resize(s, s).png().toBuffer();
    pngs.push(buf);
}
try {
    const pngToIco = (await import('png-to-ico')).default;
    const ico = await pngToIco(pngs);
    fs.writeFileSync(path.join(app, 'favicon.ico'), ico);
    fs.writeFileSync(path.join(pub, 'favicon.ico'), ico);
    console.log('wrote favicon.ico via png-to-ico', ico.length);
} catch (e) {
    console.warn('png-to-ico missing, falling back to python pillow', e.message);
    for (let i = 0; i < sizes.length; i++) {
        fs.writeFileSync(path.join('/tmp', `fav-${sizes[i]}.png`), pngs[i]);
    }
}
