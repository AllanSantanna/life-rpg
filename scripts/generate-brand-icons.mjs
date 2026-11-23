/** Rebuild installable PNGs from the local vector. Playwright is tooling only. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? 'playwright'
);
const directory = resolve('apps/web/public/icons');
const svg = await readFile(`${directory}/icon.svg`, 'utf8');
const browser = await chromium.launch({ headless: true });
try {
  for (const [name, size, maskable] of [
    ['icon-192.png', 192, false],
    ['icon-512.png', 512, false],
    ['icon-maskable-512.png', 512, true],
  ]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    // Maskable art stays within the central safe circle (radius 40%).
    const dimension = maskable ? size * 0.64 : size;
    await page.setContent(`<!doctype html><style>
      body { margin: 0; width: ${size}px; height: ${size}px; display: grid;
        place-items: center; background: ${maskable ? '#090909' : 'transparent'}; }
      svg { width: ${dimension}px; height: ${dimension}px; }
    </style>${svg}`);
    await page.screenshot({
      path: `${directory}/${name}`,
      omitBackground: true,
    });
    await page.close();
  }
} finally {
  await browser.close();
}
