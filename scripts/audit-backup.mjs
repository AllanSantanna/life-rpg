/**
 * Auditoria nativa do backup manual: IndexedDB real em Chromium, conexões
 * independentes, abortos forçados, corrida entre abas e a interface real em
 * desktop e em emulação móvel (Pixel 7), incluindo offline. Usa somente dados
 * SINTÉTICOS e perfis descartáveis do Playwright; nunca um perfil real.
 *
 * Requer o Vite local (AUDIT_BASE_URL, padrão http://127.0.0.1:5173) e o
 * Playwright fora do projeto (PLAYWRIGHT_MODULE), como as demais auditorias.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  readCanonical,
  readSnapshot,
  resetFixtureDatabase,
  waitForCommit,
} from './audit-storage-helpers.mjs';

const { chromium, devices } = await import(
  process.env.PLAYWRIGHT_MODULE ?? 'playwright'
);
const dev = (process.env.AUDIT_BASE_URL ?? 'http://127.0.0.1:5173').replace(
  /\/$/,
  '',
);
assert.equal(new URL(dev).hostname, '127.0.0.1');
const out = resolve(process.env.AUDIT_OUTPUT ?? `${tmpdir()}/life-rpg-backup`);
await fs.mkdir(out, { recursive: true });
// Origem isolada para os ensaios do repositório (sem a interface).
const server = http.createServer((_req, res) =>
  res.end('<!doctype html><title>Isolated backup storage tests</title>'),
);
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const isolated = `http://127.0.0.1:${server.address().port}`;
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
    JSON.stringify({ browser: browser.version(), results, errors }, null, 2),
  );
const desktop = {
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
  acceptDownloads: true,
};
const mobile = { ...devices['Pixel 7'], ...desktop };

async function scenario(name, run, options = desktop) {
  const context = await browser.newContext(options);
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
/** Página isolada com o repositório transacional real importado do Vite. */
async function storagePage(context) {
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(isolated);
  await page.evaluate(async (dev) => {
    const state = await import(`${dev}/src/app/playerState.ts`);
    const native = await import(
      `${dev}/src/shared/storage/transactionalStateStorage.ts`
    );
    const { syntheticPlayer } = await import(
      `${dev}/src/test/backupFixtures.ts`
    );
    window.makeRepo = () =>
      native.createTransactionalStateStorage({
        key: state.PLAYER_STORAGE_KEY,
        version: state.PLAYER_STORAGE_VERSION,
        validate: state.isPlayerState,
        migrate: state.migratePlayerState,
      });
    window.repo = window.makeRepo();
    window.fixture = syntheticPlayer;
    window.initial = state.createInitialPlayerState;
    window.listCopies = () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('life-rpg:records', 1);
        request.onsuccess = () => {
          const tx = request.result.transaction('copies', 'readonly');
          const all = tx.objectStore('copies').getAll();
          all.onsuccess = () => {
            request.result.close();
            resolve(all.result);
          };
        };
        request.onerror = () => reject(request.error);
      });
  }, dev);
  return page;
}
/** App real com um canônico sintético gravado pelo repositório real. */
async function appPage(context, data) {
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(dev);
  await resetFixtureDatabase(page);
  if (data !== null)
    await page.evaluate(
      async ({ dev, data }) => {
        const state = await import(`${dev}/src/app/playerState.ts`);
        const native = await import(
          `${dev}/src/shared/storage/transactionalStateStorage.ts`
        );
        const { syntheticPlayer } = await import(
          `${dev}/src/test/backupFixtures.ts`
        );
        const repo = native.createTransactionalStateStorage({
          key: state.PLAYER_STORAGE_KEY,
          version: state.PLAYER_STORAGE_VERSION,
          validate: state.isPlayerState,
          migrate: state.migratePlayerState,
        });
        const value = syntheticPlayer(data.scale);
        value.profile.name = data.name;
        const loaded = await repo.load();
        const result = await repo.write(value, loaded.token ?? null);
        if (result.status !== 'saved') throw new Error(result.status);
      },
      { dev, data },
    );
  await page.reload();
  await page.locator('.app-shell').waitFor();
  return page;
}
async function openProfile(page) {
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  const profile = nav.getByRole('button', { name: 'Perfil' });
  if (await profile.isVisible()) await profile.click();
  else
    await page.evaluate(() =>
      window.history.pushState(null, '', '/?view=profile'),
    );
  const section = page.getByRole('region', { name: 'Backup de dados' });
  await section.waitFor();
  return section;
}
async function exportFile(page, section, tap = false) {
  const button = section.getByRole('button', { name: 'Exportar dados' });
  const pending = page.waitForEvent('download');
  await (tap ? button.tap() : button.click());
  const download = await pending;
  const path = `${out}/${Date.now()}-${download.suggestedFilename()}`;
  await download.saveAs(path);
  await section.getByRole('status').filter({ hasText: 'iniciado' }).waitFor();
  return { path, name: download.suggestedFilename() };
}
async function importFile(page, section, path, tap = false) {
  const button = section.getByRole('button', { name: 'Importar dados' });
  const chooser = page.waitForEvent('filechooser');
  await (tap ? button.tap() : button.click());
  await (await chooser).setFiles(path);
  const group = page.getByRole('group', { name: 'Prévia do backup' });
  await group.waitFor();
  return group;
}
const stable = (text) => {
  const file = JSON.parse(text);
  delete file.exportedAt;
  return file;
};
async function noHorizontalOverflow(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  assert.ok(overflow <= 1, `rolagem horizontal de ${overflow}px`);
}

try {
  // ---------- Repositório transacional nativo ----------
  await scenario(
    'importação substitui o canônico e guarda o anterior na mesma transação',
    async (context) => {
      const page = await storagePage(context);
      const result = await page.evaluate(async () => {
        const first = await window.repo.load();
        const original = window.initial();
        original.profile.name = 'Estado anterior';
        const saved = await window.repo.write(original, first.token ?? null);
        const before = await window.repo.readRaw();
        const incoming = window.fixture(3);
        const imported = await window.repo.importBackup(incoming, saved.token);
        const after = await window.repo.load();
        const copies = await window.listCopies();
        return {
          saved,
          imported,
          after,
          before,
          incoming,
          copies,
          legacy: localStorage.getItem('life-rpg:player-state'),
        };
      });
      assert.equal(result.imported.status, 'saved');
      assert.equal(result.after.token, 'idb:2');
      assert.deepEqual(result.after.data, result.incoming);
      const copy = result.copies.find((c) => c.reason === 'before-import');
      assert.equal(copy.raw, result.before);
      assert.equal(result.legacy, null);
    },
  );
  await scenario(
    'outra conexão gravou depois da prévia: conflito sem alteração nem cópia',
    async (context) => {
      const page = await storagePage(context);
      const result = await page.evaluate(async () => {
        const a = window.makeRepo(),
          b = window.makeRepo();
        const first = await a.load();
        const saved = await a.write(window.initial(), first.token ?? null);
        const other = window.fixture();
        other.profile.name = 'Outra aba';
        const won = await b.write(other, saved.token);
        const imported = await a.importBackup(window.fixture(2), saved.token);
        return {
          won,
          imported,
          after: await a.load(),
          copies: await window.listCopies(),
        };
      });
      assert.equal(result.won.status, 'saved');
      assert.equal(result.imported.status, 'conflict');
      assert.equal(result.after.data.profile.name, 'Outra aba');
      assert.equal(result.copies.length, 0);
    },
  );
  for (const store of ['state', 'copies'])
    await scenario(
      `aborto em ${store} durante a restauração preserva o estado e não deixa cópia`,
      async (context) => {
        const page = await storagePage(context);
        const result = await page.evaluate(async (store) => {
          const first = await window.repo.load();
          const saved = await window.repo.write(
            window.fixture(),
            first.token ?? null,
          );
          const before = await window.repo.load();
          const method = store === 'state' ? 'put' : 'add';
          const original = IDBObjectStore.prototype[method];
          IDBObjectStore.prototype[method] = function (...args) {
            const request = original.apply(this, args);
            if (this.name === store) this.transaction.abort();
            return request;
          };
          const failed = await window.repo.importBackup(
            window.initial(),
            saved.token,
          );
          IDBObjectStore.prototype[method] = original;
          return {
            failed,
            before,
            after: await window.repo.load(),
            copies: await window.listCopies(),
          };
        }, store);
        assert.equal(result.failed.status, 'failed');
        assert.equal(result.after.token, result.before.token);
        assert.deepEqual(result.after.data, result.before.data);
        assert.equal(result.copies.length, 0);
      },
    );
  await scenario(
    'dispositivo novo: importação cria o canônico sem cópia vazia',
    async (context) => {
      const page = await storagePage(context);
      const result = await page.evaluate(async () => {
        const first = await window.repo.load();
        const imported = await window.repo.importBackup(
          window.fixture(),
          first.token ?? null,
        );
        return {
          first,
          imported,
          after: await window.repo.load(),
          copies: await window.listCopies(),
        };
      });
      assert.equal(result.first.status, 'missing');
      assert.equal(result.imported.status, 'saved');
      assert.equal(result.after.data.profile.name, 'Jogador Sintético');
      assert.equal(result.copies.length, 0);
    },
  );
  await scenario(
    'registros protegidos: importação explícita guarda o original e não toca o legado',
    async (context) => {
      const page = await storagePage(context);
      const result = await page.evaluate(async () => {
        const raw = JSON.stringify({ version: 8, data: { broken: true } });
        localStorage.setItem('life-rpg:player-state', raw);
        const first = await window.repo.load();
        const imported = await window.repo.importBackup(
          window.fixture(),
          first.token ?? null,
        );
        return {
          raw,
          first,
          imported,
          after: await window.repo.load(),
          copies: await window.listCopies(),
          legacy: localStorage.getItem('life-rpg:player-state'),
        };
      });
      assert.equal(result.first.status, 'invalid');
      assert.equal(result.imported.status, 'saved');
      assert.equal(result.after.status, 'loaded');
      assert.equal(result.legacy, result.raw);
      const reasons = result.copies.map((c) => c.reason).sort();
      assert.deepEqual(reasons, ['before-import', 'protected-original']);
      assert.ok(result.copies.every((c) => c.raw === result.raw));
    },
  );
  await scenario(
    '20 importações simultâneas com a mesma revisão: exatamente uma vence',
    async (context) => {
      const page = await storagePage(context);
      const result = await page.evaluate(async () => {
        const first = await window.repo.load();
        const saved = await window.repo.write(
          window.initial(),
          first.token ?? null,
        );
        const outcomes = await Promise.all(
          Array.from({ length: 20 }, (_, i) => {
            const value = window.fixture();
            value.profile.name = `Importação ${i}`;
            return window.makeRepo().importBackup(value, saved.token);
          }),
        );
        return {
          outcomes: outcomes.map((o) => o.status),
          after: await window.repo.load(),
          copies: await window.listCopies(),
        };
      });
      assert.equal(result.outcomes.filter((s) => s === 'saved').length, 1);
      assert.equal(result.outcomes.filter((s) => s === 'conflict').length, 19);
      assert.equal(result.after.token, 'idb:2');
      assert.equal(result.copies.length, 1);
    },
  );

  // ---------- Interface real ----------
  let desktopFile;
  await scenario(
    'computador: exportar arquivo com o canônico confirmado',
    async (context) => {
      const page = await appPage(context, { scale: 5, name: 'Computador' });
      const section = await openProfile(page);
      for (const width of [1440, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        await noHorizontalOverflow(page);
        await section.screenshot({ path: `${out}/section-${width}.png` });
      }
      desktopFile = await exportFile(page, section);
      assert.match(
        desktopFile.name,
        /^life-rpg-backup-\d{4}-\d{2}-\d{2}\.json$/,
      );
      const file = JSON.parse(await fs.readFile(desktopFile.path, 'utf8'));
      const canonical = JSON.parse(await readSnapshot(page));
      assert.equal(file.format, 'life-rpg-backup');
      assert.equal(file.formatVersion, 1);
      assert.deepEqual(file.payload, canonical);
      assert.equal(file.summary.movements, 15);
    },
  );
  let mobileFile;
  await scenario(
    'celular (Pixel 7, toque): importar, restaurar, exportar e conferir equivalência',
    async (context) => {
      assert.ok(desktopFile, 'exportação do computador indisponível');
      const page = await appPage(context, { scale: 1, name: 'Celular antigo' });
      const section = await openProfile(page);
      await noHorizontalOverflow(page);
      const group = await importFile(page, section, desktopFile.path, true);
      assert.ok(await group.getByText('Computador').isVisible());
      assert.equal(
        await group
          .getByRole('button', { name: 'Cancelar' })
          .evaluate((el) => el === document.activeElement),
        true,
      );
      await noHorizontalOverflow(page);
      await page.screenshot({
        path: `${out}/mobile-preview.png`,
        fullPage: true,
      });
      await group.getByRole('button', { name: 'Restaurar backup' }).tap();
      await section
        .getByRole('status')
        .filter({ hasText: 'Backup restaurado' })
        .waitFor();
      const file = JSON.parse(await fs.readFile(desktopFile.path, 'utf8'));
      const canonical = JSON.parse(await readSnapshot(page));
      assert.deepEqual(canonical.data.records, file.payload.data.records);
      assert.deepEqual(canonical.data.goals, file.payload.data.goals);
      assert.equal(canonical.data.profile.name, 'Computador');
      assert.equal(
        await page
          .getByRole('textbox', { name: 'Nome do jogador' })
          .inputValue(),
        'Computador',
      );
      await page
        .getByRole('region', { name: 'Cópias de segurança dos registros' })
        .getByText('Antes de importar um backup')
        .waitFor();
      mobileFile = await exportFile(page, section, true);
      assert.deepEqual(
        stable(await fs.readFile(mobileFile.path, 'utf8')),
        stable(await fs.readFile(desktopFile.path, 'utf8')),
      );
    },
    mobile,
  );
  await scenario(
    'processo inverso: backup do celular restaurado no computador',
    async (context) => {
      assert.ok(mobileFile, 'exportação do celular indisponível');
      const page = await appPage(context, null);
      const section = await openProfile(page);
      const group = await importFile(page, section, mobileFile.path);
      await group.getByRole('button', { name: 'Restaurar backup' }).click();
      await section
        .getByRole('status')
        .filter({ hasText: 'Backup restaurado' })
        .waitFor();
      const again = await exportFile(page, section);
      assert.deepEqual(
        stable(await fs.readFile(again.path, 'utf8')),
        stable(await fs.readFile(mobileFile.path, 'utf8')),
      );
    },
  );
  await scenario(
    'conflito entre abas durante a confirmação não sobrescreve a outra aba',
    async (context) => {
      assert.ok(desktopFile);
      const a = await appPage(context, { scale: 1, name: 'Aba A' });
      const sectionA = await openProfile(a);
      const group = await importFile(a, sectionA, desktopFile.path);
      const b = await context.newPage();
      await b.goto(dev);
      await b.locator('.app-shell').waitFor();
      await openProfile(b);
      const name = b.getByRole('textbox', { name: 'Nome do jogador' });
      await name.fill('Gravado na aba B');
      const previous = await readCanonical(b);
      await b.getByRole('button', { name: 'Salvar nome' }).click();
      // A aba B precisa ter confirmado o commit antes da confirmação na aba A.
      const committed = JSON.parse(await waitForCommit(b, previous));
      assert.equal(committed.data.profile.name, 'Gravado na aba B');
      await b
        .getByText('Registros salvos neste navegador · evolução real')
        .waitFor();
      await group.getByRole('button', { name: 'Restaurar backup' }).click();
      await sectionA
        .getByRole('alert')
        .filter({ hasText: 'alterados em outra aba' })
        .waitFor();
      const canonical = JSON.parse(await readSnapshot(a));
      assert.equal(canonical.data.profile.name, 'Gravado na aba B');
    },
  );
  await scenario(
    'offline: exportação e importação não dependem de rede',
    async (context) => {
      assert.ok(desktopFile);
      const page = await appPage(context, { scale: 1, name: 'Offline' });
      const section = await openProfile(page);
      await context.setOffline(true);
      const file = await exportFile(page, section);
      assert.equal(
        JSON.parse(await fs.readFile(file.path, 'utf8')).format,
        'life-rpg-backup',
      );
      const group = await importFile(page, section, desktopFile.path);
      await group.getByRole('button', { name: 'Restaurar backup' }).click();
      await section
        .getByRole('status')
        .filter({ hasText: 'Backup restaurado' })
        .waitFor();
      await context.setOffline(false);
    },
  );
  await scenario(
    'arquivo inválido e versão futura são recusados sem alterar o canônico (320 px, teclado)',
    async (context) => {
      const page = await appPage(context, { scale: 1, name: 'Intacto' });
      await page.setViewportSize({ width: 320, height: 800 });
      const section = await openProfile(page);
      const before = await readSnapshot(page);
      const bad = `${out}/invalid.json`;
      await fs.writeFile(bad, '{"format":"life-rpg-backup",');
      const future = `${out}/future.json`;
      await fs.writeFile(
        future,
        JSON.stringify({ version: 99, data: { anything: true } }),
      );
      for (const [path, text] of [
        [bad, 'corrompido'],
        [future, 'formato mais novo'],
      ]) {
        const chooser = page.waitForEvent('filechooser');
        await section.getByRole('button', { name: 'Importar dados' }).focus();
        await page.keyboard.press('Enter');
        await (await chooser).setFiles(path);
        await section.getByRole('alert').filter({ hasText: text }).waitFor();
      }
      await noHorizontalOverflow(page);
      await section.screenshot({ path: `${out}/section-320-error.png` });
      assert.equal(await readSnapshot(page), before);
      // Cancelar por teclado também preserva o canônico.
      const group = await importFile(page, section, desktopFile.path);
      await page.screenshot({ path: `${out}/preview-320.png`, fullPage: true });
      await noHorizontalOverflow(page);
      await page.keyboard.press('Escape');
      await group.waitFor({ state: 'detached' });
      assert.equal(await readSnapshot(page), before);
    },
  );
} finally {
  await save();
  await browser.close();
  await new Promise((done) => server.close(done));
}
console.log(
  `${results.length} cenários; ${results.filter((r) => !r.passed).length} falhas; ${errors.length} erros de página. ${out}`,
);
if (results.some((r) => !r.passed) || errors.length) process.exitCode = 1;
