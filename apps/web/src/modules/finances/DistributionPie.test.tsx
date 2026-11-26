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
import type { InvestmentCategory } from './types';

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
