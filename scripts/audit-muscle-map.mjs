import fs from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Receives only an isolated browser fixture page; never a persistent user profile. */
export async function auditMuscleMap({ page, width, capture, check }) {
  const map = page.getByRole('region', { name: 'Mapa muscular', exact: true });
  const original = await page.evaluate(() =>
    localStorage.getItem('life-rpg:player-state'),
  );
  const surfaceCount = await map.locator('[data-surface]').count();
  check(
    surfaceCount === 58,
    'muscle-surfaces',
    width,
    `Esperadas 58 regiões: ${surfaceCount}`,
  );
  await map.getByRole('tab', { name: 'Esforço', exact: true }).click();
  const first = map
    .getByRole('group', { name: 'Mapa muscular · visão frontal' })
    .getByRole('button', { name: /Peitoral · esquerda/ });
  await first.focus();
  await page.keyboard.press('Enter');
  check(
    (await first.getAttribute('aria-pressed')) === 'true',
    'muscle-keyboard',
    width,
    'Seleção por Enter falhou',
  );
  const firstFill = await first.evaluate((el) => {
    const id = el.getAttribute('fill').slice(5, -1);
    return getComputedStyle(
      document.getElementById(id).querySelector('.muscle-v2-color'),
    ).stopColor;
  });
  // Mapped known effort surfaces must remain in the red family; unknown is neutral.
  const [r, g, b] = firstFill.match(/[\d.]+/g).map(Number);
  check(
    r > g && r > b,
    'muscle-red',
    width,
    `Esforço saiu da escala vermelha: ${firstFill}`,
  );
  await capture(page, 'muscle-effort', width);
  await map.getByRole('tab', { name: 'Recuperação', exact: true }).click();
  check(
    (await first.getAttribute('aria-pressed')) === 'true',
    'muscle-mode-selection',
    width,
    'Modo perdeu a seleção',
  );
  check(
    (await map.getByLabel('Legenda de recuperação estimada').count()) === 1,
    'muscle-recovery-legend',
    width,
    'Legenda ausente',
  );
  await capture(page, 'muscle-recovery', width);
  const back = map
    .getByRole('group', { name: 'Mapa muscular · visão traseira' })
    .getByRole('button', { name: /Lombar · esquerda/ });
  if (width < 768) await back.tap();
  else await back.click();
  check(
    (await back.getAttribute('aria-pressed')) === 'true',
    'muscle-back',
    width,
    'Seleção traseira falhou',
  );
  await capture(page, 'muscle-back-selected', width);
  const details = map.getByLabel('Detalhes do músculo selecionado');
  const front = map.getByRole('group', {
    name: 'Mapa muscular · visão frontal',
  });
  const adductor = front.getByRole('button', { name: /Adutores · esquerda/ });
  if (width < 768) await adductor.tap();
  else await adductor.click();
  const traceHeader = details.getByRole('button', {
    name: /^Exercícios que estimularam este músculo \(\d+\)$/,
  });
  const trace = details.getByRole('region', {
    name: /^Exercícios que estimularam este músculo/,
  });
  check(
    (await traceHeader.getAttribute('aria-expanded')) === 'false' &&
      (await trace.getByRole('listitem').count()) === 0,
    'muscle-trace-collapsed',
    width,
    'Seção de exercícios não começou recolhida',
  );
  await traceHeader.scrollIntoViewIfNeeded();
  await capture(page, 'muscle-trace-closed', width);
  // Teclado real: Enter no botão do cabeçalho abre a seção.
  await traceHeader.focus();
  await page.keyboard.press('Enter');
  check(
    (await traceHeader.getAttribute('aria-expanded')) === 'true',
    'muscle-trace-keyboard',
    width,
    'Enter não expandiu a seção',
  );
  // Depende só do histórico da fixture: agachamento registrado → rastreio dele.
  const hasSquat = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem('life-rpg:player-state'),
    ).data.records.advancedWorkouts.sessions.some(
      (s) =>
        s.status === 'completed' &&
        s.exercises.some((e) => e.exercise.id === 'squat'),
    ),
  );
  check(
    (await details.getByText('Grupo: Adutores').count()) === 1 &&
      (hasSquat
        ? (await trace
            .getByRole('list', { name: 'Estímulo contabilizado' })
            .getByText('Agachamento livre')
            .count()) > 0
        : (await trace
            .getByText(/^Nenhum estímulo contabilizado para este músculo/)
            .count()) === 1),
    'muscle-trace',
    width,
    `Rastreio de Adutores incoerente com o histórico (agachamento: ${hasSquat})`,
  );
  const items = await trace.getByRole('listitem').count();
  check(
    items <= 5,
    'muscle-trace-page',
    width,
    `Mais de 5 registros visíveis ao abrir: ${items}`,
  );
  await capture(page, 'muscle-trace', width);
  // Região pequena no celular: usa a alternativa documentada da lista (44 px).
  const abductor = map.getByRole('button', { name: /^Abdutores/ });
  if (width < 768) await abductor.tap();
  else await abductor.click();
  check(
    (await traceHeader.getAttribute('aria-expanded')) === 'false',
    'muscle-trace-reset',
    width,
    'Trocar de músculo manteve a seção expandida',
  );
  if (width < 768) await traceHeader.tap();
  else await traceHeader.click();
  check(
    (await details
      .getByRole('img', { name: 'Índice estimado: indeterminado' })
      .count()) === 1 &&
      (await trace
        .getByText(
          'Nenhum estímulo contabilizado para este músculo nos últimos 14 dias.',
        )
        .count()) === 1,
    'muscle-indeterminate',
    width,
    'Abdutores ganharam índice sem exercício relacionado',
  );
  await map.getByRole('tab', { name: 'Recuperação', exact: true }).focus();
  await page.keyboard.press('Home');
  check(
    await map
      .getByRole('tab', { name: 'Esforço', exact: true })
      .evaluate((el) => el === document.activeElement),
    'muscle-mode-focus',
    width,
    'Home não restaurou foco',
  );
  check(
    (await page.evaluate(() =>
      localStorage.getItem('life-rpg:player-state'),
    )) === original,
    'muscle-storage',
    width,
    'Seleção/modos alteraram o envelope',
  );
}

/**
 * Paginação visual do rastreio com 18 registros no mesmo grupo. A página deve
 * ter acabado de carregar a fixture de 18 agachamentos (isolada da auditoria).
 */
export async function auditTracePagination({ page, width, capture, check }) {
  const touch = width < 768;
  const map = page.getByRole('region', { name: 'Mapa muscular', exact: true });
  const details = map.getByLabel('Detalhes do músculo selecionado');
  const original = await page.evaluate(() =>
    localStorage.getItem('life-rpg:player-state'),
  );
  const tapOrClick = (locator) => (touch ? locator.tap() : locator.click());
  // Desktop: teclado real (foco + Enter); celular: toque.
  const activate = async (locator) => {
    if (touch) return locator.tap();
    await locator.focus();
    await page.keyboard.press('Enter');
  };
  const header = (name) =>
    details.getByRole('button', { name: new RegExp(`^${name} \\(\\d+\\)$`) });
  const main = header('Exercícios que estimularam este músculo');
  const stab = header('Participação estabilizadora · não contabilizada');
  const list = (label) =>
    details.getByRole('list', { name: label, exact: true });
  const visibleItems = (label) => list(label).locator('> li:visible');
  const contentHidden = async (button) => {
    const id = await button.getAttribute('aria-controls');
    return page.locator(`[id="${id}"]`).isHidden();
  };
  const activeName = () =>
    page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
  async function visibleState(label) {
    const metas = await visibleItems(label)
      .locator('.muscle-v2-trace-meta')
      .allTextContents();
    const dates = metas.map((m) =>
      m.slice(0, 10).split('/').reverse().join('-'),
    );
    return {
      count: metas.length,
      unique: new Set(metas).size === metas.length,
      descending: dates.every((d, i) => i === 0 || dates[i - 1] > d),
    };
  }
  async function expectVisible(label, count, name) {
    const state = await visibleState(label);
    check(
      state.count === count && state.unique && state.descending,
      name,
      width,
      `${label}: ${JSON.stringify(state)}, esperado ${count} únicos em ordem decrescente`,
    );
  }
  async function noOverflowOrOverlap(name) {
    const geometry = await details.evaluate((el) => {
      const buttons = [
        ...el.querySelectorAll('.muscle-v2-trace-pager button'),
      ].map((b) => b.getBoundingClientRect().toJSON());
      return {
        scroll: document.documentElement.scrollWidth,
        viewport: innerWidth,
        buttons,
      };
    });
    const [a, b] = geometry.buttons;
    const overlap =
      a &&
      b &&
      a.left < b.right &&
      b.left < a.right &&
      a.top < b.bottom &&
      b.top < a.bottom;
    check(
      geometry.scroll <= geometry.viewport + 1 &&
        geometry.buttons.every(
          (r) =>
            r.left >= 0 && r.right <= geometry.viewport + 0.5 && r.width > 0,
        ) &&
        !overlap,
      name,
      width,
      `Paginação fora da tela ou sobreposta: ${JSON.stringify(geometry)}`,
    );
  }

  await tapOrClick(map.getByRole('button', { name: /^Quadríceps/ }));
  // 1–2: recolhida, com contagem correta e conteúdo realmente oculto.
  check(
    (await main.getAttribute('aria-expanded')) === 'false' &&
      (await main.textContent()).includes('(18)') &&
      (await contentHidden(main)) &&
      (await details.locator('.muscle-v2-trace-item:visible').count()) === 0,
    'trace-page-collapsed',
    width,
    'Seção não começou recolhida com 18 registros',
  );
  await main.scrollIntoViewIfNeeded();
  await capture(page, 'trace-page-initial', width);
  // 3: abre com 5.
  await activate(main);
  check(
    (await main.getAttribute('aria-expanded')) === 'true' &&
      !(await contentHidden(main)),
    'trace-page-open',
    width,
    'Cabeçalho não expandiu a seção',
  );
  await expectVisible('Estímulo contabilizado', 5, 'trace-page-5');
  await capture(page, 'trace-page-5', width);
  // 4–7: 10, 15 e 18, com o texto do último botão igual ao restante.
  for (const [label, total] of [
    ['Mostrar mais 5', 10],
    ['Mostrar mais 5', 15],
    ['Mostrar mais 3', 18],
  ]) {
    const more = details.getByRole('button', { name: label, exact: true });
    check(
      await more.isVisible(),
      `trace-page-label-${total}`,
      width,
      `Botão “${label}” ausente`,
    );
    await activate(more);
    await expectVisible('Estímulo contabilizado', total, `trace-page-${total}`);
    if (total === 10) {
      check(
        (await activeName()) === 'Mostrar mais 5',
        'trace-page-focus-more',
        width,
        `Foco perdido após carregar mais: “${await activeName()}”`,
      );
      await noOverflowOrOverlap('trace-page-layout-10');
      await capture(page, 'trace-page-10', width);
    }
  }
  check(
    (await details.getByRole('button', { name: /^Mostrar mais/ }).count()) ===
      0 && (await activeName()) === 'Mostrar menos',
    'trace-page-focus-less',
    width,
    `Ao completar, o foco devia ir para “Mostrar menos”: “${await activeName()}”`,
  );
  await noOverflowOrOverlap('trace-page-layout-18');
  await capture(page, 'trace-page-18', width);
  // 8: volta aos 5 primeiros, foco no botão restante.
  await activate(
    details.getByRole('button', { name: 'Mostrar menos', exact: true }),
  );
  await expectVisible('Estímulo contabilizado', 5, 'trace-page-less');
  check(
    (await activeName()) === 'Mostrar mais 5',
    'trace-page-focus-back',
    width,
    `Foco após “Mostrar menos”: “${await activeName()}”`,
  );
  // 9: recolhe.
  await activate(main);
  check(
    (await main.getAttribute('aria-expanded')) === 'false' &&
      (await contentHidden(main)) &&
      (await details.locator('.muscle-v2-trace-item:visible').count()) === 0,
    'trace-page-collapse',
    width,
    'Seção não recolheu',
  );
  // 12: estabilizadores independentes, no Abdômen (0 contabilizados, 18 estabilizações).
  await tapOrClick(map.getByRole('button', { name: /^Abdômen/ }));
  check(
    (await main.textContent()).includes('(0)') &&
      (await stab.textContent()).includes('(18)') &&
      (await main.getAttribute('aria-expanded')) === 'false' &&
      (await stab.getAttribute('aria-expanded')) === 'false',
    'trace-page-stabilizer-initial',
    width,
    'Contagens ou estado inicial do Abdômen incorretos',
  );
  await activate(stab);
  await expectVisible(
    'Participação estabilizadora',
    5,
    'trace-page-stabilizer-5',
  );
  await activate(
    details.getByRole('button', { name: 'Mostrar mais 5', exact: true }),
  );
  await expectVisible(
    'Participação estabilizadora',
    10,
    'trace-page-stabilizer-10',
  );
  check(
    (await main.getAttribute('aria-expanded')) === 'false',
    'trace-page-independent',
    width,
    'Abrir estabilizadores abriu a lista principal',
  );
  await activate(main);
  check(
    (await details
      .getByText(
        'Nenhum estímulo contabilizado para este músculo no período selecionado.',
      )
      .isVisible()) &&
      (await visibleState('Participação estabilizadora')).count === 10,
    'trace-page-independent-main',
    width,
    'Abrir a lista principal alterou os estabilizadores',
  );
  await capture(page, 'trace-page-stabilizer', width);
  // 10: trocar de músculo reinicia.
  await tapOrClick(map.getByRole('button', { name: /^Quadríceps/ }));
  check(
    (await main.getAttribute('aria-expanded')) === 'false' &&
      (await details.locator('.muscle-v2-trace-item:visible').count()) === 0,
    'trace-page-reset-muscle',
    width,
    'Trocar de músculo manteve a seção expandida',
  );
  await activate(main);
  await expectVisible('Estímulo contabilizado', 5, 'trace-page-reset-muscle-5');
  await activate(
    details.getByRole('button', { name: 'Mostrar mais 5', exact: true }),
  );
  await expectVisible('Estímulo contabilizado', 10, 'trace-page-before-period');
  // 11: trocar o período reinicia e atualiza a contagem (7 dias → 7 registros).
  await tapOrClick(map.getByRole('combobox', { name: 'Período do mapa' }));
  await tapOrClick(page.getByRole('option', { name: 'Últimos 7 dias' }));
  check(
    (await main.getAttribute('aria-expanded')) === 'false' &&
      (await main.textContent()).includes('(7)') &&
      (await details.locator('.muscle-v2-trace-item:visible').count()) === 0,
    'trace-page-reset-period',
    width,
    'Trocar o período não reiniciou a seção',
  );
  await activate(main);
  await expectVisible('Estímulo contabilizado', 5, 'trace-page-period-5');
  check(
    await details
      .getByRole('button', { name: 'Mostrar mais 2', exact: true })
      .isVisible(),
    'trace-page-period-label',
    width,
    'Texto do botão não refletiu os 2 restantes',
  );
  // 14: nada persistente mudou.
  check(
    (await page.evaluate(() =>
      localStorage.getItem('life-rpg:player-state'),
    )) === original,
    'trace-page-storage',
    width,
    'Paginação alterou o armazenamento',
  );
}

async function standalone() {
  const { chromium } = await import(
    process.env.PLAYWRIGHT_MODULE ?? 'playwright'
  );
  const browser = await chromium.launch({ headless: true });
  const base = (process.env.AUDIT_BASE_URL ?? 'http://127.0.0.1:5173').replace(
    /\/$/,
    '',
  );
  if (new URL(base).hostname !== '127.0.0.1')
    throw new Error('Auditoria exige a origem local 127.0.0.1.');
  const output = resolve(
    process.env.AUDIT_OUTPUT ?? '/tmp/life-rpg-muscle-audit',
  );
  fs.mkdirSync(output, { recursive: true });
  const results = [];
  const errors = [];
  const failures = [];
  const save = () =>
    fs.writeFileSync(
      `${output}/results.json`,
      JSON.stringify({ results, errors, failures }, null, 2),
    );
  const check = (condition, name, width, message) => {
    if (!condition) failures.push({ name, width, message });
  };
  const capture = async (page, name, width) => {
    const map = page.locator('.muscle-v2');
    const geometry = await map.evaluate((el) => ({
      pageWidth: document.documentElement.scrollWidth,
      viewport: innerWidth,
      width: el.getBoundingClientRect().width,
    }));
    check(
      geometry.pageWidth <= geometry.viewport + 1,
      name,
      width,
      'Overflow horizontal',
    );
    await map.screenshot({
      path: `${output}/${name}-${width}.png`,
      animations: 'disabled',
    });
    results.push({ name, width, ...geometry });
    save();
    console.log(name, width);
  };
  try {
    for (const width of (process.env.AUDIT_WIDTHS ?? '320,390,768,1024,1440')
      .split(',')
      .map(Number)) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: 'reduce',
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        hasTouch: width < 768,
      });
      await context.route('**/*', (r) =>
        r.request().url().startsWith(base) ? r.continue() : r.abort(),
      );
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push({ width, error: e.message }));
      await page.clock.setFixedTime(new Date('2026-11-20T12:00:00-03:00'));
      await page.goto(base + '/treinos');
      // Fixtures exist only in this new browser context. No real player data is read.
      await page.evaluate(async () => {
        const {
          createInitialPlayerState,
          PLAYER_STORAGE_KEY,
          PLAYER_STORAGE_VERSION,
        } = await import('/src/app/playerState.ts');
        const { testSession, testSet } =
          await import('/src/modules/workouts/advanced/testFixtures.ts');
        const { starterExercises } =
          await import('/src/modules/workouts/advanced/catalog.ts');
        const state = createInitialPlayerState();
        state.records.advancedWorkouts = {
          version: 1,
          enabled: true,
          exercises: [],
          plans: [],
          sessions: starterExercises.map((exercise, i) =>
            testSession(
              `audit-${i}`,
              `2026-11-${15 + (i % 5)}`,
              Array.from({ length: 3 + (i % 4) }, (_, j) =>
                testSet(`s${j}`, 20 + i * 2, 10, 'working', i % 4),
              ),
              exercise.id,
            ),
          ),
        };
        localStorage.setItem(
          PLAYER_STORAGE_KEY,
          JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: state }),
        );
      });
      await page.reload();
      await page
        .getByRole('tab', { name: 'Mapa muscular', exact: true })
        .click();
      await auditMuscleMap({ page, width, capture, check });
      // Reload with an empty training fixture in the isolated context.
      await page.evaluate(() => {
        const envelope = JSON.parse(
          localStorage.getItem('life-rpg:player-state'),
        );
        envelope.data.records.advancedWorkouts.sessions = [];
        localStorage.setItem('life-rpg:player-state', JSON.stringify(envelope));
      });
      await page.reload();
      await page
        .getByRole('tab', { name: 'Mapa muscular', exact: true })
        .click();
      check(
        (await page
          .getByRole('img', { name: 'Esforço relativo: indeterminado' })
          .count()) === 1,
        'muscle-empty',
        width,
        'Estado vazio inventou esforço',
      );
      await capture(page, 'muscle-empty', width);
      await page.getByRole('tab', { name: 'Recuperação', exact: true }).click();
      check(
        (await page
          .getByRole('img', { name: 'Índice estimado: indeterminado' })
          .count()) === 1,
        'muscle-empty-recovery',
        width,
        'Estado vazio inventou recuperação',
      );
      // 18 agachamentos, um por dia até hoje, só neste contexto isolado.
      await page.evaluate(async () => {
        const { testSession, testSet } =
          await import('/src/modules/workouts/advanced/testFixtures.ts');
        const envelope = JSON.parse(
          localStorage.getItem('life-rpg:player-state'),
        );
        envelope.data.records.advancedWorkouts.sessions = Array.from(
          { length: 18 },
          (_, i) => {
            const date = `2026-11-${String(3 + i).padStart(2, '0')}`;
            return {
              ...testSession(
                `page-${i}`,
                date,
                [testSet('a', 60, 8, 'working', 2), testSet('b', 60, 8)],
                'squat',
              ),
              startedAt: `${date}T07:00:00-03:00`,
            };
          },
        );
        localStorage.setItem('life-rpg:player-state', JSON.stringify(envelope));
      });
      await page.reload();
      await page
        .getByRole('tab', { name: 'Mapa muscular', exact: true })
        .click();
      await auditTracePagination({ page, width, capture, check });
      await context.close();
    }
  } finally {
    save();
    await browser.close();
  }
  console.log(
    `${results.length} capturas; ${errors.length} erros; ${failures.length} falhas. ${output}`,
  );
  if (errors.length || failures.length) process.exitCode = 1;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await standalone();
