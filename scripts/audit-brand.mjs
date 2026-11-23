/** Verify icon delivery across a real SW update, using disposable local profiles. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { resolve, extname, sep } from 'node:path';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? 'playwright'
);
const roots = {
  previous: resolve(
    process.env.PWA_PREVIOUS_DIST ?? '/tmp/lr-previous/apps/web/dist',
  ),
  current: resolve('apps/web/dist'),
};
const out = resolve(process.env.AUDIT_OUTPUT ?? '/tmp/life-rpg-lr/brand');
await fs.mkdir(out, { recursive: true });
let release = 'previous';
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  const root = roots[release];
  let path = resolve(root, `.${pathname}`);
  if (!path.startsWith(root + sep)) {
    res.writeHead(403);
    return res.end();
  }
  if (!extname(path)) path = `${root}/index.html`;
  try {
    const bytes = await fs.readFile(path);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(
      'Content-Type',
      types[extname(path)] ?? 'application/octet-stream',
    );
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const results = [];
try {
  const page = await context.newPage();
  await page.goto(`${base}/perfil`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const name = page.getByRole('textbox', { name: 'Nome do jogador' });
  await name.fill('Teste de marca isolado');
  await page.getByRole('button', { name: 'Salvar nome' }).click();
  await page
    .getByText('Registros salvos neste navegador · evolução real', {
      exact: true,
    })
    .waitFor();
  const snapshot = (target) =>
    target.evaluate(async () => {
      const db = await new Promise((done) => {
        const r = globalThis.indexedDB.open('life-rpg:records');
        r.onsuccess = () => done(r.result);
      });
      return new Promise((done) => {
        const r = db.transaction('state').objectStore('state').get('current');
        r.onsuccess = () => {
          db.close();
          done(JSON.stringify(r.result));
        };
      });
    });
  const before = await snapshot(page);
  assert.ok(before.includes('Teste de marca isolado'));
  const old = await page.evaluate(async () =>
    (await fetch('/icons/icon.svg')).text(),
  );
  release = 'current';
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  await page.waitForFunction(
    async () => !!(await navigator.serviceWorker.getRegistration())?.waiting,
  );
  assert.equal(
    await page.evaluate(async () => (await fetch('/icons/icon.svg')).text()),
    old,
  );
  results.push('A aba antiga mantém seu ícone enquanto a nova versão aguarda.');
  await page.close();
  const next = await context.newPage();
  await next.goto(`${base}/perfil`);
  await next.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return (
      !registration?.waiting && registration?.active?.state === 'activated'
    );
  });
  // A navigation racing activation can still use the previous document once.
  await next.goto('about:blank');
  await next.goto(`${base}/perfil`);
  await next.getByRole('img', { name: 'Life RPG' }).first().waitFor();
  const vector = await fs.readFile(`${roots.current}/icons/icon.svg`, 'utf8');
  assert.equal(
    await next.evaluate(async () => (await fetch('/icons/icon.svg')).text()),
    vector,
  );
  for (const icon of [
    'icon-192.png',
    'icon-512.png',
    'icon-maskable-512.png',
  ]) {
    const encoded = await next.evaluate(async (icon) => {
      const bytes = new Uint8Array(
        await (await fetch(`/icons/${icon}`)).arrayBuffer(),
      );
      return Array.from(bytes);
    }, icon);
    assert.deepEqual(
      Buffer.from(encoded),
      await fs.readFile(`${roots.current}/icons/${icon}`),
    );
  }
  assert.equal(await nameValue(next), 'Teste de marca isolado');
  assert.equal(await snapshot(next), before);
  await context.setOffline(true);
  await next.reload();
  assert.equal(await nameValue(next), 'Teste de marca isolado');
  const current = await next.evaluate(async () =>
    (await fetch('/icons/icon.svg')).text(),
  );
  assert.equal(current, vector);
  results.push(
    'SVG e três PNGs novos entregues após ativação; marca disponível offline e nome preservado.',
  );
  // Draw the source at the requested physical sizes, on both host backgrounds.
  await context.setOffline(false);
  await next.setViewportSize({ width: 1100, height: 900 });
  await next.setContent(
    `<!doctype html><style>body{margin:24px;font:16px system-ui;background:#171717;color:#f5f5f5}.row{display:flex;gap:24px;align-items:center;padding:24px}.light{background:white;color:#090909}figure{margin:0;text-align:center}img{display:block}figcaption{margin-top:8px}</style>${['dark', 'light'].map((theme) => `<div class="row ${theme}">${[16, 32, 48, 192, 512].map((size) => `<figure><img alt="LR" src="${base}/icons/icon.svg" width="${size}" height="${size}"><figcaption>${size}px</figcaption></figure>`).join('')}</div>`).join('')}`,
  );
  await next
    .locator('img')
    .evaluateAll((imgs) => Promise.all(imgs.map((img) => img.decode())));
  await next.screenshot({ path: `${out}/brand-sizes.png`, fullPage: true });
  // Original snapshot retained as evidence; this script never opens user profiles.
  await fs.writeFile(
    `${out}/results.json`,
    JSON.stringify(
      {
        results,
        preservedName: 'Teste de marca isolado',
        initialSnapshotCaptured: !!before,
      },
      null,
      2,
    ),
  );
  console.log(results.join('\n'));
} catch (error) {
  for (const [index, page] of context.pages().entries()) {
    await page
      .screenshot({ path: `${out}/failure-${index}.png` })
      .catch(() => {});
    console.error(
      await page
        .evaluate(() => ({
          url: globalThis.location.href,
          text: globalThis.document.body.innerText.slice(0, 400),
          scripts: [...globalThis.document.scripts].map((s) => s.src),
        }))
        .catch(() => null),
    );
  }
  throw error;
} finally {
  await context.close();
  await browser.close();
  await new Promise((done) => server.close(done));
}
async function nameValue(page) {
  const input = page.getByRole('textbox', { name: 'Nome do jogador' });
  await input.waitFor();
  return input.inputValue();
}
