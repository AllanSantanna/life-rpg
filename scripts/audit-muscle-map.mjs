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
  const trace = details.getByRole('region', {
    name: 'Exercícios que estimularam este músculo',
  });
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
  await trace.scrollIntoViewIfNeeded();
  await capture(page, 'muscle-trace', width);
  // Região pequena no celular: usa a alternativa documentada da lista (44 px).
  const abductor = map.getByRole('button', { name: /^Abdutores/ });
  if (width < 768) await abductor.tap();
  else await abductor.click();
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
