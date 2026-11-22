/**
 * Auditoria do build do GitHub Pages (`npm run build:pages`). Serve
 * apps/web/dist-pages em /life-rpg/ numa origem local temporária, imitando o
 * GitHub Pages: arquivos estáticos, sem fallback de SPA, e 404.html com status
 * 404 para caminhos inexistentes. Usa perfis descartáveis do Playwright e dados
 * SINTÉTICOS (gerados pelo Vite local); nunca um perfil real.
 *
 * Requer PLAYWRIGHT_MODULE e o Vite local (AUDIT_BASE_URL) para o fixture.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { readCanonical, waitForCommit } from './audit-storage-helpers.mjs';

const { chromium, devices } = await import(
  process.env.PLAYWRIGHT_MODULE ?? 'playwright'
);
const dev = (process.env.AUDIT_BASE_URL ?? 'http://127.0.0.1:5173').replace(
  /\/$/,
  '',
);
assert.equal(new URL(dev).hostname, '127.0.0.1');
const root = resolve(process.env.PAGES_DIST ?? 'apps/web/dist-pages');
const out = resolve(process.env.AUDIT_OUTPUT ?? `${tmpdir()}/life-rpg-pages`);
await fs.mkdir(out, { recursive: true });
await fs.access(join(root, '404.html'));
const BASE = '/life-rpg/';
const types = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
};
/** Release servido: `next` altera o sw.js para simular uma nova versão. */
let release = 'current';
const outsideBase = [];
const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://127.0.0.1');
  if (!pathname.startsWith(BASE)) {
    outsideBase.push(pathname);
    res.writeHead(404).end('fora da base');
    return;
  }
  let file = resolve(root, decodeURIComponent(pathname.slice(BASE.length)));
  if (!file.startsWith(root + sep) && file !== root) {
    res.writeHead(403).end();
    return;
  }
  try {
    if ((await fs.stat(file)).isDirectory()) file = join(file, 'index.html');
    let body = await fs.readFile(file);
    if (release === 'next' && file.endsWith(`${sep}sw.js`))
      body = Buffer.concat([body, Buffer.from('\n// next release\n')]);
    res.writeHead(200, {
      'content-type': types[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(body);
  } catch {
    // Como o GitHub Pages: 404.html com status 404.
    res.writeHead(404, { 'content-type': 'text/html' });
    res.end(await fs.readFile(join(root, '404.html')));
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const site = `${origin}${BASE}`;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
});
const results = [],
  errors = [];
const save = () =>
  fs.writeFile(
    `${out}/results.json`,
    JSON.stringify(
      { browser: browser.version(), results, errors, outsideBase },
      null,
      2,
    ),
  );
const desktop = {
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
  acceptDownloads: true,
};
const mobile = { ...devices['Pixel 7'], ...desktop };

/** Backup sintético gerado pelo código real, no Vite local. */
async function syntheticBackup(context) {
  const page = await context.newPage();
  await page.goto(`${dev}/`);
  const content = await page.evaluate(async (dev) => {
    const { syntheticPlayer } = await import(
      `${dev}/src/test/backupFixtures.ts`
    );
    const { createBackupFile } = await import(`${dev}/src/app/backupFile.ts`);
    const value = syntheticPlayer(2);
    value.profile.name = 'Pages sintético';
    return createBackupFile(JSON.stringify({ version: 8, data: value }))
      .content;
  }, dev);
  await page.close();
  const path = `${out}/synthetic-backup.json`;
  await fs.writeFile(path, content);
  return path;
}
let backupPath;

async function scenario(name, run, options = desktop) {
  const context = await browser.newContext(options);
  // Serviços públicos de cotação ficam fora do teste (determinismo); a
  // falha deles também precisa ser tolerada pelo app.
  await context.route(
    /^https:\/\/(api\.coingecko\.com|olinda\.bcb\.gov\.br)\//,
    (route) => route.abort(),
  );
  try {
    await run(context);
    results.push({ name, passed: true });
    console.log('PASS', name);
  } catch (error) {
    results.push({ name, passed: false, message: error.message });
    console.log('FAIL', name, error.message);
  } finally {
    await context.close();
    await save();
  }
}
function watch(page) {
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      !/Failed to load resource|ERR_FAILED|ERR_INTERNET_DISCONNECTED/.test(
        message.text(),
      )
    )
      errors.push(`console: ${message.text()}`);
  });
  page.on('request', (request) => {
    const url = request.url();
    if (/localhost|:3001\//.test(url)) errors.push(`requisição local: ${url}`);
  });
  return page;
}
async function open(context, path = '') {
  const page = watch(await context.newPage());
  await page.goto(`${site}${path}`);
  await page.locator('.app-shell').waitFor();
  return page;
}
async function controlled(page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload();
    await page.locator('.app-shell').waitFor();
  }
  assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller));
}
async function nav(page, name) {
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('button', { name })
    .click();
}
async function importBackup(page, path) {
  await nav(page, 'Perfil');
  const section = page.getByRole('region', { name: 'Backup de dados' });
  const chooser = page.waitForEvent('filechooser');
  await section.getByRole('button', { name: 'Importar dados' }).click();
  await (await chooser).setFiles(path);
  await page
    .getByRole('group', { name: 'Prévia do backup' })
    .getByRole('button', { name: 'Restaurar backup' })
    .click();
  await section
    .getByRole('status')
    .filter({ hasText: 'Backup restaurado' })
    .waitFor();
}
async function noOverflow(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  assert.ok(overflow <= 1, `rolagem horizontal de ${overflow}px`);
}

try {
  await scenario(
    'fixture sintético gerado pelo código real',
    async (context) => {
      backupPath = await syntheticBackup(context);
    },
  );
  await scenario(
    'manifest, ícones, instalação e service worker no escopo /life-rpg/',
    async (context) => {
      const page = await open(context);
      const manifestUrl = await page
        .locator('link[rel="manifest"]')
        .getAttribute('href');
      assert.equal(manifestUrl, `${BASE}manifest.webmanifest`);
      const manifest = await (
        await page.request.get(`${origin}${manifestUrl}`)
      ).json();
      assert.equal(manifest.start_url, BASE);
      assert.equal(manifest.scope, BASE);
      assert.equal(manifest.id, BASE);
      for (const icon of manifest.icons) {
        const response = await page.request.get(`${origin}${icon.src}`);
        assert.equal(response.status(), 200, icon.src);
        assert.equal(response.headers()['content-type'], 'image/png');
      }
      await controlled(page);
      const scope = await page.evaluate(
        async () => (await navigator.serviceWorker.ready).scope,
      );
      assert.equal(scope, site);
      const cdp = await context.newCDPSession(page);
      const { installabilityErrors } = await cdp.send(
        'Page.getInstallabilityErrors',
      );
      assert.deepEqual(installabilityErrors, []);
      const caches = await page.evaluate(async () => {
        const names = await window.caches.keys();
        const urls = [];
        for (const name of names)
          for (const request of await (await window.caches.open(name)).keys())
            urls.push(request.url);
        return urls;
      });
      assert.ok(
        caches.some((url) => new URL(url).pathname === `${BASE}index.html`),
      );
      assert.ok(caches.every((url) => url.startsWith(site)));
    },
  );
  await scenario(
    'links diretos e recarga sem fallback do servidor permanecem em /life-rpg/',
    async (context) => {
      const page = await open(context, 'perfil');
      await page.getByRole('region', { name: 'Backup de dados' }).waitFor();
      await nav(page, 'Quests');
      assert.equal(new URL(page.url()).pathname, `${BASE}quests`);
      await page.reload();
      await page.locator('.app-shell').waitFor();
      assert.equal(new URL(page.url()).pathname, `${BASE}quests`);
      await page.goBack();
      assert.equal(new URL(page.url()).pathname, `${BASE}perfil`);
      await nav(page, 'Início');
      assert.equal(new URL(page.url()).pathname, BASE);
    },
  );
  await scenario(
    'offline após o primeiro carregamento, com dados preservados no IndexedDB',
    async (context) => {
      const page = await open(context);
      await controlled(page);
      await nav(page, 'Perfil');
      const name = page.getByRole('textbox', { name: 'Nome do jogador' });
      await name.fill('Jogador offline');
      const previous = await readCanonical(page).catch(() => null);
      // Commit lento e determinístico (como num disco de CI): outra aba
      // segura uma transação readwrite e a gravação do nome fica na fila.
      const blocker = await context.newPage();
      await blocker.goto(`${site}licenses/`);
      await blocker.evaluate(
        () =>
          new Promise((ready) => {
            const request = indexedDB.open('life-rpg:records', 1);
            request.onsuccess = () => {
              const store = request.result
                .transaction(['state', 'copies'], 'readwrite')
                .objectStore('state');
              window.hold = true;
              ready();
              const spin = () => {
                if (window.hold) store.get('current').onsuccess = spin;
              };
              spin();
            };
          }),
      );
      await page.getByRole('button', { name: 'Salvar nome' }).click();
      await page
        .getByText('Gravação em andamento · aguarde a confirmação', {
          exact: true,
        })
        .waitFor();
      await blocker.evaluate(() => {
        window.hold = false;
      });
      // Commit confirmado no IndexedDB antes de navegar (sinal inequívoco).
      const committed = JSON.parse(await waitForCommit(page, previous));
      await blocker.close();
      assert.equal(committed.data.profile.name, 'Jogador offline');
      await page
        .getByText('Registros salvos neste navegador · evolução real')
        .waitFor();
      await context.setOffline(true);
      for (const path of ['', 'perfil', 'treinos']) {
        await page.goto(`${site}${path}`);
        await page.locator('.app-shell').waitFor();
      }
      await nav(page, 'Perfil');
      assert.equal(
        await page
          .getByRole('textbox', { name: 'Nome do jogador' })
          .inputValue(),
        'Jogador offline',
      );
      await context.setOffline(false);
    },
  );
  await scenario(
    'nova versão aguarda as abas antigas e não apaga os dados',
    async (context) => {
      release = 'current';
      const page = await open(context);
      await controlled(page);
      await importBackup(page, backupPath);
      const firstScript = await page.evaluate(
        async () => (await navigator.serviceWorker.ready).active.scriptURL,
      );
      release = 'next';
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready;
        await registration.update();
        const waitFor = () =>
          registration.waiting ??
          new Promise((done) => {
            registration.addEventListener('updatefound', () => {
              const worker = registration.installing;
              worker.addEventListener('statechange', () => {
                if (worker.state === 'installed') done(worker);
              });
            });
          });
        await waitFor();
      });
      // Sem skipWaiting: a aba aberta continua na versão anterior.
      assert.ok(
        await page.evaluate(
          async () => !!(await navigator.serviceWorker.ready).waiting,
        ),
      );
      await page.goto('about:blank');
      await page.close();
      const next = await open(context, 'perfil');
      await next.waitForFunction(
        async () => !(await navigator.serviceWorker.getRegistration())?.waiting,
      );
      assert.equal(
        await next
          .getByRole('textbox', { name: 'Nome do jogador' })
          .inputValue(),
        'Pages sintético',
      );
      assert.ok(firstScript.endsWith(`${BASE}sw.js`));
      release = 'current';
    },
  );
  await scenario(
    'celular: importar e exportar backup, finanças sem API de cotações',
    async (context) => {
      const page = await open(context);
      await importBackup(page, backupPath);
      const section = page.getByRole('region', { name: 'Backup de dados' });
      const pending = page.waitForEvent('download');
      await section.getByRole('button', { name: 'Exportar dados' }).tap();
      const download = await pending;
      const saved = `${out}/pages-export.json`;
      await download.saveAs(saved);
      const exported = JSON.parse(await fs.readFile(saved, 'utf8'));
      const original = JSON.parse(await fs.readFile(backupPath, 'utf8'));
      assert.deepEqual(
        exported.payload.data.records,
        original.payload.data.records,
      );
      await nav(page, 'Pilares');
      await page
        .getByRole('navigation', { name: 'Quatro pilares' })
        .getByRole('button', { name: /Finanças/ })
        .tap();
      await page.getByRole('tab', { name: 'Investimentos' }).tap();
      await page
        .getByText(/Cotações da B3 indisponíveis nesta versão/)
        .first()
        .waitFor();
      await page.getByText('Ativo sintético 0').first().waitFor();
      await noOverflow(page);
      await page.screenshot({
        path: `${out}/mobile-finances.png`,
        fullPage: true,
      });
    },
    mobile,
  );
  await scenario(
    'responsivo em 320, 390, 768, 1024 e 1440 px',
    async (context) => {
      const page = await open(context);
      await importBackup(page, backupPath);
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const [label, view] of [
          ['inicio', 'Início'],
          ['perfil', 'Perfil'],
          ['quests', 'Quests'],
        ]) {
          await nav(page, view);
          await page.locator('.app-shell').waitFor();
          await noOverflow(page);
          await page.screenshot({
            path: `${out}/${label}-${width}.png`,
            fullPage: label === 'perfil',
          });
        }
      }
    },
  );
} finally {
  await save();
  await browser.close();
  await new Promise((done) => server.close(done));
}
const failed = results.filter((r) => !r.passed).length;
console.log(
  `${results.length} cenários; ${failed} falhas; ${errors.length} erros de página; ${outsideBase.length} requisições fora de ${BASE}. ${out}`,
);
if (failed || errors.length || outsideBase.length) process.exitCode = 1;
