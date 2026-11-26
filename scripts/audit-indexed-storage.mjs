import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { skipWhatsNew } from './audit-storage-helpers.mjs';

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? 'playwright'
);
const dev = (process.env.AUDIT_BASE_URL ?? 'http://127.0.0.1:5173').replace(
  /\/$/,
  '',
);
assert.equal(new URL(dev).hostname, '127.0.0.1');
const out = resolve(process.env.AUDIT_OUTPUT ?? '/tmp/life-rpg-indexed-audit');
await fs.mkdir(out, { recursive: true });
const server = http.createServer((_req, res) =>
  res.end('<!doctype html><title>Isolated native storage tests</title>'),
);
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const results = [],
  errors = [];
const save = () =>
  fs.writeFile(
    `${out}/results.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
async function setup(page) {
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base);
  await page.evaluate(async (dev) => {
    const state = await import(`${dev}/src/app/playerState.ts`);
    const native = await import(
      `${dev}/src/shared/storage/transactionalStateStorage.ts`
    );
    const { testSession, testSet, testState } = await import(
      `${dev}/src/modules/workouts/advanced/testFixtures.ts`
    );
    const { libraryExercises } = await import(
      `${dev}/src/modules/workouts/advanced/library.ts`
    );
    const { blankGoal } = await import(`${dev}/src/modules/goals/templates.ts`);
    const { applyGoalCommand } = await import(
      `${dev}/src/modules/goals/commands.ts`
    );
    window.makeRepo = (options = {}) =>
      native.createTransactionalStateStorage({
        key: state.PLAYER_STORAGE_KEY,
        version: state.PLAYER_STORAGE_VERSION,
        validate: state.isPlayerState,
        migrate: state.migratePlayerState,
        ...options,
      });
    window.repo = window.makeRepo();
    const value = state.createInitialPlayerState();
    value.profile.name = 'Fixture persistência';
    value.records.sleep = [{ date: '2026-11-20', hours: 7.5 }];
    value.records.workouts = [{ date: '2026-11-20', trained: true }];
    value.records.movements = [
      {
        id: 'income',
        kind: 'income',
        description: 'Receita',
        category: 'Trabalho',
        amountCents: 12345,
        date: '2026-11-20',
      },
    ];
    value.records.investments = [
      { id: 'asset', name: 'Ativo', category: 'Ações', ticker: 'VALE3' },
    ];
    value.records.investmentEntries = [
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
    value.records.books = [{ id: 'book', title: 'Livro', totalPages: 100 }];
    value.records.readings = [
      { id: 'reading', bookId: 'book', pages: 20, date: '2026-11-20' },
    ];
    value.records.advancedWorkouts = testState();
    value.records.advancedWorkouts.sessions = [
      {
        ...testSession('session', '2026-11-20', [testSet('set', 40, 10)]),
        startedAt: '2026-11-20T08:30:00-03:00',
      },
    ];
    value.records.advancedWorkouts.sessions[0].exercises[0].exercise =
      structuredClone(libraryExercises.find((e) => e.id === 'library:shrug'));
    value.goals = applyGoalCommand(
      value.goals,
      {
        type: 'save',
        id: 'goal',
        definition: {
          ...blankGoal('2026-11-21'),
          title: 'Quest preservada',
          kind: 'completion',
          target: 1000,
        },
      },
      '2026-11-21',
    );
    value.unknownCompatibleField = { preserve: true };
    if (!state.isPlayerState(value)) throw new Error('Fixture inválida');
    window.fixture = value;
    window.modules = state;
    window.seed = (version = 7, data = value) => {
      const raw = ' \n' + JSON.stringify({ version, data }, null, 2) + '\n';
      localStorage.setItem(state.PLAYER_STORAGE_KEY, raw);
      return raw;
    };
  }, dev);
}
async function scenario(name, run) {
  const context = await browser.newContext({
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
  await skipWhatsNew(context);
  try {
    const page = await context.newPage();
    await setup(page);
    await run({ page, context });
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
try {
  for (const version of [7, 8])
    await scenario(
      `v${version}: importação validada, bruto íntegro, ativação antes da primeira ação`,
      async ({ page }) => {
        const result = await page.evaluate(async (version) => {
          const original = window.seed(version);
          const first = await window.repo.load();
          const again = await window.repo.load();
          const copies = await window.repo.copies.listCopies();
          return {
            original,
            legacy: localStorage.getItem('life-rpg:player-state'),
            first,
            again,
            copies: await Promise.all(
              copies.map((c) => window.repo.copies.readCopy(c.key)),
            ),
            fixture: window.fixture,
          };
        }, version);
        assert.equal(result.legacy, result.original);
        assert.equal(result.first.status, 'loaded');
        assert.deepEqual(result.first.data, result.fixture);
        assert.equal(JSON.parse(result.first.raw).version, 8);
        assert.equal(result.first.token, result.again.token);
        assert.deepEqual(result.copies, [result.original]);
      },
    );
  for (const version of [1, 2, 3, 4, 5, 6])
    await scenario(
      `formato histórico v${version}: cópia exata e dados da migração oficial`,
      async ({ page }) => {
        const result = await page.evaluate(async (version) => {
          const data = structuredClone(window.fixture);
          if (version <= 2) {
            delete data.missionEvents;
            delete data.goals;
            delete data.character;
          }
          if (version === 1) delete data.records;
          if (version === 3) {
            delete data.goals;
            delete data.character;
          }
          if (version === 4) delete data.character;
          if (version === 5 || version === 6)
            data.character.classification.current = 'adventurer';
          const expected = window.modules.migratePlayerState(version, data);
          if (!expected) throw new Error('Fixture histórica inválida');
          const original = window.seed(version, data);
          const loaded = await window.repo.load();
          const copies = await window.repo.copies.listCopies();
          return {
            expected,
            loaded,
            original,
            copy: await window.repo.copies.readCopy(copies[0].key),
            legacy: localStorage.getItem('life-rpg:player-state'),
          };
        }, version);
        assert.equal(result.loaded.status, 'loaded');
        assert.deepEqual(result.loaded.data, result.expected);
        assert.equal(result.copy, result.original);
        assert.equal(result.legacy, result.original);
      },
    );
  for (const kind of ['future', 'invalid', 'broken-migration'])
    await scenario(
      `${kind}: não ativa dados incompatíveis nem cria um jogador vazio`,
      async ({ page }) => {
        const result = await page.evaluate(async (kind) => {
          const data = structuredClone(window.fixture);
          if (kind !== 'future') data.records.sleep[0].hours = 25;
          const raw = window.seed(
            kind === 'future' ? 99 : kind === 'broken-migration' ? 6 : 8,
            data,
          );
          const loaded = await window.repo.load();
          const attempt = await window.repo.write(window.fixture, loaded.token);
          return {
            raw,
            loaded,
            attempt,
            canonical: await window.repo.readRaw(),
            legacy: localStorage.getItem('life-rpg:player-state'),
          };
        }, kind);
        assert.ok(['invalid', 'incompatible'].includes(result.loaded.status));
        assert.equal(result.canonical, null);
        assert.equal(result.legacy, result.raw);
        assert.equal(result.attempt.status, 'protected');
      },
    );
  await scenario(
    'migração interrompida aborta cópia e ativação; a repetição segura importa uma única vez',
    async ({ page }) => {
      const result = await page.evaluate(async () => {
        const raw = window.seed();
        const add = IDBObjectStore.prototype.add;
        IDBObjectStore.prototype.add = function (value, ...args) {
          const request = add.call(this, value, ...args);
          if (this.name === 'copies') this.transaction.abort();
          return request;
        };
        const interrupted = await window.repo.load();
        IDBObjectStore.prototype.add = add;
        const before = await window.repo.readRaw();
        const retry = await window.repo.load();
        const copies = await window.repo.copies.listCopies();
        return {
          raw,
          interrupted,
          before,
          retry,
          copies: copies.length,
          legacy: localStorage.getItem('life-rpg:player-state'),
        };
      });
      assert.equal(result.interrupted.status, 'unavailable');
      assert.equal(result.before, null);
      assert.equal(result.retry.status, 'loaded');
      assert.equal(result.copies, 1);
      assert.equal(result.legacy, result.raw);
    },
  );
  await scenario(
    'duas importações simultâneas em conexões independentes não duplicam a migração',
    async ({ page, context }) => {
      const other = await context.newPage();
      await setup(other);
      await page.evaluate(() => window.seed());
      const imported = await Promise.all([
        page.evaluate(() => window.repo.load()),
        other.evaluate(() => window.repo.load()),
      ]);
      assert.equal(imported[0].token, imported[1].token);
      assert.equal(
        await page.evaluate(
          async () => (await window.repo.copies.listCopies()).length,
        ),
        1,
      );
    },
  );
  for (const kind of [
    'different-records',
    'same-record',
    'delete-edit',
    'financial-conflict',
  ])
    await scenario(
      `corrida ${kind}: um commit e um conflito recuperável, sem mesclar`,
      async ({ page, context }) => {
        const other = await context.newPage();
        await setup(other);
        await page.evaluate(() => window.seed());
        const baseline = await page.evaluate(() => window.repo.load());
        const proposals = [
          structuredClone(baseline.data),
          structuredClone(baseline.data),
        ];
        if (kind === 'different-records') {
          proposals[0].records.sleep.push({ date: '2026-11-21', hours: 8 });
          proposals[1].records.workouts.push({
            date: '2026-11-21',
            trained: true,
          });
        }
        if (kind === 'same-record') {
          proposals[0].records.sleep[0].hours = 6;
          proposals[1].records.sleep[0].hours = 9;
        }
        if (kind === 'delete-edit') {
          proposals[0].records.movements = [];
          proposals[1].records.movements[0].amountCents = 25000;
        }
        if (kind === 'financial-conflict') {
          proposals[0].records.investmentEntries[0].amountCents = 10000;
          proposals[1].records.investmentEntries[0].amountCents = 20000;
        }
        // Both connections deliberately submit snapshots based on the SAME revision.
        const writes = await Promise.all([
          page.evaluate(({ data, token }) => window.repo.write(data, token), {
            data: proposals[0],
            token: baseline.token,
          }),
          other.evaluate(({ data, token }) => window.repo.write(data, token), {
            data: proposals[1],
            token: baseline.token,
          }),
        ]);
        assert.deepEqual(writes.map((w) => w.status).sort(), [
          'conflict',
          'saved',
        ]);
        const winner = writes[0].status === 'saved' ? 0 : 1,
          loser = 1 - winner;
        const final = await page.evaluate(() => window.repo.load());
        assert.deepEqual(final.data, proposals[winner]);
        // Reopen the losing tab: the draft is still recoverable, not silently lost.
        await other.close();
        const reopened = await context.newPage();
        await setup(reopened);
        const copies = await reopened.evaluate(async () => {
          const list = await window.repo.copies.listCopies();
          return Promise.all(
            list.map((c) => window.repo.copies.readCopy(c.key)),
          );
        });
        assert.ok(
          copies.some(
            (raw) =>
              JSON.stringify(JSON.parse(raw).data) ===
              JSON.stringify(proposals[loser]),
          ),
        );
      },
    );
  await scenario(
    '30 corridas de revisão não duplicam operações nem perdem o vencedor',
    async ({ page, context }) => {
      const other = await context.newPage();
      await setup(other);
      await page.evaluate(() => window.seed());
      for (let n = 0; n < 30; n++) {
        const baseline = await page.evaluate(() => window.repo.load());
        const a = structuredClone(baseline.data),
          b = structuredClone(baseline.data);
        a.profile.focus = `A ${n}`;
        b.profile.focus = `B ${n}`;
        const writes = await Promise.all([
          page.evaluate(({ data, token }) => window.repo.write(data, token), {
            data: a,
            token: baseline.token,
          }),
          other.evaluate(({ data, token }) => window.repo.write(data, token), {
            data: b,
            token: baseline.token,
          }),
        ]);
        assert.deepEqual(writes.map((w) => w.status).sort(), [
          'conflict',
          'saved',
        ]);
        assert.deepEqual(
          (await page.evaluate(() => window.repo.load())).data,
          writes[0].status === 'saved' ? a : b,
        );
      }
    },
  );
  await scenario(
    'legado surge após leitura vazia: conflito guarda a proposta sem inicializar jogador vazio',
    async ({ page }) => {
      const result = await page.evaluate(async () => {
        const empty = await window.repo.load();
        const original = window.seed();
        const proposal = window.modules.createInitialPlayerState();
        proposal.profile.name = 'Proposta preservada';
        const write = await window.repo.write(proposal, empty.token);
        const copies = await window.repo.copies.listCopies();
        const drafts = [];
        for (const copy of copies.filter((c) => c.key.startsWith('idb:')))
          drafts.push(await window.repo.copies.readCopy(copy.key));
        return {
          emptyToken: empty.token,
          write: write.status,
          legacyIntact:
            localStorage.getItem('life-rpg:player-state') === original,
          canonical: await window.repo.readRaw(),
          draftKept: drafts.some(
            (raw) =>
              JSON.parse(raw).data.profile.name === 'Proposta preservada',
          ),
          reloaded: (await window.repo.load()).data.profile.name,
        };
      });
      assert.equal(result.emptyToken, null);
      assert.equal(result.write, 'conflict');
      assert.equal(result.legacyIntact, true);
      assert.equal(result.canonical, null);
      assert.equal(result.draftKept, true);
      assert.equal(result.reloaded, 'Fixture persistência');
    },
  );
  await scenario(
    'versão antiga altera localStorage: canônico preservado e bruto divergente recuperável',
    async ({ page }) => {
      const result = await page.evaluate(async () => {
        const original = window.seed();
        const first = await window.repo.load();
        localStorage.setItem(
          'life-rpg:player-state',
          '{legacy-partially-invalid',
        );
        const after = await window.repo.load();
        const copies = await window.repo.copies.listCopies();
        const payloads = await Promise.all(
          copies.map((c) => window.repo.copies.readCopy(c.key)),
        );
        await window.repo.acknowledgeLegacy();
        const acknowledged = await window.repo.load();
        return {
          original,
          first,
          after,
          payloads,
          acknowledged,
          legacy: localStorage.getItem('life-rpg:player-state'),
        };
      });
      assert.deepEqual(result.after.data, result.first.data);
      assert.equal(result.after.token, result.first.token);
      assert.equal(result.after.legacy.raw, '{legacy-partially-invalid');
      assert.ok(result.payloads.includes(result.original));
      assert.ok(result.payloads.includes('{legacy-partially-invalid'));
      assert.equal(result.acknowledged.legacy, undefined);
      assert.equal(result.legacy, '{legacy-partially-invalid');
    },
  );
  await scenario(
    'evento de versão antiga preserva também valores intermediários observados',
    async ({ page }) => {
      const result = await page.evaluate(async () => {
        window.seed();
        await window.repo.load();
        await Promise.all([
          window.repo.observeLegacy('legacy-change-1'),
          window.repo.observeLegacy('legacy-change-2'),
        ]);
        const copies = await window.repo.copies.listCopies();
        return Promise.all(
          copies.map((c) => window.repo.copies.readCopy(c.key)),
        );
      });
      assert.ok(result.includes('legacy-change-1'));
      assert.ok(result.includes('legacy-change-2'));
    },
  );
  await scenario(
    'falha após put aborta a transação e nunca retorna salvo',
    async ({ page }) => {
      const result = await page.evaluate(async () => {
        const original = window.seed();
        const first = await window.repo.load();
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
          const request = put.apply(this, args);
          if (this.name === 'state') this.transaction.abort();
          return request;
        };
        const changed = structuredClone(first.data);
        changed.profile.name = 'Não confirmar';
        const failed = await window.repo.write(changed, first.token);
        IDBObjectStore.prototype.put = put;
        const after = await window.repo.load();
        return {
          original,
          first,
          failed,
          after,
          legacy: localStorage.getItem('life-rpg:player-state'),
        };
      });
      assert.equal(result.failed.status, 'failed');
      assert.equal(result.after.token, result.first.token);
      assert.deepEqual(result.after.data, result.first.data);
      assert.equal(result.legacy, result.original);
    },
  );
  await scenario(
    'recuperação explícita e restauração preservam os dois lados atomicamente',
    async ({ page }) => {
      const result = await page.evaluate(async () => {
        const original = window.seed();
        const first = await window.repo.load();
        const migrationCopy = (await window.repo.copies.listCopies())[0];
        const changed = structuredClone(first.data);
        changed.records.sleep[0].hours = 6;
        const write = await window.repo.write(changed, first.token);
        const restored = await window.repo.restore(
          migrationCopy.key,
          write.token,
        );
        const after = await window.repo.load();
        const copies = await window.repo.copies.listCopies();
        const payloads = await Promise.all(
          copies.map((c) => window.repo.copies.readCopy(c.key)),
        );
        return {
          original,
          first,
          changed,
          restored,
          after,
          payloads,
          legacy: localStorage.getItem('life-rpg:player-state'),
        };
      });
      assert.equal(result.restored.status, 'saved');
      assert.deepEqual(result.after.data, result.first.data);
      assert.ok(
        result.payloads.some(
          (raw) =>
            JSON.stringify(JSON.parse(raw).data) ===
            JSON.stringify(result.changed),
        ),
      );
      assert.equal(result.legacy, result.original);
    },
  );
  await scenario(
    'sem Web Locks e offline: IndexedDB continua transacional',
    async ({ page, context }) => {
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'locks', { value: undefined });
        window.seed();
      });
      const first = await page.evaluate(() => window.repo.load());
      await context.setOffline(true);
      const changed = structuredClone(first.data);
      changed.profile.name = 'Offline';
      const write = await page.evaluate(
        ({ data, token }) => window.repo.write(data, token),
        { data: changed, token: first.token },
      );
      assert.equal(write.status, 'saved');
      assert.equal(
        (await page.evaluate(() => window.repo.load())).data.profile.name,
        'Offline',
      );
    },
  );
  await scenario(
    'IndexedDB indisponível: nenhuma escrita de fallback no localStorage',
    async ({ page }) => {
      const result = await page.evaluate(async () => {
        const raw = window.seed();
        const repo = window.makeRepo({
          factory: () => {
            throw new Error('Simulated unavailable');
          },
        });
        return {
          raw,
          loaded: await repo.load(),
          write: await repo.write(window.fixture, null),
          legacy: localStorage.getItem('life-rpg:player-state'),
        };
      });
      assert.equal(result.loaded.status, 'unavailable');
      assert.equal(result.write.status, 'failed');
      assert.equal(result.legacy, result.raw);
    },
  );
  await scenario(
    'versão canônica futura fica protegida e não volta para a cópia antiga',
    async ({ page }) => {
      const result = await page.evaluate(async () => {
        window.seed();
        const first = await window.repo.load();
        await new Promise((resolve, reject) => {
          const request = indexedDB.open('life-rpg:records', 1);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('state', 'readwrite');
            const store = tx.objectStore('state');
            const get = store.get('current');
            get.onsuccess = () =>
              store.put(
                {
                  ...get.result,
                  revision: 2,
                  raw: JSON.stringify({
                    version: 99,
                    data: { futureRecords: ['preservar'] },
                  }),
                },
                'current',
              );
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onabort = () => {
              db.close();
              reject(new Error('Falha na fixture futura'));
            };
          };
        });
        const future = await window.repo.load();
        const write = await window.repo.write(first.data, future.token);
        const after = await window.repo.load();
        return { future, write, after };
      });
      assert.equal(result.future.status, 'incompatible');
      assert.equal(result.write.status, 'protected');
      assert.equal(result.after.raw, result.future.raw);
    },
  );
  await scenario(
    'origem inválida preservada não é substituída por fallback vazio de versão antiga',
    async ({ page }) => {
      const result = await page.evaluate(async () => {
        const invalid = structuredClone(window.fixture);
        invalid.records.sleep[0].hours = 25;
        const original = window.seed(8, invalid);
        const protectedLoad = await window.repo.load();
        const fallback = window.seed(
          7,
          window.modules.createInitialPlayerState(),
        );
        const after = await window.repo.load();
        const copies = await window.repo.copies.listCopies();
        return {
          original,
          fallback,
          protectedLoad,
          after,
          canonical: await window.repo.readRaw(),
          payloads: await Promise.all(
            copies.map((c) => window.repo.copies.readCopy(c.key)),
          ),
        };
      });
      assert.equal(result.protectedLoad.status, 'invalid');
      assert.equal(result.after.status, 'invalid');
      assert.equal(result.after.raw, result.original);
      assert.equal(result.canonical, null);
      assert.ok(result.payloads.includes(result.original));
      assert.ok(result.payloads.includes(result.fallback));
    },
  );
  await scenario(
    'interface sem IndexedDB bloqueia a abertura normal e preserva o original',
    async ({ page }) => {
      const raw = await page.evaluate(() =>
        JSON.stringify({ version: 7, data: window.fixture }),
      );
      await page.addInitScript((raw) => {
        localStorage.setItem('life-rpg:player-state', raw);
        Object.defineProperty(window, 'indexedDB', { value: undefined });
      }, raw);
      await page.goto(`${dev}/treinos`);
      await page
        .getByRole('heading', {
          name: 'Não foi possível acessar os registros protegidos',
        })
        .waitFor();
      assert.equal(
        await page
          .getByRole('progressbar', { name: 'Experiência do jogador' })
          .count(),
        0,
      );
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem('life-rpg:player-state'),
        ),
        raw,
      );
      for (const width of [320, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.screenshot({
          path: `${out}/unavailable-${width}.png`,
          fullPage: true,
        });
      }
      await page.getByRole('button', { name: 'Tentar novamente' }).focus();
      await page.keyboard.press('Enter');
      await page
        .getByRole('heading', {
          name: 'Não foi possível acessar os registros protegidos',
        })
        .waitFor();
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem('life-rpg:player-state'),
        ),
        raw,
      );
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
