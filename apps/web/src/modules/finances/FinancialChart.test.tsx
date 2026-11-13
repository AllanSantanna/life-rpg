import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FinancialChart } from './FinancialChart';
import { emptyRecords, type LifeRecords } from '../records/types';
import { emptyLedger } from './types';
const today = '2026-11-13';
afterEach(cleanup);
function showWealth() {
  fireEvent.click(screen.getByRole('button', { name: 'Patrimônio total' }));
}
function records(): LifeRecords {
  return {
    ...emptyRecords(),
    finance: {
      ...emptyLedger(),
      accounts: [
        {
          id: 'principal',
          name: 'Conta',
          initialCents: 100000,
          date: '2026-01-01',
        },
      ],
    },
    movements: [
      {
        id: 'old',
        kind: 'income',
        description: 'Receita',
        category: 'Geral',
        amountCents: 10000,
        date: '2026-10-20',
      },
      {
        id: 'new',
        kind: 'expense',
        description: 'Despesa',
        category: 'Geral',
        amountCents: 5000,
        date: '2026-11-12',
      },
      {
        id: 'last',
        kind: 'income',
        description: 'Receita',
        category: 'Geral',
        amountCents: 15000,
        date: today,
      },
    ],
  };
}
describe('Evolução financeira automática', () => {
  it('seleciona patrimônio mensal e permite alternar os três períodos imediatamente', () => {
    render(<FinancialChart records={records()} today={today} />);
    showWealth();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mensal' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('img')).toHaveAccessibleName(/3 pontos/);
    fireEvent.click(screen.getByRole('button', { name: 'Semanal' }));
    expect(screen.getByRole('button', { name: 'Mensal' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('img')).toHaveAccessibleName(/2 pontos/);
    fireEvent.click(screen.getByRole('button', { name: 'Anual' }));
    expect(screen.getByRole('img')).toHaveAccessibleName(/4 pontos/);
    expect(
      screen.getByText(/Não representa rentabilidade/),
    ).toBeInTheDocument();
  });
  it('mostra estado vazio sem inventar pontos ou valores', () => {
    render(<FinancialChart records={emptyRecords()} today={today} />);
    expect(screen.getByText('Seu histórico começa aqui')).toBeInTheDocument();
    expect(screen.getByText(/Cadastre o saldo inicial/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Saldo inicial pendente')).toBeInTheDocument();
  });
  it('centraliza um único ponto sem desenhar linha ou área fictícias', () => {
    const state = records();
    state.movements = [];
    state.finance!.accounts[0]!.date = today;
    const { container } = render(
      <FinancialChart records={state} today={today} />,
    );
    expect(screen.getByRole('img')).toHaveAccessibleName(/1 ponto\./);
    expect(
      screen.getByText(/histórico ainda está sendo construído/),
    ).toBeInTheDocument();
    expect(container.querySelector('.wealth-chart__line')).toBeNull();
    const dot = container.querySelector('.wealth-chart__dot');
    expect(dot).toHaveAttribute('cx', '391');
    expect(screen.getByText('Sem comparação no período')).toBeInTheDocument();
  });
  it('abre detalhes por foco, toque e mouse sem tabela e navega pelo teclado', () => {
    render(<FinancialChart records={records()} today={today} />);
    showWealth();
    const points = within(
      screen.getByRole('group', { name: 'Pontos do patrimônio' }),
    ).getAllByRole('button');
    fireEvent.click(points[0]!);
    expect(screen.getByRole('tooltip')).toHaveTextContent('20/10/2026');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Disponível');
    fireEvent.focus(points[0]!);
    fireEvent.keyDown(points[0]!, { key: 'ArrowRight' });
    expect(points[1]).toHaveFocus();
    expect(screen.getByRole('tooltip')).toHaveTextContent('12/11/2026');
    fireEvent.keyDown(points[1]!, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.mouseMove(screen.getByRole('img').parentElement!, {
      clientX: 700,
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('13/11/2026');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('recalcula os pontos após edição e exclusão sem reabrir o gráfico', () => {
    const state = records();
    const view = render(<FinancialChart records={state} today={today} />);
    showWealth();
    expect(screen.getByText(/R\$\s1\.200,00/)).toBeInTheDocument();
    const edited = {
      ...state,
      movements: state.movements.filter((item) => item.id !== 'last'),
    };
    view.rerender(<FinancialChart records={edited} today={today} />);
    expect(screen.getByText(/R\$\s1\.050,00/)).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName(/2 pontos/);
  });
  it('distingue período sem eventos e informa estimativas pelo custo', () => {
    const state = records();
    state.movements = [];
    state.investments = [{ id: 'a', name: 'Ação', category: 'Ações' }];
    state.investmentEntries = [
      {
        id: 'buy',
        investmentId: 'a',
        kind: 'contribution',
        amountCents: 5000,
        date: '2026-01-02',
      },
    ];
    render(<FinancialChart records={state} today={today} />);
    showWealth();
    expect(
      screen.getByText('Nenhum registro neste período'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Estimativa parcial/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Anual' }));
    expect(screen.getByRole('img')).toHaveAccessibleName(/2 pontos/);
  });
});
