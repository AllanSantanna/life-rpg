import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { auditStatistics } from './audit-statistics.mjs';
import { auditMuscleMap } from './audit-muscle-map.mjs';

// Opcional: Playwright pertence ao ambiente de auditoria, não ao bundle do app.
let chromium;
try {
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright'));
} catch (error) {
  throw new Error(
    'Instale Playwright no ambiente de auditoria e defina PLAYWRIGHT_MODULE; consulte docs/design-system/responsive.md.',
    { cause: error },
  );
}
const base = (process.env.AUDIT_BASE_URL ?? 'http://127.0.0.1:5173').replace(
  /\/$/,
  '',
);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname))
  throw new Error(
    'A auditoria com fixtures exige uma instância local do Vite.',
  );
const out = resolve(process.env.AUDIT_OUTPUT ?? `${tmpdir()}/life-rpg-audit`);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
});
const results = [];
const errors = [];
const failures = [];
function save() {
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify(
      { browser: browser.version(), results, errors, failures },
      null,
      2,
    ),
  );
}
function check(condition, name, width, message) {
  if (!condition) failures.push({ name, width, message });
}
async function seed(page, populated) {
  await page.evaluate(async (populated) => {
    const {
      createInitialPlayerState,
      PLAYER_STORAGE_KEY,
      PLAYER_STORAGE_VERSION,
      isPlayerState,
    } = await import('/src/app/playerState.ts');
    const { applyGoalCommand } = await import('/src/modules/goals/commands.ts');
    const { blankGoal } = await import('/src/modules/goals/templates.ts');
    const { testState, testSession, testSet } =
      await import('/src/modules/workouts/advanced/testFixtures.ts');
    const state = createInitialPlayerState();
    if (populated) {
      const today = '2026-11-17';
      state.profile.name = 'Aventureiro com nome extenso';
      state.records.workouts = [{ date: today, trained: true }];
      state.records.sleep = [{ date: today, hours: 7.5 }];
      state.records.books = [
        {
          id: 'book-a',
          title:
            'Livro de auditoria com um título bastante extenso para conferir a responsividade dos cartões e das ações',
          totalPages: 200,
        },
        { id: 'book-b', title: 'Livro concluído', totalPages: 100 },
      ];
      state.records.readings = [
        { id: 'reading-a', bookId: 'book-a', date: today, pages: 30 },
        { id: 'reading-b', bookId: 'book-b', date: today, pages: 100 },
      ];
      state.records.finance = {
        accounts: [
          {
            id: 'principal',
            name: 'Conta principal da auditoria',
            initialCents: 500000,
            date: '2026-01-01',
          },
          {
            id: 'other',
            name: 'Conta secundária',
            initialCents: 200000,
            date: '2026-01-01',
          },
        ],
        transfers: [],
        valuations: [],
        quotes: [],
      };
      state.records.movements = [
        {
          id: 'income',
          kind: 'income',
          description: 'Receita mensal de exemplo para auditoria',
          category: 'Trabalho',
          amountCents: 500000,
          date: today,
          accountId: 'principal',
        },
        {
          id: 'expense',
          kind: 'expense',
          description:
            'Despesa com descrição extensa para conferir as ações do histórico financeiro',
          category: 'Geral',
          amountCents: 50000,
          date: today,
          accountId: 'principal',
        },
      ];
      state.records.investments = [
        {
          id: 'box',
          name: 'Caixinha de auditoria com nome extenso',
          category: 'Caixinhas bancárias',
          institution: 'Banco de exemplo',
        },
        {
          id: 'fixed',
          name: 'Investimento de renda fixa',
          category: 'Renda fixa',
        },
        { id: 'btc', name: 'Bitcoin (BTC)', category: 'Bitcoin' },
        { id: 'vale', name: 'Vale', category: 'Ações', ticker: 'VALE3' },
      ];
      state.records.investmentEntries = [
        {
          id: 'entry-box',
          investmentId: 'box',
          kind: 'contribution',
          amountCents: 100000,
          date: today,
          accountId: 'principal',
          positionInitial: true,
        },
        {
          id: 'entry-fixed',
          investmentId: 'fixed',
          kind: 'contribution',
          amountCents: 50000,
          date: today,
          accountId: 'principal',
          positionInitial: false,
        },
        {
          id: 'entry-btc',
          investmentId: 'btc',
          kind: 'contribution',
          amountCents: 23954,
          quantity: 0.00061258,
          date: today,
          positionInitial: true,
        },
        {
          id: 'entry-vale',
          investmentId: 'vale',
          kind: 'contribution',
          amountCents: 12000,
          quantity: 2,
          date: '2026-11-03',
          accountId: 'principal',
          positionInitial: false,
        },
      ];
      // Cotação fixa da fixture: a auditoria bloqueia chamadas externas.
      const observed = new Date('2026-11-17T11:00:00-03:00').getTime();
      state.records.finance.quotes = [
        { priceCents: 39000000, updatedAt: observed, observedAt: observed },
      ];
      state.records.advancedWorkouts = testState();
      state.records.advancedWorkouts.plans = [
        {
          id: 'plan-a',
          name: 'Treino A com título extenso para verificar a disposição das ações e dos cartões',
          description: 'Peito e tríceps',
          notes: '',
          exercises: [
            { id: 'pe-1', exerciseId: 'bench', sets: 3, reps: 10, notes: '' },
            { id: 'pe-2', exerciseId: 'curl', sets: 3, reps: 12, notes: '' },
          ],
        },
      ];
      state.records.advancedWorkouts.rotation = {
        sequence: ['plan-a'],
        cursor: 0,
      };
      state.records.advancedWorkouts.sessions = [
        testSession('old-a', '2026-11-13', [
          testSet('s1', 60, 10),
          testSet('s2', 65, 8),
        ]),
        testSession('old-b', '2026-11-16', [testSet('s3', 70, 8)]),
      ];
      const definition = {
        ...blankGoal(today),
        title:
          'Concluir uma atividade pessoal com título extenso para verificar os cartões',
        description:
          'Descrição de auditoria para conferir o espaço entre controles e as quebras de texto.',
        kind: 'completion',
        target: 1000,
      };
      state.goals = applyGoalCommand(
        state.goals,
        { type: 'save', id: 'goal-a', definition },
        today,
      );
    }
    if (!isPlayerState(state)) throw new Error('Fixture de auditoria inválida');
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: state }),
    );
  }, populated);
}
async function capture(page, name, width) {
  if (
    !(await page
      .locator(
        'dialog[open], [role=listbox]:not([aria-hidden=true]), [role=menu]:not([aria-hidden=true])',
      )
      .count())
  )
    await page.evaluate(() => scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const metrics = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const c = getComputedStyle(el);
      return (
        el.checkVisibility() &&
        r.width > 0 &&
        r.height > 0 &&
        c.visibility !== 'hidden' &&
        !el.closest('[hidden], [inert]')
      );
    };
    const info = (el) => {
      const r = el.getBoundingClientRect();
      const c = getComputedStyle(el);
      return {
        tag: el.tagName,
        className: String(el.className).slice(0, 100),
        text: (el.getAttribute('aria-label') ?? el.textContent ?? '')
          .trim()
          .slice(0, 100),
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height),
        font: c.fontSize,
        minHeight: c.minHeight,
        border: c.borderRadius,
        color: c.color,
        background: c.backgroundImage,
      };
    };
    const hiddenValidation = [
      ...document.querySelectorAll('input.custom-date-picker__validation'),
    ]
      .filter((el) => el.checkVisibility())
      .map(info);
    const actions = [...document.querySelectorAll('.action-button')]
      .filter(visible)
      .map(info);
    const sticky = [...document.querySelectorAll('.workout-sticky-actions')]
      .filter(visible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const nav = document.querySelector('.sidebar')?.getBoundingClientRect();
        const inset = Number.parseFloat(getComputedStyle(el).bottom);
        const pinned = Math.abs(rect.bottom - (innerHeight - inset)) < 2;
        return {
          bottom: rect.bottom,
          top: rect.top,
          navTop: nav?.top,
          overlapsNavigation:
            innerWidth < 1024 &&
            pinned &&
            rect.top < innerHeight &&
            !!nav &&
            rect.bottom > nav.top + 1,
        };
      });
    const hasPicker = [...document.querySelectorAll('.exercise-picker')].some(
      visible,
    );
    const investmentCards = [...document.querySelectorAll('.investment-card')]
      .filter(visible)
      .filter((el) => !el.classList.contains('investment-card--active'))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const actions = [...el.querySelectorAll('button')].filter(visible);
        return {
          name: el.getAttribute('aria-label'),
          top: Math.round(rect.top),
          height: Math.round(rect.height),
          primaryTop: Math.round(
            el.querySelector('.action-button')?.getBoundingClientRect().top ??
              -1,
          ),
          // Somente os botões oficiais documentados no catálogo.
          unofficial: actions
            .filter(
              (button) =>
                !(
                  button.className === 'action-button' ||
                  button.className === 'filter-button' ||
                  button.className === 'financial-danger' ||
                  button.className === 'text-action' ||
                  (button.className === '' &&
                    button.parentElement?.classList.contains('record-actions'))
                ) &&
                // Formulários e gráficos (padrão do FinancialChart) têm controles próprios.
                !button.closest('form, .wealth-chart'),
            )
            .map((button) => button.textContent.trim()),
        };
      });
    return {
      viewport: vw,
      viewportHeight: innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      overflow: [...document.querySelectorAll('main *')]
        .filter(
          (el) =>
            visible(el) &&
            el.getBoundingClientRect().right > vw + 1 &&
            !el.closest('.strength-chart-scroll'),
        )
        .map(info)
        .slice(0, 20),
      buttons: [...document.querySelectorAll('button')]
        .filter(visible)
        .map(info),
      fields: [
        ...document.querySelectorAll(
          'input:not([type=hidden]), textarea, [role=combobox]',
        ),
      ]
        .filter(visible)
        .map(info),
      dialogs: [
        ...document.querySelectorAll(
          'dialog[open], [role=listbox]:not([aria-hidden=true]), [role=menu]:not([aria-hidden=true])',
        ),
      ]
        .filter(visible)
        .map(info),
      hiddenValidation,
      investmentCards,
      actions,
      sticky,
      hasPicker,
    };
  });
  check(
    metrics.documentWidth <= metrics.viewport + 1,
    name,
    width,
    `Rolagem horizontal: ${metrics.documentWidth - metrics.viewport}px`,
  );
  for (const field of metrics.hiddenValidation)
    check(
      field.width <= 1 && field.height <= 1,
      name,
      width,
      'Campo de validação oculto recebeu dimensões de campo visível.',
    );
  for (const card of metrics.investmentCards) {
    check(
      card.unofficial.length === 0,
      name,
      width,
      `Cartão ${card.name} com botões fora do Design System: ${card.unofficial.join(', ')}`,
    );
    const row = metrics.investmentCards.filter((item) => item.top === card.top);
    check(
      row.every(
        (item) =>
          Math.abs(item.height - card.height) <= 1 &&
          Math.abs(item.primaryTop - card.primaryTop) <= 1,
      ),
      name,
      width,
      `Cartões da mesma linha desalinhados: ${row.map((item) => item.name).join(', ')}`,
    );
  }
  for (const action of metrics.actions)
    check(
      action.width === 160 && action.height === 44 && action.font === '12px',
      name,
      width,
      `Ação fora do padrão: ${action.text}`,
    );
  for (const dialog of metrics.dialogs)
    check(
      dialog.x >= 0 &&
        dialog.y >= 0 &&
        dialog.x + dialog.width <= metrics.viewport + 1 &&
        dialog.y + dialog.height <= metrics.viewportHeight + 1,
      name,
      width,
      `Popover/diálogo fora da tela: ${dialog.className}`,
    );
  if (!metrics.dialogs.length) {
    for (const sticky of metrics.sticky)
      check(
        !sticky.overlapsNavigation,
        name,
        width,
        'Barra de ações sobreposta à navegação inferior.',
      );
    if (metrics.hasPicker)
      check(
        metrics.sticky.length === 1,
        name,
        width,
        'O seletor de exercícios deve mostrar apenas sua própria barra de ações.',
      );
  }
  await page.screenshot({
    path: `${out}/${name}-${width}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  results.push({ name, width, ...metrics });
  save();
  console.log(
    name,
    width,
    `overflow=${metrics.documentWidth - metrics.viewport}`,
    metrics.dialogs.length ? `dialogs=${JSON.stringify(metrics.dialogs)}` : '',
  );
}
try {
  for (const width of (process.env.AUDIT_WIDTHS ?? '320,390,768,1024,1440')
    .split(',')
    .map(Number)) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: 'reduce',
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
    });
    await context.route('**/*', (route) =>
      route.request().url().startsWith(base) ? route.continue() : route.abort(),
    );
    // Resposta simulada do proxy apps/api (/market/quotes): sem rede externa.
    await context.route('**/market/quotes/*', (route) =>
      route.fulfill({
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          ticker: 'VALE3',
          name: 'Vale S.A.',
          priceCents: 6120,
          previousCloseCents: 6045,
          marketTime: Date.parse('2026-11-17T11:30:00-03:00'),
          fetchedAt: Date.parse('2026-11-17T11:45:00-03:00'),
          stale: false,
          history: [
            ['2026-11-04', 6050],
            ['2026-11-05', 5980],
            ['2026-11-06', 6010],
            ['2026-11-07', 6100],
            ['2026-11-10', 6080],
            ['2026-11-11', 6030],
            ['2026-11-12', 6045],
            ['2026-11-13', 6090],
            ['2026-11-14', 6045],
          ].map(([date, closeCents]) => ({ date, closeCents })),
        }),
      }),
    );
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', (error) =>
      errors.push({ width, error: error.message }),
    );
    await page.clock.setFixedTime(new Date('2026-11-17T12:00:00-03:00'));
    await page.goto(base);
    if (process.env.AUDIT_STATISTICS_ONLY) {
      await seed(page, true);
      await page.goto(base + '/estatisticas');
      await capture(page, 'estatisticas-populated', width);
      await auditStatistics({ page, width, capture, check });
      await context.close();
      continue;
    }
    if (!process.env.AUDIT_STRESS_ONLY) {
      for (const populated of [false, true]) {
        await seed(page, populated);
        for (const [name, route] of Object.entries({
          dashboard: '/',
          perfil: '/perfil',
          quests: '/quests',
          estatisticas: '/estatisticas',
          pilares: '/pilares',
          financas: '/financas',
          treinos: '/treinos',
          descanso: '/descanso',
          conhecimento: '/conhecimento',
        })) {
          await page.goto(base + route);
          await page.locator('main').waitFor();
          await capture(
            page,
            `${name}-${populated ? 'populated' : 'empty'}`,
            width,
          );
          if (name === 'estatisticas' && populated)
            await auditStatistics({ page, width, capture, check });
        }
      }
      await page.goto(base + '/treinos');
      await page
        .getByRole('button', { name: 'Importar treino', exact: true })
        .click();
      await capture(page, 'importacao', width);
      const beforePreview = await page.evaluate(() =>
        localStorage.getItem('life-rpg:player-state'),
      );
      await page
        .getByLabel('Texto do treino', { exact: true })
        .fill(
          'Treino A - Peito\nData: 16/11/2026\nSupino reto:60x10,65x8 rir2\nElevação lateral:12kg x12',
        );
      await page.getByRole('button', { name: 'Interpretar treino' }).click();
      await capture(page, 'importacao-previa', width);
      check(
        (await page.evaluate(() =>
          localStorage.getItem('life-rpg:player-state'),
        )) === beforePreview,
        'importacao-previa',
        width,
        'A prévia não deve alterar dados persistidos.',
      );
      await page
        .getByRole('button', { name: 'Cancelar importação', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Nova ficha', exact: true })
        .click();
      await capture(page, 'ficha-divisao', width);
      await page.getByRole('button', { name: 'Avançar' }).click();
      await capture(page, 'ficha-personalizacao', width);
      await page.getByRole('button', { name: 'Avançar' }).click();
      await capture(page, 'ficha-exercicios', width);
      await page
        .getByRole('button', { name: 'Adicionar exercícios', exact: true })
        .click();
      await capture(page, 'exercicios-picker', width);
      await page.getByRole('button', { name: 'Cancelar criação' }).click();
      await page
        .getByRole('button', {
          name: 'Abrir ficha Treino A com título extenso para verificar a disposição das ações e dos cartões',
          exact: true,
        })
        .click();
      await page
        .getByRole('button', { name: 'Editar ficha', exact: true })
        .click();
      await capture(page, 'ficha-edicao', width);
      await page
        .getByRole('button', { name: 'Cancelar edição', exact: true })
        .click();
      for (const [name, label] of Object.entries({
        historico: 'Histórico',
        cargas: 'Evolução de cargas',
        recordes: 'Recordes pessoais',
        volume: 'Volume de treinamento',
        muscular: 'Mapa muscular',
      })) {
        await page.getByRole('tab', { name: label, exact: true }).click();
        await capture(page, `treinos-${name}`, width);
        if (name === 'muscular')
          await auditMuscleMap({ page, width, capture, check });
      }
      await page.getByRole('tab', { name: 'Minhas fichas' }).click();
      await page
        .getByRole('button', { name: 'Iniciar treino', exact: true })
        .click();
      await capture(page, 'sessao', width);
      await page.goto(base + '/quests');
      await page
        .getByRole('button', { name: 'Criar minha quest', exact: true })
        .click();
      await capture(page, 'quest-form', width);
      await page.goto(base + '/financas');
      await page
        .getByText('Contas, transferências e avaliações manuais', {
          exact: true,
        })
        .click();
      await capture(page, 'financas-contas', width);
      await page
        .getByRole('button', {
          name: 'Excluir conta Conta principal da auditoria',
          exact: true,
        })
        .click();
      await capture(page, 'financas-dialog', width);
      await page.keyboard.press('Escape');
      await page
        .getByText('Configurações financeiras', { exact: true })
        .click();
      await capture(page, 'financas-configuracoes', width);
      await page
        .getByRole('button', {
          name: 'Redefinir dados financeiros',
          exact: true,
        })
        .click();
      await capture(page, 'financas-reset-dialog', width);
      await page.keyboard.press('Escape');
      await page
        .getByRole('button', { name: 'Nova movimentação', exact: true })
        .click();
      await capture(page, 'financas-movimentacao', width);
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await page
        .getByRole('button', {
          name: 'Histórico de movimentações',
          exact: true,
        })
        .click();
      await capture(page, 'financas-historico', width);
      await page
        .getByRole('tab', { name: 'Investimentos', exact: true })
        .click();
      await capture(page, 'financas-investimentos', width);
      await page
        .getByRole('button', {
          name: 'Mais ações de Caixinha de auditoria com nome extenso',
          exact: true,
        })
        .click();
      await capture(page, 'financas-menu', width);
      await page
        .getByRole('menuitem', {
          name: 'Atualizar saldo de Caixinha de auditoria com nome extenso',
          exact: true,
        })
        .click();
      await capture(page, 'financas-caixinha', width);
      await page
        .getByRole('button', {
          name: 'Aportar em Caixinha de auditoria com nome extenso',
          exact: true,
        })
        .click();
      await capture(page, 'financas-aporte', width);
      await page
        .getByRole('button', {
          name: 'Mais ações de Bitcoin (BTC)',
          exact: true,
        })
        .click();
      await page
        .getByRole('menuitem', { name: 'Vender Bitcoin (BTC)', exact: true })
        .click();
      await capture(page, 'financas-venda-btc', width);
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await page
        .getByRole('button', {
          name: 'Ver detalhes de Bitcoin (BTC)',
          exact: true,
        })
        .click();
      await capture(page, 'financas-detalhes', width);
      await page
        .getByRole('button', { name: 'Ver detalhes de Vale', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Valor da posição', exact: true })
        .click();
      await capture(page, 'financas-acao-detalhes', width);
      await page
        .getByRole('button', {
          name: 'Histórico de investimentos',
          exact: true,
        })
        .click();
      await capture(page, 'financas-historico-investimentos', width);
      await page
        .getByRole('button', { name: 'Novo investimento', exact: true })
        .click();
      await capture(page, 'financas-novo-investimento', width);
      await page.goto(base + '/descanso');
      await page
        .getByRole('combobox', { name: 'Data', exact: true })
        .first()
        .click();
      await capture(page, 'calendario-popup', width);
      await page.keyboard.press('Escape');
      check(
        await page
          .getByRole('combobox', { name: 'Data', exact: true })
          .first()
          .evaluate((el) => el === document.activeElement),
        'calendario-popup',
        width,
        'Calendário não restaurou o foco.',
      );
      await page.goto(base + '/financas');
      await page
        .getByRole('tab', { name: 'Investimentos', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Novo investimento', exact: true })
        .click();
      await page
        .getByRole('combobox', {
          name: 'Categoria do investimento',
          exact: true,
        })
        .click();
      await capture(page, 'seletor-popup', width);
      await page.keyboard.press('Escape');
      check(
        await page
          .getByRole('combobox', {
            name: 'Categoria do investimento',
            exact: true,
          })
          .evaluate((el) => el === document.activeElement),
        'seletor-popup',
        width,
        'Seletor não restaurou o foco.',
      );
      for (const [value, name] of [
        ['Bitcoin', 'financas-bitcoin'],
        ['Dólar (USD)', 'financas-usd'],
      ]) {
        await page
          .getByRole('combobox', {
            name: 'Categoria do investimento',
            exact: true,
          })
          .click();
        await page.getByRole('option', { name: value, exact: true }).click();
        await capture(page, name, width);
      }
      await page.goto(base + '/perfil');
      await page.getByRole('textbox', { name: 'Nome do jogador' }).fill('   ');
      await page.getByRole('button', { name: 'Salvar nome' }).click();
      await capture(page, 'perfil-erro', width);
      check(
        (await page.getByRole('alert').count()) === 1,
        'perfil-erro',
        width,
        'Erro de nome deve ser anunciado como alerta.',
      );
    } else {
      await seed(page, true);
    }
    await page.evaluate(() => {
      const envelope = JSON.parse(
        localStorage.getItem('life-rpg:player-state'),
      );
      const state = envelope.data;
      state.profile.name = 'A'.repeat(40);
      state.records.books[0].title = 'Leitura'.repeat(25);
      state.records.movements[0].description = 'Descrição'.repeat(20);
      state.records.investments[0].name = 'Reserva'.repeat(20);
      state.records.advancedWorkouts.plans[0].name = 'Treino'.repeat(30);
      state.goals.items[0].title = 'Projeto'.repeat(24);
      localStorage.setItem('life-rpg:player-state', JSON.stringify(envelope));
    });
    for (const [name, route] of Object.entries({
      dashboard: '/',
      perfil: '/perfil',
      conhecimento: '/conhecimento',
      financas: '/financas',
      treinos: '/treinos',
      quests: '/quests',
    })) {
      await page.goto(base + route);
      await capture(page, `${name}-texto-longo`, width);
    }
    await context.close();
  }
} catch (error) {
  errors.push({ scenario: 'runner', error: error.message });
  throw error;
} finally {
  save();
  await browser.close();
}
console.log(
  `${results.length} capturas; ${errors.length} erros de página; ${failures.length} falhas de layout. Relatório: ${out}/results.json`,
);
if (errors.length || failures.length) process.exitCode = 1;
