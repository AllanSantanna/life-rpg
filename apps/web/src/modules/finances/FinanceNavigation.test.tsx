import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
  type PlayerState,
} from '../../app/playerState';
import { financeTab, movementHistory } from '../../test/finances';
import { selectDate, selectOption } from '../../test/selectOption';
import { money } from './calculations';
import { categoryBreakdown } from './categoryBreakdown';
import { valuationBasis } from './ledger';
import { emptyLedger } from './types';

/**
 * Navegação em duas abas (Carteira | Investimentos), data automática e
 * aporte/retirada pela ação rápida. Dados sintéticos.
 */
afterEach(cleanup);
const today = '2026-11-13';
const stored = (): PlayerState =>
  JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data;
function open(state: PlayerState) {
  localStorage.setItem(
    PLAYER_STORAGE_KEY,
    JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: state }),
  );
  window.history.replaceState(null, '', '/financas');
  return render(<App />);
}
function figure(region: string, label: string) {
  return within(screen.getByRole('region', { name: region })).getByText(label)
    .nextElementSibling?.textContent;
}

describe('Finanças em duas abas', () => {
  it('preenche a data de hoje (local) e preserva a data original na edição', () => {
    const state = createInitialPlayerState();
    state.records.movements = [
      {
        id: 'old',
        kind: 'expense',
        description: 'Conta antiga',
        category: 'Casa',
        amountCents: 4000,
        date: '2026-11-02',
      },
    ];
    open(state);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar receita' }));
    let form = screen.getByRole('form', { name: 'Nova movimentação' });
    expect(
      within(form).getByRole('combobox', { name: 'Data' }),
    ).toHaveTextContent('13/11/2026');
    // A data pode ser alterada manualmente.
    selectDate(
      within(form).getByRole('combobox', { name: 'Data' }),
      '2026-11-10',
    );
    fireEvent.change(within(form).getByLabelText('Descrição'), {
      target: { value: 'Freela' },
    });
    fireEvent.change(within(form).getByLabelText('Valor (R$)'), {
      target: { value: '9000' },
    });
    fireEvent.click(
      within(form).getByRole('button', { name: 'Adicionar movimentação' }),
    );
    expect(stored().records.movements[1]).toMatchObject({
      kind: 'income',
      date: '2026-11-10',
    });
    fireEvent.click(
      within(movementHistory()).getByRole('button', {
        name: 'Editar Conta antiga',
      }),
    );
    form = screen.getByRole('form', { name: 'Editar movimentação' });
    expect(
      within(form).getByRole('combobox', { name: 'Data' }),
    ).toHaveTextContent('02/11/2026');
    fireEvent.change(within(form).getByLabelText('Valor (R$)'), {
      target: { value: '4500' },
    });
    fireEvent.click(
      within(form).getByRole('button', { name: 'Salvar movimentação' }),
    );
    expect(stored().records.movements[0]).toEqual({
      ...state.records.movements[0],
      amountCents: 4500,
    });
    expect(figure('Visão geral financeira', 'Saldo disponível')).toBe(
      money(4500),
    );
  });

  it('usuário novo cadastra o primeiro investimento direto na aba Investimentos', () => {
    open(createInitialPlayerState());
    financeTab('Investimentos');
    expect(
      screen.queryByRole('button', { name: 'Aporte / Retirada' }),
    ).not.toBeInTheDocument();
    expect(
      within(
        screen.getByRole('region', { name: 'Meus investimentos' }),
      ).getByText(/Nenhum investimento cadastrado/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Novo investimento' }));
    expect(
      screen.getByRole('form', { name: 'Cadastrar investimento' }),
    ).toBeInTheDocument();
  });

  it('registra aporte e retirada pela ação rápida, mantendo saldo e patrimônio coerentes', () => {
    const state = createInitialPlayerState();
    state.records.finance = emptyLedger();
    state.records.movements = [
      {
        id: 'salary',
        kind: 'income',
        description: 'Salário',
        category: 'Trabalho',
        amountCents: 100000,
        date: today,
      },
    ];
    state.records.investments = [
      { id: 'cdb', name: 'CDB sintético', category: 'Renda fixa' },
      { id: 'other', name: 'Outro ativo', category: 'Outros' },
    ];
    open(state);
    financeTab('Investimentos');
    const wealthBefore = figure(
      'Visão geral dos investimentos',
      'Patrimônio financeiro total',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Aporte / Retirada' }));
    let form = screen.getByRole('form', { name: 'Aporte ou retirada' });
    selectOption(
      within(form).getByRole('combobox', { name: 'Investimento' }),
      'CDB sintético',
    );
    fireEvent.change(within(form).getByLabelText('Valor da operação (R$)'), {
      target: { value: '30000' },
    });
    fireEvent.click(
      within(form).getByRole('button', { name: 'Registrar operação' }),
    );
    expect(stored().records.investmentEntries[0]).toMatchObject({
      investmentId: 'cdb',
      kind: 'contribution',
      amountCents: 30000,
      date: today,
    });
    expect(stored().records.investmentEntries[0]).not.toHaveProperty(
      'accountId',
    );
    // O dinheiro sai do saldo e entra no investimento: patrimônio inalterado.
    expect(
      figure('Visão geral dos investimentos', 'Patrimônio financeiro total'),
    ).toBe(wealthBefore);
    expect(
      figure('Visão geral dos investimentos', 'Valor dos investimentos'),
    ).toBe(money(30000));
    fireEvent.click(screen.getByRole('button', { name: 'Aporte / Retirada' }));
    form = screen.getByRole('form', { name: 'Aporte ou retirada' });
    selectOption(
      within(form).getByRole('combobox', { name: 'Investimento' }),
      'CDB sintético',
    );
    selectOption(
      within(form).getByRole('combobox', { name: 'Operação' }),
      'Retirada / venda',
    );
    fireEvent.change(within(form).getByLabelText('Valor da operação (R$)'), {
      target: { value: '10000' },
    });
    fireEvent.click(
      within(form).getByRole('button', { name: 'Registrar operação' }),
    );
    expect(stored().records.investmentEntries).toHaveLength(2);
    expect(
      figure('Visão geral dos investimentos', 'Resgates e retiradas'),
    ).toBe(money(10000));
    financeTab('Carteira');
    expect(figure('Visão geral financeira', 'Saldo disponível')).toBe(
      money(80000),
    );
    // Aportes não viram despesas do mês.
    expect(figure('Visão geral financeira', 'Despesas do mês')).toBe(money(0));
    expect(stored().records.movements).toEqual(state.records.movements);
  });

  it('alterna entre evolução, distribuição e custo × valor somente com valores registrados', () => {
    const state = createInitialPlayerState();
    state.records.investments = [
      { id: 'cdb', name: 'CDB sintético', category: 'Renda fixa' },
      { id: 'misc', name: 'Outro sintético', category: 'Outros' },
    ];
    state.records.investmentEntries = [
      {
        id: 'cdb-buy',
        investmentId: 'cdb',
        kind: 'contribution',
        amountCents: 30000,
        date: '2026-11-01',
      },
      {
        id: 'misc-buy',
        investmentId: 'misc',
        kind: 'contribution',
        amountCents: 10000,
        date: '2026-11-02',
      },
    ];
    state.records.finance = {
      ...emptyLedger(),
      valuations: [
        {
          id: 'cdb-value',
          investmentId: 'cdb',
          amountCents: 33000,
          date: '2026-11-10',
          basis: valuationBasis(
            state.records.investmentEntries,
            'cdb',
            '2026-11-10',
          ),
        },
      ],
    };
    // Modelo: valor avaliado no CDB; custo como referência em Outros.
    expect(categoryBreakdown(state.records, today)).toEqual([
      expect.objectContaining({
        category: 'Renda fixa',
        value: 33000,
        cost: 30000,
        reference: false,
        share: 33000 / 43000,
      }),
      expect.objectContaining({
        category: 'Outros',
        value: 10000,
        cost: 10000,
        reference: true,
        share: 10000 / 43000,
      }),
    ]);
    open(state);
    financeTab('Investimentos');
    const types = within(
      screen.getByRole('group', { name: 'Tipo de gráfico de investimentos' }),
    );
    expect(types.getByRole('button', { name: 'Evolução' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByRole('region', { name: 'Evolução financeira' }),
    ).toBeInTheDocument();
    fireEvent.click(types.getByRole('button', { name: 'Distribuição' }));
    expect(types.getByRole('button', { name: 'Distribuição' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.queryByRole('region', { name: 'Evolução financeira' }),
    ).not.toBeInTheDocument();
    const charts = screen.getByRole('region', {
      name: 'Gráficos de investimentos',
    });
    expect(charts).toHaveTextContent('76,7%');
    expect(charts).toHaveTextContent('23,3%');
    expect(charts).toHaveTextContent('Valor de referência pelo custo');
    fireEvent.click(types.getByRole('button', { name: 'Custo × valor' }));
    // Diferença só com valor avaliado; sem chamar de rentabilidade.
    expect(charts.textContent).toContain(`+${money(3000)}`);
    expect(charts).toHaveTextContent('Diferença indisponível');
    fireEvent.click(
      within(charts).getByRole('button', {
        name: 'Ajuda sobre gráficos de investimentos',
      }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Gráficos de investimentos' }),
    ).toHaveTextContent('não é rentabilidade');
    expect(stored().records).toEqual(state.records);
  });
});
