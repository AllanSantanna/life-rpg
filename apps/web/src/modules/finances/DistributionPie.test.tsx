import { readFileSync } from 'node:fs';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { applyRecordCommand } from '../records/commands';
import { emptyRecords, type LifeRecords } from '../records/types';
import { money } from './calculations';
import { InvestmentCharts } from './InvestmentCharts';
import { valuationBasis } from './ledger';
import { formatTenths, percentTenths, pieSlices } from './pieChart';
import { investmentCategories, type InvestmentCategory } from './types';

/** Distribuição em pizza. Dados sintéticos; nenhum dado real. */
afterEach(cleanup);
const today = '2026-11-26';
type Command = Parameters<typeof applyRecordCommand>[1];
const apply = (records: LifeRecords, ...commands: Command[]) =>
  commands.reduce(
    (state, command) => applyRecordCommand(state, command, today),
    records,
  );
const asset = (
  id: string,
  category: InvestmentCategory,
  amountCents: number,
): Command => ({
  type: 'saveInvestment',
  value: { id, name: `Ativo ${id}`, category },
  initialEntry: {
    id: `${id}-1`,
    investmentId: id,
    kind: 'contribution',
    amountCents,
    date: '2026-10-01',
    positionInitial: true,
  },
});
const portfolio = () =>
  apply(
    emptyRecords(),
    asset('rf', 'Renda fixa', 250000),
    asset('acao', 'Ações', 180000),
    asset('cx', 'Caixinhas bancárias', 70000),
  );
function show(records: LifeRecords) {
  const view = render(<InvestmentCharts records={records} today={today} />);
  fireEvent.click(screen.getByRole('button', { name: 'Distribuição' }));
  return view;
}
const chart = () =>
  screen.getByRole('img', { name: 'Distribuição dos investimentos' });
const legend = () =>
  within(screen.getByRole('list', { name: 'Categorias da distribuição' }))
    .getAllByRole('button')
    .map((item) => item.textContent?.replace(/\u00a0/g, ' '));
const plain = (text: string) => text.replace(/\u00a0/g, ' ');

describe('percentuais e geometria da pizza', () => {
  it('distribui décimos que somam exatamente 100,0%', () => {
    expect(percentTenths([1, 1, 1])).toEqual([334, 333, 333]);
    expect(percentTenths([250000, 180000, 70000])).toEqual([500, 360, 140]);
    for (const values of [
      [1, 2, 3, 4, 5, 6, 7],
      [999999, 1, 1],
      [33333, 33333, 33334],
    ])
      expect(percentTenths(values).reduce((a, b) => a + b, 0)).toBe(1000);
    expect(percentTenths([0, 500, -3])).toEqual([0, 1000, 0]);
    expect(percentTenths([0, 0])).toEqual([0, 0]);
    expect(formatTenths(394)).toBe('39,4%');
    expect(formatTenths(1000)).toBe('100%');
  });

  it('desenha setores preenchidos até o centro, proporcionais e sem setores inválidos', () => {
    const slices = pieSlices([300, 100, 0, -5]);
    expect(slices.map((slice) => slice.index)).toEqual([0, 1]);
    expect(slices[0]).toMatchObject({ start: 0, end: 270 });
    expect(slices[1]).toMatchObject({ start: 270, end: 360 });
    // Pizza: cada setor parte do centro (não é rosca).
    for (const slice of slices)
      expect(slice.path).toMatch(/^M 100 100 L .* A 96 96 0 [01] 1 .* Z$/);
    expect(slices[0]!.path).toContain(' 0 1 1 ');
    // Uma categoria: círculo inteiro.
    expect(pieSlices([0, 500])).toEqual([{ index: 1, start: 0, end: 360 }]);
    expect(pieSlices([0, 0])).toEqual([]);
  });
});

describe('gráfico de distribuição na aba Investimentos', () => {
  it('mostra setores, legenda e detalhe com valores reais', () => {
    show(portfolio());
    const svg = chart();
    expect(svg.querySelectorAll('path.distribution-pie__slice')).toHaveLength(
      3,
    );
    // Pizza preenchida: nenhum furo central nem barras.
    expect(svg.querySelector('circle[fill="none"]')).toBeNull();
    expect(document.querySelector('.investment-bars')).toBeNull();
    expect(legend()).toEqual([
      expect.stringContaining(`Renda fixa *${plain(money(250000))} · 50%`),
      expect.stringContaining(`Ações *${plain(money(180000))} · 36%`),
      expect.stringContaining(
        `Caixinhas bancárias *${plain(money(70000))} · 14%`,
      ),
    ]);
    const detail = document.querySelector('.distribution-pie__detail')!;
    expect(plain(detail.textContent!)).toContain('Renda fixa');
    expect(screen.getByText(/Renda fixa: R\$\s2\.500,00, 50%/)).toHaveClass(
      'sr-only',
    );
  });

  it('responde a mouse, toque e teclado', () => {
    show(portfolio());
    const detail = () =>
      plain(document.querySelector('.distribution-pie__detail')!.textContent!);
    const slice = chart().querySelector('[data-category="Ações"]')!;
    fireEvent.pointerEnter(slice);
    expect(detail()).toContain('Ações');
    fireEvent.click(
      chart().querySelector('[data-category="Caixinhas bancárias"]')!,
    );
    expect(detail()).toContain('Caixinhas bancárias');
    const list = screen.getByRole('list', {
      name: 'Categorias da distribuição',
    });
    const pressed = within(list).getByRole('button', { pressed: true });
    pressed.focus();
    fireEvent.keyDown(pressed, { key: 'Home' });
    expect(detail()).toContain('Renda fixa');
    expect(within(list).getAllByRole('button')[0]).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(detail()).toContain('Ações');
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(detail()).toContain('Caixinhas bancárias');
    expect(within(list).getAllByRole('button')[2]).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('atualiza após aportes, resgates e avaliações manuais', () => {
    let records = portfolio();
    const { rerender } = show(records);
    records = apply(records, {
      type: 'saveInvestmentEntry',
      value: {
        id: 'cx-2',
        investmentId: 'cx',
        kind: 'contribution',
        amountCents: 30000,
        date: '2026-11-05',
        walletLinked: false,
      },
    });
    rerender(<InvestmentCharts records={records} today={today} />);
    expect(legend()[2]).toContain(`${plain(money(100000))} · 18,9%`);
    records = apply(records, {
      type: 'saveInvestmentEntry',
      value: {
        id: 'acao-2',
        investmentId: 'acao',
        kind: 'withdrawal',
        amountCents: 80000,
        date: '2026-11-06',
        walletLinked: false,
      },
    });
    rerender(<InvestmentCharts records={records} today={today} />);
    expect(legend()).toEqual([
      expect.stringContaining(`${plain(money(250000))} · 55,6%`),
      expect.stringContaining(`${plain(money(100000))} · 22,2%`),
      expect.stringContaining(`${plain(money(100000))} · 22,2%`),
    ]);
    records = apply(records, {
      type: 'saveValuation',
      value: {
        id: 'v',
        investmentId: 'rf',
        amountCents: 300000,
        date: '2026-11-07',
        basis: valuationBasis(records.investmentEntries, 'rf', '2026-11-07'),
      },
    });
    rerender(<InvestmentCharts records={records} today={today} />);
    // Valor avaliado: sem o asterisco de referência pelo custo.
    expect(legend()[0]).toContain(`Renda fixa${plain(money(300000))} · 60%`);
  });

  it('uma categoria ocupa o círculo inteiro', () => {
    show(apply(emptyRecords(), asset('rf', 'Renda fixa', 100000)));
    const svg = chart();
    expect(svg.querySelectorAll('.distribution-pie__slice')).toHaveLength(1);
    expect(svg.querySelector('circle.distribution-pie__slice')).toHaveAttribute(
      'r',
      '96',
    );
    expect(legend()[0]).toContain('100%');
  });

  it('estado vazio e categorias sem valor não geram setores', () => {
    show(emptyRecords());
    expect(screen.getByText(/Cadastre um investimento/)).toBeInTheDocument();
    cleanup();
    // Posição sem custo nem cotação: sem setor, listada como pendente.
    const unpriced = apply(emptyRecords(), {
      type: 'saveInvestment',
      value: { id: 'usd', name: 'Dólar', category: 'Dólar (USD)' },
      initialEntry: {
        id: 'usd-1',
        investmentId: 'usd',
        kind: 'contribution',
        amountCents: 0,
        quantity: 100,
        costUnknown: true,
        date: '2026-10-01',
        positionInitial: true,
      },
    });
    show(unpriced);
    expect(
      screen.getByText(/Ainda não há valores registrados para distribuir/),
    ).toBeInTheDocument();
    expect(document.querySelector('.distribution-pie__slice')).toBeNull();
  });
});

// Arquivo-fonte lido do disco: no Vitest, CSS importado chega vazio.
// Caminho em variável: o Vite reescreve `new URL('literal', import.meta.url)`.
const read = (path: string) =>
  readFileSync(
    decodeURIComponent(new URL(path, import.meta.url).pathname),
    'utf8',
  );
const css = read('../../shared/styles/index.css');
const rule = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
};
const detailText = () =>
  plain(document.querySelector('.distribution-pie__detail')!.textContent!);
const legendButton = (category: string) =>
  within(screen.getByRole('list', { name: 'Categorias da distribuição' }))
    .getAllByRole('button')
    .find((item) => item.textContent?.includes(category))!;

describe('acabamento visual e interação da pizza', () => {
  it('cada categoria tem cor estável, igual na fatia e no marcador', () => {
    let records = portfolio();
    const { rerender } = show(records);
    const tones = () =>
      Object.fromEntries(
        [...chart().querySelectorAll('.distribution-pie__slice')].map(
          (slice) => [
            slice.getAttribute('data-category'),
            slice.getAttribute('data-tone'),
          ],
        ),
      );
    const before = tones();
    for (const [category, value] of Object.entries(before)) {
      expect(value).toBe(
        String(investmentCategories.indexOf(category as InvestmentCategory)),
      );
      expect(
        legendButton(
          category === 'Ações' ? 'Ações' : category.split(' ')[0]!,
        ).querySelector('.distribution-pie__swatch'),
      ).toHaveAttribute('data-tone', value!);
    }
    // Um aporte muda a ordem da legenda, não as cores.
    records = apply(records, {
      type: 'saveInvestmentEntry',
      value: {
        id: 'cx-big',
        investmentId: 'cx',
        kind: 'contribution',
        amountCents: 900000,
        date: '2026-11-05',
        walletLinked: false,
      },
    });
    rerender(<InvestmentCharts records={records} today={today} />);
    expect(legend()[0]).toContain('Caixinhas bancárias');
    expect(tones()).toEqual(before);
  });

  it('a fatia, o marcador e o brilho usam a mesma variável de cor', () => {
    expect(css).toMatch(/--color-chart-4:\s*#35b779;/);
    investmentCategories.forEach((_, index) =>
      expect(rule(`.distribution-pie [data-tone='${index}']`)).toContain(
        `--slice-color: var(--color-chart-${index + 1})`,
      ),
    );
    expect(rule('.distribution-pie__slice')).toContain(
      'fill: var(--slice-color)',
    );
    expect(rule('.distribution-pie__swatch')).toContain(
      'background: var(--slice-color)',
    );
    expect(rule('.distribution-pie__glow[data-on]')).toMatch(
      /drop-shadow\([^)]*var\(--slice-color\)/,
    );
    // Transição suave com a curva definida.
    expect(rule('.distribution-pie')).toContain(
      'cubic-bezier(0.22, 1, 0.36, 1)',
    );
    expect(rule('.distribution-pie')).toMatch(
      /--pie-duration: (18|19|2[0-4])0ms/,
    );
  });

  it('respeita a redução de movimento sem desligar o destaque', () => {
    const start = css.indexOf(
      '@media (prefers-reduced-motion: reduce) {\n  .distribution-pie__slice',
    );
    expect(start).toBeGreaterThan(0);
    const block = css.slice(start, css.indexOf('\n}\n', start));
    expect(block).toContain('transition: none');
    expect(block).toMatch(
      /\.distribution-pie__glow\[data-on\] \{\s*transform: none/,
    );
    expect(block).toContain('animation: none');
    expect(block).not.toMatch(/opacity|filter/);
  });

  it('clique e toque selecionam; a anterior perde o destaque', () => {
    show(portfolio());
    const glow = (category: string) =>
      chart().querySelector(`[data-glow="${category}"]`)!;
    expect(glow('Renda fixa')).toHaveAttribute('data-on');
    fireEvent.click(chart().querySelector('[data-category="Ações"]')!);
    expect(glow('Ações')).toHaveAttribute('data-on');
    expect(glow('Renda fixa')).not.toHaveAttribute('data-on');
    expect(chart().querySelectorAll('[data-on]')).toHaveLength(1);
    expect(legendButton('Ações')).toHaveAttribute('aria-pressed', 'true');
    expect(legendButton('Renda fixa')).toHaveAttribute('aria-pressed', 'false');
    expect(detailText()).toContain(`Ações *${plain(money(180000))} · 36%`);
    // Toque não passa por hover: seleciona direto.
    const touch = chart().querySelector(
      '[data-category="Caixinhas bancárias"]',
    )!;
    fireEvent.pointerEnter(touch, { pointerType: 'touch' });
    fireEvent.click(touch);
    expect(legendButton('Caixinhas')).toHaveAttribute('aria-pressed', 'true');
    // A pizza continua preenchida: setores partem do centro.
    for (const path of chart().querySelectorAll('path'))
      expect(path.getAttribute('d')).toMatch(/^M 100 100 L/);
  });

  it('hover pré-visualiza sem substituir a seleção', () => {
    show(portfolio());
    fireEvent.click(legendButton('Ações'));
    const slice = chart().querySelector(
      '[data-category="Caixinhas bancárias"]',
    )!;
    fireEvent.pointerEnter(slice, { pointerType: 'mouse' });
    expect(detailText()).toContain('Caixinhas bancárias');
    expect(legendButton('Caixinhas')).toHaveAttribute('data-shown');
    expect(legendButton('Ações')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.pointerLeave(chart());
    expect(detailText()).toContain('Ações');
    expect(legendButton('Caixinhas')).not.toHaveAttribute('data-shown');
    // Hover pela legenda também só pré-visualiza.
    fireEvent.pointerEnter(legendButton('Renda fixa'), {
      pointerType: 'mouse',
    });
    expect(detailText()).toContain('Renda fixa');
    fireEvent.pointerLeave(
      screen.getByRole('list', { name: 'Categorias da distribuição' }),
    );
    expect(detailText()).toContain('Ações');
  });

  it('troca rápida e teclado mantêm um único destaque e dados intactos', () => {
    const records = portfolio();
    const snapshot = JSON.stringify(records);
    show(records);
    for (const category of [
      'Ações',
      'Caixinhas bancárias',
      'Renda fixa',
      'Ações',
    ])
      fireEvent.click(chart().querySelector(`[data-category="${category}"]`)!);
    expect(chart().querySelectorAll('[data-on]')).toHaveLength(1);
    expect(detailText()).toContain('Ações');
    const pressed = legendButton('Ações');
    pressed.focus();
    fireEvent.keyDown(pressed, { key: 'ArrowDown' });
    expect(legendButton('Caixinhas')).toHaveFocus();
    expect(detailText()).toContain(
      `Caixinhas bancárias *${plain(money(70000))} · 14%`,
    );
    expect(
      chart().querySelector('[data-glow="Caixinhas bancárias"]'),
    ).toHaveAttribute('data-on');
    expect(JSON.stringify(records)).toBe(snapshot);
  });
});
