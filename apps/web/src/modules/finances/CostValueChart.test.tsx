import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { applyRecordCommand } from '../records/commands';
import { emptyRecords, type LifeRecords } from '../records/types';
import { money } from './calculations';
import { InvestmentCharts } from './InvestmentCharts';
import { valuationBasis } from './ledger';
import type { InvestmentCategory } from './types';

/** Custo × valor com diferença negativa. Dados sintéticos; nenhum dado real. */
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
function valued(records: LifeRecords, id: string, amountCents: number) {
  return apply(records, {
    type: 'saveValuation',
    value: {
      id: `${id}-av`,
      investmentId: id,
      amountCents,
      date: '2026-11-02',
      movementsComplete: true,
      basis: valuationBasis(records.investmentEntries, id, '2026-11-02'),
    },
  });
}
function rowOf(label: string) {
  const item = screen
    .getAllByRole('listitem')
    .find((node) => node.textContent?.includes(label));
  if (!item) throw new Error(`Linha ${label} não encontrada`);
  return item;
}

describe('custo × valor', () => {
  it('marca em vermelho só as categorias com valor abaixo do custo', () => {
    let records = apply(
      emptyRecords(),
      asset('rf', 'Renda fixa', 100000),
      asset('cx', 'Caixinhas bancárias', 50000),
      asset('out', 'Outros', 20000),
    );
    records = valued(records, 'rf', 90000);
    records = valued(records, 'cx', 53000);
    render(<InvestmentCharts records={records} today={today} />);
    fireEvent.click(screen.getByRole('button', { name: 'Custo × valor' }));

    const loss = rowOf('Renda fixa');
    expect(loss).toHaveAttribute('data-trend', 'negative');
    // O sinal de menos continua no texto: a cor não é o único indicador.
    expect(loss.querySelector('strong')?.textContent).toBe(money(-10000));

    const gain = rowOf('Caixinhas');
    expect(gain).not.toHaveAttribute('data-trend');
    expect(gain.querySelector('strong')?.textContent).toBe(`+${money(3000)}`);

    // Sem avaliação, a diferença é indisponível e não fica vermelha.
    const pending = rowOf('Outros');
    expect(pending).not.toHaveAttribute('data-trend');
    expect(pending).toHaveTextContent('Diferença indisponível');
  });

  it('usa tokens vermelhos para o texto e a barra de valor', () => {
    const path = '../../shared/styles/index.css';
    const css = readFileSync(new URL(path, import.meta.url), 'utf8');
    expect(css).toMatch(
      /\[data-trend='negative'\] \.investment-bars__label > strong \{\s*color: var\(--color-error\);/,
    );
    expect(css).toMatch(
      /\[data-trend='negative'\]\s*\.investment-bars__fill:not\(\.investment-bars__fill--cost\) \{\s*background: var\(--color-primary\);/,
    );
  });
});
