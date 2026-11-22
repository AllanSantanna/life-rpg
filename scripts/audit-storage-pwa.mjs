import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { resolve, extname, sep } from 'node:path';
import { readCanonical, waitForCommit } from './audit-storage-helpers.mjs';

// Production builds are served only on a temporary loopback origin. Every
// scenario uses a disposable context; no user profile or remote site is used.
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? 'playwright'
);
const output = resolve(process.env.AUDIT_OUTPUT ?? '/tmp/life-rpg-storage-pwa');
const dev = process.env.AUDIT_BASE_URL ?? 'http://127.0.0.1:5173';
assert.equal(new URL(dev).hostname, '127.0.0.1');
const roots = {
  previous: resolve(
    process.env.PWA_PREVIOUS_DIST ??
      '/tmp/life-rpg-final/previous/apps/web/dist',
  ),
  legacy: resolve(
    process.env.PWA_LEGACY_DIST ??
      '/tmp/life-rpg-final/pre-trapezius/apps/web/dist',
  ),
  current: resolve('apps/web/dist'),
};
for (const root of Object.values(roots)) await fs.access(`${root}/sw.js`);
await fs.mkdir(output, { recursive: true });
let release = 'current';
let interrupt = false;
let raceArrival;
let raceResponse;
let queuedArrival;
const types = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};
const server = http.createServer(async (req, res) => {
  const pathname = decodeURIComponent(
    new URL(req.url, 'http://127.0.0.1').pathname,
  );
  res.setHeader('Cache-Control', 'no-store');
  if (pathname === '/race-queued') {
    queuedArrival?.();
    res.end('queued');
    return;
  }
  if (pathname === '/race-barrier') {
    raceResponse = res;
    raceArrival?.();
    return;
  }
  if (pathname === '/blank.html')
    return res.end('<!doctype html><title>Fixture</title>');
  if (interrupt && pathname.startsWith('/assets/')) {
    res.writeHead(503);
    return res.end('Simulated interruption');
  }
  const root = roots[release];
  let path = resolve(root, `.${pathname}`);
  if (!path.startsWith(root + sep) && path !== root) {
    res.writeHead(403);
    return res.end();
  }
  try {
    if (!extname(path)) path = `${root}/index.html`;
    const data = await fs.readFile(path);
    res.setHeader(
      'Content-Type',
      types[extname(path)] ?? 'application/octet-stream',
    );
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const results = [];
const blockers = [];
const errors = [];
const KEY = 'life-rpg:player-state';
const today = '2026-11-21';
const timestamp = new Date(`${today}T12:00:00-03:00`);
const save = () =>
  fs.writeFile(
    `${output}/results.json`,
    JSON.stringify({ results, blockers, errors }, null, 2),
  );
async function context(width = 1024, workers = 'block') {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    serviceWorkers: workers,
    reducedMotion: 'reduce',
    acceptDownloads: true,
  });
  await ctx.route('**/*', (route) =>
    [base, dev].some((origin) =>
      route
        .request()
        .url()
        .startsWith(origin + '/'),
    )
      ? route.continue()
      : route.abort(),
  );
  return ctx;
}
async function pageIn(ctx) {
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  await page.clock.setFixedTime(timestamp);
  page.on('pageerror', (error) =>
    errors.push({ scenario: release, message: error.message }),
  );
  return page;
}
const legacyAt = (page) =>
  page.evaluate((key) => localStorage.getItem(key), KEY);
const rawAt = async (page) => {
  await page.locator('.app-shell').waitFor();
  await page
    .getByText('Gravação em andamento · aguarde a confirmação', { exact: true })
    .waitFor({ state: 'hidden' });
  return page.evaluate(async (key) => {
    const dbs = await indexedDB.databases();
    if (!dbs.some((db) => db.name === 'life-rpg:records'))
      return localStorage.getItem(key);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('life-rpg:records', 1);
      request.onerror = () => reject(new Error('Falha na leitura canônica'));
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('state', 'readonly');
        const get = tx.objectStore('state').get('current');
        let raw;
        get.onsuccess = () => {
          raw = get.result?.raw ?? localStorage.getItem(key);
        };
        tx.oncomplete = () => {
          db.close();
          resolve(raw);
        };
        tx.onabort = () => {
          db.close();
          reject(new Error('Leitura abortada'));
        };
      };
    });
  }, KEY);
};
const copiesAt = (page) =>
  page.evaluate(async () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('life-rpg:records', 1);
      request.onerror = () => reject(new Error('Falha na leitura das cópias'));
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('copies', 'readonly');
        const get = tx.objectStore('copies').getAll();
        let rows = [];
        get.onsuccess = () => {
          rows = get.result;
        };
        tx.oncomplete = () => {
          db.close();
          resolve(rows);
        };
        tx.onabort = () => {
          db.close();
          reject(new Error('Cópias indisponíveis'));
        };
      };
    });
  });
async function seed(page, raw) {
  await page.goto(`${base}/blank.html`);
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key: KEY,
    raw,
  });
}
async function train(page, name = 'Sim') {
  await page
    .getByRole('form', { name: 'Treinou hoje?' })
    .getByRole('button', { name, exact: true })
    .click();
}
async function capture(page, name) {
  await page.screenshot({
    path: `${output}/${name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    `Overflow: ${name}`,
  );
}
async function scenario(name, test) {
  const previousBlockers = blockers.length;
  try {
    await test();
    const status = blockers.length > previousBlockers ? 'blocked' : 'passed';
    results.push({ name, status });
    console.log(status.toUpperCase(), name);
  } catch (error) {
    results.push({ name, status: 'failed', message: error.message });
    console.log('FAIL', name, error.message);
  }
  await save();
}
let fixture;
try {
  const fixtureContext = await context();
  const fixturePage = await pageIn(fixtureContext);
  await fixturePage.goto(dev);
  fixture = await fixturePage.evaluate(async (today) => {
    const { createInitialPlayerState, isPlayerState } =
      await import('/src/app/playerState.ts');
    const { projectCharacter, reconcileCharacter } =
      await import('/src/modules/profile/character.ts');
    const { libraryExercises } =
      await import('/src/modules/workouts/advanced/library.ts');
    const { testSession, testSet, testState } =
      await import('/src/modules/workouts/advanced/testFixtures.ts');
    const { applyGoalCommand } = await import('/src/modules/goals/commands.ts');
    const { blankGoal } = await import('/src/modules/goals/templates.ts');
    let state = createInitialPlayerState();
    state.profile.name = 'Auditoria temporária';
    state.records.sleep = [{ date: '2026-11-20', hours: 7.5 }];
    state.records.workouts = [{ date: '2026-11-20', trained: true }];
    state.records.books = [
      { id: 'book', title: 'Livro preservado', totalPages: 120 },
    ];
    state.records.readings = [
      { id: 'reading', bookId: 'book', date: '2026-11-20', pages: 20 },
    ];
    state.records.movements = [
      {
        id: 'income',
        kind: 'income',
        description: 'Receita preservada',
        category: 'Trabalho',
        amountCents: 12345,
        date: '2026-11-20',
      },
    ];
    state.records.investments = [
      {
        id: 'asset',
        name: 'Investimento preservado',
        category: 'Ações',
        ticker: 'VALE3',
      },
    ];
    state.records.investmentEntries = [
      {
        id: 'entry',
        investmentId: 'asset',
        kind: 'contribution',
        amountCents: 6000,
        quantity: 1,
        date: '2026-11-20',
        positionInitial: true,
      },
    ];
    state.records.advancedWorkouts = {
      ...testState(),
      sessions: [
        {
          ...testSession('session', '2026-11-20', [testSet('set', 40, 10)]),
          startedAt: '2026-11-20T08:30:00-03:00',
        },
      ],
    };
    state.records.advancedWorkouts.sessions[0].exercises[0].exercise =
      structuredClone(
        libraryExercises.find((exercise) => exercise.id === 'library:shrug'),
      );
    state.goals = applyGoalCommand(
      state.goals,
      {
        type: 'save',
        id: 'goal',
        definition: {
          ...blankGoal(today),
          title: 'Quest preservada',
          kind: 'completion',
          target: 1000,
        },
      },
      today,
    );
    state = reconcileCharacter(state, projectCharacter(state, today));
    if (!isPlayerState(state)) {
      const initial = createInitialPlayerState();
      const invalid = Object.keys(state).filter(
        (key) => !isPlayerState({ ...initial, [key]: state[key] }),
      );
      const records = Object.keys(state.records).filter(
        (key) =>
          !isPlayerState({
            ...initial,
            records: { ...initial.records, [key]: state.records[key] },
          }),
      );
      throw new Error(
        'Fixture inválida: ' +
          invalid.join(',') +
          '; registros: ' +
          records.join(','),
      );
    }
    return state;
  }, today);
  await fixtureContext.close();
  const envelope = (version) => JSON.stringify({ version, data: fixture });

  await scenario(
    'v7: hidratação, primeira ação v8 e recarga preservam todos os domínios',
    async () => {
      release = 'current';
      const ctx = await context();
      const page = await pageIn(ctx);
      try {
        const raw = envelope(7);
        await seed(page, raw);
        await page.goto(`${base}/treinos`);
        await page
          .getByRole('tab', { name: 'Mapa muscular', exact: true })
          .waitFor();
        assert.equal(
          await legacyAt(page),
          raw,
          'A importação preserva integralmente a chave antiga',
        );
        assert.equal(
          JSON.parse(await rawAt(page)).version,
          8,
          'Proteção ativa antes da primeira ação',
        );
        assert.ok((await copiesAt(page)).some((copy) => copy.raw === raw));
        await capture(page, 'v7-before-first-write');
        const previous = await readCanonical(page).catch(() => null);
        await train(page);
        await waitForCommit(page, previous);
        await page
          .getByText('Registros salvos neste navegador · evolução real', {
            exact: true,
          })
          .waitFor();
        const saved = JSON.parse(await rawAt(page));
        for (const key of [
          'profile',
          'preferences',
          'goals',
          'missionEvents',
          'progressOrigin',
        ])
          assert.deepEqual(saved.data[key], fixture[key]);
        for (const [key, value] of Object.entries(fixture.records))
          if (key !== 'workouts')
            assert.deepEqual(saved.data.records[key], value);
        assert.ok(
          saved.data.records.workouts.some(
            (row) => row.date === today && row.trained,
          ),
        );
        const after = await rawAt(page);
        await page.reload();
        assert.equal(await rawAt(page), after);
        await capture(page, 'v8-after-reload');
      } finally {
        await ctx.close();
      }
    },
  );

  await scenario(
    'versão v7 anterior não sobrescreve um envelope v8',
    async () => {
      release = 'previous';
      const ctx = await context();
      const page = await pageIn(ctx);
      try {
        const raw = envelope(8);
        await seed(page, raw);
        await page.goto(`${base}/treinos`);
        await train(page);
        assert.equal(await rawAt(page), raw);
        await capture(page, 'downgrade-v8');
      } finally {
        await ctx.close();
      }
    },
  );

  await scenario(
    'versão antiga antes da primeira ação: canônico preservado e alteração antiga recuperável',
    async () => {
      release = 'current';
      const ctx = await context();
      const page = await pageIn(ctx);
      try {
        const raw = envelope(7);
        await seed(page, raw);
        await page.goto(`${base}/treinos`);
        const canonical = await rawAt(page);
        assert.equal(JSON.parse(canonical).version, 8);
        assert.equal(await legacyAt(page), raw);
        release = 'legacy';
        await page.goto(`${base}/treinos`);
        await train(page);
        const overwrittenLegacy = await legacyAt(page);
        assert.notEqual(
          overwrittenLegacy,
          raw,
          'O código legado realmente reproduz a sobrescrita da chave antiga',
        );
        assert.equal(
          await rawAt(page),
          canonical,
          'A versão antiga não alcança os registros canônicos',
        );
        release = 'current';
        await page.goto(`${base}/treinos`);
        await page
          .getByRole('alert', {
            name: 'Uma versão antiga alterou a cópia local',
          })
          .waitFor();
        assert.equal(await rawAt(page), canonical);
        assert.ok(
          (await copiesAt(page)).some((copy) => copy.raw === overwrittenLegacy),
        );
        await capture(page, 'legacy-before-first-action-protected');
      } finally {
        await ctx.close();
        release = 'current';
      }
    },
  );

  for (const width of [320, 390, 768, 1024, 1440])
    await scenario(
      `dados protegidos e recuperação por teclado ${width}px`,
      async () => {
        const ctx = await context(width);
        const page = await pageIn(ctx);
        const consoleMessages = [];
        page.on('console', (message) => consoleMessages.push(message.text()));
        try {
          const invalid = structuredClone(fixture);
          invalid.records.sleep[0].hours = 25;
          invalid.privateFixtureMarker = 'do-not-log-fixture-content';
          const raw =
            ' \n' +
            JSON.stringify({ version: 8, data: invalid }, null, 2) +
            '\n';
          await seed(page, raw);
          await page.goto(`${base}/treinos`);
          const notice = page.getByRole('alert', {
            name: 'Registros salvos protegidos',
          });
          await notice.waitFor();
          assert.equal(
            await page
              .getByText('Registros salvos neste navegador · evolução real', {
                exact: true,
              })
              .count(),
            0,
          );
          await train(page);
          assert.equal(await rawAt(page), raw);
          assert.equal(
            await page.getByText('Alteração salva.', { exact: true }).count(),
            0,
          );
          await page
            .getByText('Alteração aplicada.', { exact: true })
            .waitFor();
          await capture(page, `protected-${width}`);
          const downloadButton = notice.getByRole('button', {
            name: 'Baixar cópia dos registros',
          });
          await downloadButton.focus();
          const downloadPending = page.waitForEvent('download');
          await page.keyboard.press('Enter');
          const download = await downloadPending;
          assert.equal(await fs.readFile(await download.path(), 'utf8'), raw);
          const start = notice.getByRole('button', {
            name: 'Começar do zero guardando uma cópia',
          });
          await start.focus();
          await page.keyboard.press('Enter');
          assert.equal(
            await notice
              .getByRole('button', { name: 'Cancelar', exact: true })
              .evaluate((el) => el === document.activeElement),
            true,
          );
          await capture(page, `protected-confirm-${width}`);
          await page.keyboard.press('Escape');
          assert.equal(
            await start.evaluate((el) => el === document.activeElement),
            true,
          );
          assert.equal(await rawAt(page), raw);
          await page.keyboard.press('Enter');
          await page.keyboard.press('Enter');
          assert.equal(await rawAt(page), raw);
          await start.focus();
          await page.keyboard.press('Enter');
          const confirm = notice.getByRole('button', {
            name: 'Guardar cópia e começar do zero',
          });
          await confirm.focus();
          await page.keyboard.press('Enter');
          await notice.waitFor({ state: 'detached' });
          assert.equal(
            await page.evaluate(() => document.activeElement?.id),
            'main',
          );
          const copies = (await copiesAt(page)).map((copy) => copy.raw);
          assert.equal(await legacyAt(page), raw);
          assert.ok(copies.includes(raw));
          assert.equal(JSON.parse(await rawAt(page)).version, 8);
          assert.ok(
            !consoleMessages.some((message) =>
              message.includes('do-not-log-fixture-content'),
            ),
          );
          await capture(page, `protected-recovered-${width}`);
        } finally {
          await ctx.close();
        }
      },
    );

  await scenario(
    'falha de gravação conserva dados e informa sessão apenas',
    async () => {
      const ctx = await context();
      const page = await pageIn(ctx);
      try {
        const raw = envelope(8);
        await seed(page, raw);
        await page.goto(`${base}/treinos`);
        await page.locator('.app-shell').waitFor();
        await page.evaluate(() => {
          const put = IDBObjectStore.prototype.put;
          IDBObjectStore.prototype.put = function (...args) {
            const request = put.apply(this, args);
            if (this.name === 'state') this.transaction.abort();
            return request;
          };
        });
        await train(page);
        await page
          .getByText(
            'Salvamento local indisponível · alterações apenas nesta sessão',
            { exact: true },
          )
          .waitFor();
        assert.equal(await rawAt(page), raw);
        await capture(page, 'write-failure');
      } finally {
        await ctx.close();
      }
    },
  );

  await scenario(
    'duas abas: comandos sobre dados atuais preservam ambos os registros',
    async () => {
      const ctx = await context();
      const a = await pageIn(ctx);
      const b = await pageIn(ctx);
      try {
        await seed(a, envelope(8));
        await a.goto(`${base}/treinos`);
        await b.goto(`${base}/descanso`);
        const form = b.getByRole('form', {
          name: 'Registrar sono',
          exact: true,
        });
        await form.getByRole('textbox', { name: 'Horas dormidas' }).fill('8');
        await form.getByRole('button', { name: /Salvar|Registrar/ }).click();
        await train(a);
        const saved = JSON.parse(await rawAt(a));
        assert.ok(
          saved.data.records.sleep.some(
            (row) => row.date === today && row.hours === 8,
          ),
        );
        assert.ok(
          saved.data.records.workouts.some(
            (row) => row.date === today && row.trained,
          ),
        );
        await capture(a, 'two-tabs-current-records');
      } finally {
        await ctx.close();
      }
    },
  );

  await scenario(
    'duas abas: transação pausada após a leitura da revisão, segunda gravação concorrente',
    async () => {
      const ctx = await context();
      const a = await pageIn(ctx);
      const b = await pageIn(ctx);
      let pending;
      try {
        await seed(a, envelope(8));
        await a.goto(`${base}/treinos`);
        await b.goto(`${base}/descanso`);
        await rawAt(a);
        await rawAt(b);
        const form = b.getByRole('form', {
          name: 'Registrar sono',
          exact: true,
        });
        await form.getByRole('textbox', { name: 'Horas dormidas' }).fill('8');
        await a.evaluate(() => {
          const put = IDBObjectStore.prototype.put;
          let paused = false;
          IDBObjectStore.prototype.put = function (...args) {
            if (this.name === 'state' && !paused) {
              paused = true;
              const request = new XMLHttpRequest();
              request.open('GET', '/race-barrier', false);
              request.send();
            }
            return put.apply(this, args);
          };
        });
        await b.evaluate(() => {
          const transaction = IDBDatabase.prototype.transaction;
          IDBDatabase.prototype.transaction = function (...args) {
            const tx = transaction.apply(this, args);
            if (this.name === 'life-rpg:records' && args[1] === 'readwrite')
              void fetch('/race-queued');
            return tx;
          };
        });
        const arrived = new Promise((done) => {
          raceArrival = done;
        });
        const queued = new Promise((done) => {
          queuedArrival = done;
        });
        pending = train(a);
        await Promise.race([
          arrived,
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Barreira não alcançada')),
              10000,
            ),
          ),
        ]);
        await form.getByRole('button', { name: /Salvar|Registrar/ }).click();
        await Promise.race([
          queued,
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Segunda transação não iniciou')),
              10000,
            ),
          ),
        ]);
        assert.equal(
          await b
            .getByText('Gravação em andamento · aguarde a confirmação', {
              exact: true,
            })
            .count(),
          1,
        );
        raceResponse.end('continue');
        raceResponse = undefined;
        await pending;
        await b
          .getByRole('alert', { name: 'Registros alterados em outra aba' })
          .waitFor();
        const final = JSON.parse(await rawAt(a));
        assert.ok(
          final.data.records.workouts.some(
            (row) => row.date === today && row.trained,
          ),
        );
        assert.ok(
          !final.data.records.sleep.some((row) => row.date === today),
          'A proposta financeira/domínio não é mesclada com o vencedor',
        );
        const copies = await copiesAt(b);
        assert.ok(
          copies.some((copy) =>
            JSON.parse(copy.raw).data.records.sleep.some(
              (row) => row.date === today && row.hours === 8,
            ),
          ),
        );
        await capture(b, 'two-tabs-real-transaction-conflict');
      } finally {
        raceResponse?.end();
        raceArrival = undefined;
        raceResponse = undefined;
        queuedArrival = undefined;
        if (pending) await pending.catch(() => {});
        await ctx.close();
      }
    },
  );

  await scenario(
    'fechamento da aba durante uma transação não deixa escrita parcial',
    async () => {
      const ctx = await context();
      const a = await pageIn(ctx);
      const b = await pageIn(ctx);
      let pending;
      try {
        await seed(a, envelope(8));
        await a.goto(`${base}/treinos`);
        await b.goto(`${base}/treinos`);
        const before = await rawAt(a);
        await rawAt(b);
        await a.evaluate(() => {
          const put = IDBObjectStore.prototype.put;
          IDBObjectStore.prototype.put = function (...args) {
            if (this.name === 'state') {
              const req = new XMLHttpRequest();
              req.open('GET', '/race-barrier', false);
              req.send();
            }
            return put.apply(this, args);
          };
        });
        const arrived = new Promise((done) => {
          raceArrival = done;
        });
        pending = train(a).catch(() => {});
        await Promise.race([
          arrived,
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Barreira de fechamento não alcançada')),
              10000,
            ),
          ),
        ]);
        await a.close();
        raceResponse?.end();
        raceResponse = undefined;
        assert.equal(await rawAt(b), before);
        await capture(b, 'closed-tab-transaction-aborted');
      } finally {
        raceResponse?.end();
        raceResponse = undefined;
        raceArrival = undefined;
        if (pending) await pending;
        await ctx.close();
      }
    },
  );

  await scenario(
    'falha ao guardar alterações antigas é explícita e exporta todos os brutos observados',
    async () => {
      release = 'current';
      const ctx = await context();
      const a = await pageIn(ctx);
      const old = await pageIn(ctx);
      try {
        await seed(a, envelope(7));
        await a.goto(`${base}/treinos`);
        const canonical = await rawAt(a);
        await old.goto(`${base}/blank.html`);
        await a.evaluate(() => {
          const add = IDBObjectStore.prototype.add;
          window.restoreAuditAdd = () => {
            IDBObjectStore.prototype.add = add;
          };
          IDBObjectStore.prototype.add = function (value, ...args) {
            const request = add.call(this, value, ...args);
            if (this.name === 'copies' && value.reason === 'legacy-change')
              this.transaction.abort();
            return request;
          };
        });
        const incoming = ['legacy-failed-1', 'legacy-failed-2'];
        await old.evaluate((values) => {
          for (const raw of values)
            localStorage.setItem('life-rpg:player-state', raw);
        }, incoming);
        const notice = a.getByRole('alert', {
          name: 'Uma versão antiga alterou a cópia local',
        });
        await notice.getByText(/Não foi possível guardar todas/).waitFor();
        const pending = a.waitForEvent('download');
        await notice
          .getByRole('button', { name: 'Baixar alterações não guardadas' })
          .click();
        const download = await pending;
        const bundle = JSON.parse(
          await fs.readFile(await download.path(), 'utf8'),
        );
        for (const raw of incoming) assert.ok(bundle.entries.includes(raw));
        assert.equal(await rawAt(a), canonical);
        await capture(a, 'legacy-archive-failure');
        await a.evaluate(() => window.restoreAuditAdd());
        await notice
          .getByRole('button', {
            name: 'Manter registros atuais e fechar aviso',
          })
          .click();
        await notice.waitFor({ state: 'detached' });
        const copies = await copiesAt(a);
        for (const raw of incoming)
          assert.ok(copies.some((copy) => copy.raw === raw));
        assert.equal(await rawAt(a), canonical);
      } finally {
        await ctx.close();
      }
    },
  );

  for (const version of [7, 8])
    for (const mode of ['open', 'closed', 'two-tabs', 'interrupted'])
      await scenario(`PWA ${mode}, envelope v${version}`, async () => {
        release = 'previous';
        interrupt = false;
        const ctx = await context(1024, 'allow');
        let page = await pageIn(ctx);
        try {
          const raw = envelope(version);
          await seed(page, raw);
          await page.goto(`${base}/treinos`);
          await page.evaluate(() => navigator.serviceWorker.ready);
          await page.reload();
          await page.waitForFunction(
            () => !!navigator.serviceWorker.controller,
          );
          const entry = () =>
            page.locator('script[type="module"][src]').getAttribute('src');
          const oldEntry = await entry();
          if (version === 7) {
            await train(page);
            assert.equal(JSON.parse(await rawAt(page)).version, 7);
          }
          const before = await rawAt(page);
          let second;
          if (mode === 'two-tabs') {
            second = await pageIn(ctx);
            await second.goto(`${base}/treinos`);
            assert.equal(
              await second
                .locator('script[type="module"][src]')
                .getAttribute('src'),
              oldEntry,
            );
          }
          if (mode === 'closed') await page.close();
          release = 'current';
          if (mode === 'closed') {
            page = await pageIn(ctx);
            await page.goto(`${base}/treinos`);
            assert.equal(await entry(), oldEntry);
            assert.equal(await rawAt(page), before);
          }
          interrupt = mode === 'interrupted';
          if (mode === 'interrupted') {
            await page.evaluate(async () => {
              const reg = await navigator.serviceWorker.getRegistration();
              await reg.update();
              if (reg.installing)
                await new Promise((done) => {
                  const worker = reg.installing;
                  worker.addEventListener('statechange', () => {
                    if (
                      worker.state === 'redundant' ||
                      worker.state === 'installed'
                    )
                      done();
                  });
                });
            });
            assert.equal(
              await page.evaluate(
                async () =>
                  !!(await navigator.serviceWorker.getRegistration()).waiting,
              ),
              false,
            );
            await page.reload();
            assert.equal(await entry(), oldEntry);
            assert.equal(await rawAt(page), before);
            await capture(page, `pwa-interrupted-v${version}`);
            interrupt = false;
          }
          await page.evaluate(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            await reg.update();
          });
          await page.waitForFunction(
            async () =>
              !!(await navigator.serviceWorker.getRegistration()).waiting,
          );
          await page.reload();
          assert.equal(
            await entry(),
            oldEntry,
            'Enquanto existe cliente antigo, preservar a versão inteira',
          );
          assert.equal(await rawAt(page), before);
          await capture(page, `pwa-waiting-${mode}-v${version}`);
          await page.close();
          if (second) {
            assert.equal(
              await second
                .locator('script[type="module"][src]')
                .getAttribute('src'),
              oldEntry,
            );
            await second.close();
          }
          // No client remains. Use a blank page, which is not controlled by the old
          // worker, to observe activation before navigating into the updated app.
          page = await pageIn(ctx);
          await page.goto(`${base}/blank.html`);
          await page.waitForFunction(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            return reg?.active?.state === 'activated' && !reg.waiting;
          });
          await page.goto(`${base}/treinos`);
          assert.notEqual(await entry(), oldEntry);
          await page
            .getByRole('tab', { name: 'Mapa muscular', exact: true })
            .waitFor();
          assert.deepEqual(
            JSON.parse(await rawAt(page)).data,
            JSON.parse(before).data,
          );
          assert.equal(await legacyAt(page), before);
          const previous = await readCanonical(page).catch(() => null);
          await train(page, 'Não');
          await waitForCommit(page, previous);
          await page
            .getByText('Registros salvos neste navegador · evolução real', {
              exact: true,
            })
            .waitFor();
          const after = await rawAt(page);
          const data = JSON.parse(after).data;
          assert.deepEqual(
            data.records.advancedWorkouts,
            fixture.records.advancedWorkouts,
          );
          assert.deepEqual(data.records.sleep, fixture.records.sleep);
          assert.deepEqual(data.goals, fixture.goals);
          const currentEntry = await entry();
          await ctx.setOffline(true);
          await page.reload();
          assert.equal(await entry(), currentEntry);
          assert.equal(await rawAt(page), after);
          await capture(page, `pwa-updated-offline-${mode}-v${version}`);
        } finally {
          interrupt = false;
          await ctx.close();
          release = 'current';
        }
      });
} finally {
  await save();
  await browser.close();
  await new Promise((done) => server.close(done));
}
console.log(
  `${results.length} cenários; ${results.filter((row) => row.status === 'failed').length} falhas; ${blockers.length} bloqueios. ${output}`,
);
if (
  results.some((row) => row.status === 'failed') ||
  errors.length ||
  blockers.length
)
  process.exitCode = 1;
