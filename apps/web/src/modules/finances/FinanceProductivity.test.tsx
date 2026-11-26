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
import {
  cardAction,
  confirmDeletion,
  financeTab,
  movementHistory,
  newMovementForm,
} from '../../test/finances';
import { selectOption } from '../../test/selectOption';
import { recordReward } from '../records/progression';
import { money } from './calculations';
import { financialSummary } from './ledger';
import type { MoneyMovement } from './types';

/**
 * Produtividade, recorrências, orçamento e vínculo com a Carteira pela
 * interface. Dados sintéticos; a data dos testes é 13/11/2026.
 */
afterEach(cleanup);
const today = '2026-11-13';
const stored = (): PlayerState =>
  JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data;
const movement = (
  id: string,
  kind: MoneyMovement['kind'],
  description: string,
  amountCents: number,
  category: string,
  date: string,
): MoneyMovement => ({ id, kind, description, amountCents, category, date });
function seed(records: Partial<PlayerState['records']> = {}) {
  const state = createInitialPlayerState();
  state.records = { ...state.records, ...records };
  localStorage.setItem(
    PLAYER_STORAGE_KEY,
    JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: state }),
  );
  window.history.replaceState(null, '', '/financas');
  return render(<App />);
}
const history = [
  movement('m1', 'income', 'Salário novembro', 300000, 'Salário', '2026-11-05'),
  movement(
    'm2',
    'expense',
    'Padaria São João',
    2350,
    'Alimentação',
    '2026-11-06',
  ),
  movement('m3', 'expense', 'Uber centro', 3100, 'Transporte', '2026-11-08'),
  movement('m4', 'expense', 'Mensalidade', 9000, 'Academia', '2026-11-10'),
  movement('m5', 'expense', 'Mercado', 48000, 'Alimentação', '2026-11-12'),
  movement('m6', 'expense', 'Cinema', 4000, 'Lazer', '2026-10-20'),
  movement('m7', 'expense', 'Farmácia', 3000, 'Saúde', '2026-11-01'),
  movement('m8', 'expense', 'Presente', 7000, 'Presentes', '2026-11-02'),
  movement('m9', 'income', 'Freela', 50000, 'Trabalho extra', '2026-11-03'),
];
function fill(form: HTMLElement, label: string, value: string) {
  fireEvent.change(within(form).getByLabelText(label), { target: { value } });
}
/** Valor ISO do seletor de data (campo oculto enviado no formulário). */
const dateValue = (form: HTMLElement) =>
  form.querySelector<HTMLInputElement>('input[name="date"]')?.value;
/** Texto normalizado como a Testing Library (espaço rígido vira espaço). */
const plain = (text: string) => text.replace(/\u00a0/g, ' ');
function figure(label: string) {
  const overview = screen.getByRole('region', {
    name: 'Visão geral financeira',
  });
  return within(overview).getByText(label).nextElementSibling?.textContent;
}

describe('Repetir movimentação', () => {
  it('abre uma nova receita preenchida, com data de hoje e novo ID', () => {
    seed({ movements: history });
    const list = movementHistory();
    fireEvent.click(
      within(list).getByRole('button', { name: 'Repetir Salário novembro' }),
    );
    // Nada é gravado ao clicar em Repetir.
    expect(stored().records.movements).toHaveLength(history.length);
    const form = screen.getByRole('form', { name: 'Nova movimentação' });
    expect(
      within(form).getByRole('combobox', { name: 'Tipo de movimentação' }),
    ).toHaveTextContent('Receita');
    expect(within(form).getByLabelText('Descrição')).toHaveValue(
      'Salário novembro',
    );
    expect(within(form).getByLabelText('Valor (R$)')).toHaveValue(
      money(300000),
    );
    expect(
      within(form).getByLabelText('Categoria da movimentação'),
    ).toHaveValue('Salário');
    expect(dateValue(form)).toBe(today);
    fill(form, 'Descrição', 'Salário dezembro');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Adicionar movimentação' }),
    );
    const saved = stored().records.movements;
    expect(saved).toHaveLength(history.length + 1);
    const created = saved.at(-1)!;
    expect(created).toMatchObject({
      kind: 'income',
      description: 'Salário dezembro',
      amountCents: 300000,
      category: 'Salário',
      date: today,
    });
    expect(created.id).not.toBe('m1');
    expect(created).not.toHaveProperty('recurrence');
    expect(created).not.toHaveProperty('accountId');
    // O original permanece intacto.
    expect(saved.find((item) => item.id === 'm1')).toEqual(history[0]);
  });

  it('repete uma despesa e cancela sem salvar nem conceder XP', () => {
    seed({ movements: history });
    const reward = recordReward(stored().records, [], today);
    const list = movementHistory();
    fireEvent.click(
      within(list).getByRole('button', { name: 'Repetir Uber centro' }),
    );
    const form = screen.getByRole('form', { name: 'Nova movimentação' });
    expect(
      within(form).getByRole('combobox', { name: 'Tipo de movimentação' }),
    ).toHaveTextContent('Despesa');
    fireEvent.click(within(form).getByRole('button', { name: 'Cancelar' }));
    expect(
      screen.queryByRole('form', { name: 'Nova movimentação' }),
    ).toBeNull();
    expect(stored().records.movements).toEqual(history);
    expect(recordReward(stored().records, [], today)).toBe(reward);
  });

  it('não oferece Repetir para movimentos internos de investimentos', () => {
    seed({
      movements: history,
      investments: [{ id: 'cdb', name: 'CDB', category: 'Renda fixa' }],
      investmentEntries: [
        {
          id: 'e1',
          investmentId: 'cdb',
          kind: 'contribution',
          amountCents: 10000,
          date: '2026-11-09',
          positionInitial: false,
          walletLinked: true,
        },
      ],
    });
    const list = movementHistory();
    fireEvent.click(within(list).getByRole('button', { name: 'Internas' }));
    expect(within(list).getByText('Aporte em CDB')).toBeInTheDocument();
    expect(within(list).getByText(/Saída da Carteira/)).toBeInTheDocument();
    expect(within(list).queryByRole('button', { name: /Repetir/ })).toBeNull();
    expect(within(list).queryByRole('button', { name: /Editar/ })).toBeNull();
  });
});

describe('Categorias recentes', () => {
  it('prioriza até cinco categorias recentes do tipo, sem repetir', () => {
    seed({ movements: history });
    const form = newMovementForm('expense');
    const recent = within(form).getByRole('group', {
      name: 'Categorias recentes de despesas',
    });
    expect(
      within(recent)
        .getAllByRole('button')
        .map((item) => item.textContent),
    ).toEqual(['Alimentação', 'Academia', 'Transporte', 'Presentes', 'Saúde']);
    const all = within(form).getByRole('combobox', {
      name: 'Todas as categorias',
    });
    fireEvent.click(all);
    const options = screen
      .getAllByRole('option')
      .map((item) => item.textContent);
    expect(options).toEqual(
      expect.arrayContaining(['Lazer', 'Salário', 'Trabalho extra', 'Geral']),
    );
    expect(options).not.toContain('Alimentação');
    fireEvent.click(screen.getByRole('option', { name: 'Lazer' }));
    expect(
      within(form).getByLabelText('Categoria da movimentação'),
    ).toHaveValue('Lazer');
    fireEvent.click(within(recent).getByRole('button', { name: 'Academia' }));
    expect(
      within(form).getByLabelText('Categoria da movimentação'),
    ).toHaveValue('Academia');
    expect(
      within(recent).getByRole('button', { name: 'Academia' }),
    ).toHaveAttribute('aria-pressed', 'true');
    // Receitas priorizam as categorias de receitas.
    selectOption(
      within(form).getByRole('combobox', { name: 'Tipo de movimentação' }),
      'Receita',
    );
    const income = within(form).getByRole('group', {
      name: 'Categorias recentes de receitas',
    });
    expect(
      within(income)
        .getAllByRole('button')
        .map((item) => item.textContent),
    ).toEqual(['Salário', 'Trabalho extra']);
  });

  it('preserva categorias personalizadas digitadas', () => {
    seed({ movements: history });
    const form = newMovementForm('expense');
    fill(form, 'Descrição', 'Ração');
    fill(form, 'Valor (R$)', '5000');
    fill(form, 'Categoria da movimentação', 'Pet: ração & vet');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Adicionar movimentação' }),
    );
    expect(stored().records.movements.at(-1)!.category).toBe(
      'Pet: ração & vet',
    );
    const next = newMovementForm('expense');
    expect(
      within(
        within(next).getByRole('group', {
          name: 'Categorias recentes de despesas',
        }),
      ).getAllByRole('button')[0],
    ).toHaveTextContent('Pet: ração & vet');
  });
});

describe('Pesquisa rápida', () => {
  it('encontra sem diferenciar acentos e maiúsculas e abre o histórico', () => {
    seed({ movements: history });
    financeTab('Carteira');
    const search = screen.getByRole('searchbox', {
      name: 'Pesquisar no histórico',
    });
    expect(search).toHaveAttribute('placeholder', 'Buscar movimentações...');
    fireEvent.change(search, { target: { value: 'SAO joao' } });
    const list = screen.getByRole('region', {
      name: 'Histórico de movimentações',
    });
    expect(within(list).getByText('Padaria São João')).toBeInTheDocument();
    expect(within(list).queryByText('Mercado')).toBeNull();
    // Categoria também é pesquisável.
    fireEvent.change(search, { target: { value: 'alimentacao' } });
    expect(within(list).getByText('Padaria São João')).toBeInTheDocument();
    expect(within(list).getByText('Mercado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar pesquisa' }));
    expect(search).toHaveValue('');
    expect(within(list).getByText('Uber centro')).toBeInTheDocument();
    // A pesquisa não altera registros.
    expect(stored().records.movements).toEqual(history);
  });

  it('combina pesquisa com tipo, mês e filtros avançados', () => {
    seed({ movements: history });
    financeTab('Carteira');
    const search = screen.getByRole('searchbox', {
      name: 'Pesquisar no histórico',
    });
    fireEvent.change(search, { target: { value: 'a' } });
    const list = screen.getByRole('region', {
      name: 'Histórico de movimentações',
    });
    fireEvent.click(within(list).getByRole('button', { name: 'Receitas' }));
    expect(within(list).getByText('Salário novembro')).toBeInTheDocument();
    expect(within(list).queryByText('Mercado')).toBeNull();
    // Outubro não aparece em novembro.
    fireEvent.click(within(list).getByRole('button', { name: 'Todas' }));
    fireEvent.change(search, { target: { value: 'cinema' } });
    expect(
      within(list).getByText(
        'Nenhuma movimentação encontrada para “cinema” com os filtros selecionados.',
      ),
    ).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'mercado' } });
    fireEvent.click(
      within(list).getByRole('button', { name: 'Filtros avançados' }),
    );
    selectOption(
      within(list).getByRole('combobox', { name: 'Categoria' }),
      'Transporte',
    );
    expect(within(list).queryByText('Mercado')).toBeNull();
    selectOption(
      within(list).getByRole('combobox', { name: 'Categoria' }),
      'Alimentação',
    );
    expect(within(list).getByText('Mercado')).toBeInTheDocument();
  });

  it('informa histórico vazio e pesquisa sem resultados', () => {
    seed();
    financeTab('Carteira');
    const list = movementHistory();
    expect(
      within(list).getByText(/Nenhuma movimentação neste mês/),
    ).toBeInTheDocument();
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Pesquisar no histórico' }),
      { target: { value: 'xyz' } },
    );
    expect(
      screen.getByText(/Nenhuma movimentação encontrada para “xyz”/),
    ).toBeInTheDocument();
  });
});

describe('Ações diretas no investimento', () => {
  const investments = [
    { id: 'cdb', name: 'CDB', category: 'Renda fixa' as const },
    { id: 'reserva', name: 'Reserva', category: 'Outros' as const },
  ];
  const entries = [
    {
      id: 'i1',
      investmentId: 'cdb',
      kind: 'contribution' as const,
      amountCents: 50000,
      date: '2026-10-01',
      positionInitial: true,
    },
    {
      id: 'i2',
      investmentId: 'reserva',
      kind: 'contribution' as const,
      amountCents: 50000,
      date: '2026-10-01',
      positionInitial: true,
    },
  ];

  it('aporta no investimento correto com saldo da Carteira', () => {
    seed({ movements: history, investments, investmentEntries: entries });
    financeTab('Investimentos');
    const form = cardAction('Investimento Reserva', 'Aportar em Reserva');
    expect(form).toHaveAccessibleName('Aportar · Reserva');
    expect(dateValue(form)).toBe(today);
    const toggle = within(form).getByRole('switch', {
      name: 'Utilizar saldo da Carteira',
    });
    expect(toggle).toBeChecked();
    fill(form, 'Valor da operação (R$)', '20000');
    const submit = within(form).getByRole('button', {
      name: 'Registrar operação',
    });
    fireEvent.click(submit);
    fireEvent.click(submit);
    const saved = stored().records.investmentEntries;
    expect(saved).toHaveLength(3);
    expect(saved.at(-1)).toMatchObject({
      investmentId: 'reserva',
      kind: 'contribution',
      amountCents: 20000,
      date: today,
      positionInitial: false,
      walletLinked: true,
    });
    const summary = financialSummary(stored().records, today);
    // R$ 3.500,00 recebidos − R$ 764,50 gastos (todo o histórico) − R$ 200,00.
    expect(summary.cash).toBe(350000 - 76450 - 20000);
  });

  it('retira do investimento correto e envia o valor para a Carteira', () => {
    seed({ movements: history, investments, investmentEntries: entries });
    financeTab('Investimentos');
    const form = cardAction('Investimento CDB', 'Resgatar CDB');
    const toggle = within(form).getByRole('switch', {
      name: 'Enviar valor para a Carteira',
    });
    expect(toggle).toBeChecked();
    fill(form, 'Valor da operação (R$)', '10000');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Registrar operação' }),
    );
    expect(stored().records.investmentEntries.at(-1)).toMatchObject({
      investmentId: 'cdb',
      kind: 'withdrawal',
      amountCents: 10000,
      walletLinked: true,
    });
    // Não vira receita mensal.
    financeTab('Carteira');
    expect(figure('Receitas do mês')).toBe(money(350000));
  });

  it('recusa aporte vinculado sem saldo e permite dinheiro externo', () => {
    seed({ investments, investmentEntries: entries });
    financeTab('Investimentos');
    const form = cardAction('Investimento CDB', 'Aportar em CDB');
    fill(form, 'Valor da operação (R$)', '10000');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Registrar operação' }),
    );
    expect(within(form).getByRole('alert')).toHaveTextContent(
      'Saldo insuficiente na Carteira',
    );
    expect(stored().records.investmentEntries).toHaveLength(2);
    fireEvent.click(
      within(form).getByRole('switch', { name: 'Utilizar saldo da Carteira' }),
    );
    fireEvent.click(
      within(form).getByRole('button', { name: 'Registrar operação' }),
    );
    expect(stored().records.investmentEntries.at(-1)).toMatchObject({
      amountCents: 10000,
      walletLinked: false,
    });
    expect(financialSummary(stored().records, today).cash).toBe(0);
  });
});

describe('Recorrências e orçamento pela Carteira', () => {
  it('registra despesa recorrente e confirma a próxima ocorrência uma vez', () => {
    seed({ movements: [history[0]!] });
    const form = newMovementForm('expense');
    fill(form, 'Descrição', 'Internet');
    fill(form, 'Valor (R$)', '12000');
    fill(form, 'Categoria da movimentação', 'Contas fixas');
    fireEvent.click(
      within(form).getByRole('switch', { name: 'Repetir periodicamente' }),
    );
    selectOption(
      within(form).getByRole('combobox', { name: 'Frequência' }),
      'Semanal',
    );
    fireEvent.click(
      within(form).getByRole('button', { name: 'Adicionar movimentação' }),
    );
    let records = stored().records;
    expect(records.finance!.recurrences).toEqual([
      expect.objectContaining({
        description: 'Internet',
        frequency: 'weekly',
        startDate: today,
        status: 'active',
      }),
    ]);
    expect(records.movements).toHaveLength(2);
    expect(figure('Saldo disponível')).toBe(money(288000));
    const upcoming = screen.getByRole('region', {
      name: 'Próximas movimentações',
    });
    expect(within(upcoming).getByText(/vence em 20\/11/)).toBeInTheDocument();
    // A previsão não altera o saldo.
    expect(figure('Saldo disponível')).toBe(money(288000));
    fireEvent.click(
      within(upcoming).getByRole('button', {
        name: 'Confirmar pagamento de Internet, 20/11/2026',
      }),
    );
    const confirm = within(upcoming).getByRole('form', {
      name: 'Confirmar pagamento',
    });
    expect(within(confirm).getByLabelText('Valor (R$)')).toHaveValue(
      money(12000),
    );
    const button = within(confirm).getByRole('button', {
      name: 'Confirmar pagamento',
    });
    fireEvent.click(button);
    fireEvent.click(button);
    records = stored().records;
    expect(records.movements).toHaveLength(3);
    expect(records.movements.at(-1)).toMatchObject({
      date: today,
      recurrence: { date: '2026-11-20' },
    });
    expect(figure('Saldo disponível')).toBe(money(276000));
    expect(within(upcoming).getByText(/vence em 27\/11/)).toBeInTheDocument();
  });

  it('mostra o consumo do orçamento com alerta de 80% e atualiza ao excluir', () => {
    seed({ movements: history });
    const budget = screen.getByRole('region', {
      name: 'Orçamento mensal · 11/2026',
    });
    expect(
      within(budget).getByText(/Nenhum limite definido/),
    ).toBeInTheDocument();
    fireEvent.click(
      within(budget).getByRole('button', { name: 'Definir limite' }),
    );
    const form = within(budget).getByRole('form', { name: 'Definir limite' });
    fill(form, 'Categoria de despesa', 'Alimentação');
    fill(form, 'Limite mensal (R$)', '60000');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Adicionar limite' }),
    );
    expect(stored().records.finance!.budgets).toEqual([
      expect.objectContaining({
        category: 'Alimentação',
        limitCents: 60000,
        from: '2026-11',
      }),
    ]);
    expect(
      within(budget).getByText(
        plain(`${money(50350)} de ${money(60000)} utilizados · 83%`),
      ),
    ).toBeInTheDocument();
    expect(within(budget).getByText(/Atenção: 80%/)).toBeInTheDocument();
    expect(within(budget).getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '50350',
    );
    const list = movementHistory();
    fireEvent.click(
      within(list).getByRole('button', { name: 'Excluir Mercado' }),
    );
    confirmDeletion();
    expect(
      within(budget).getByText(
        plain(`${money(2350)} de ${money(60000)} utilizados · 3%`),
      ),
    ).toBeInTheDocument();
    expect(within(budget).getByText(/Dentro do limite/)).toBeInTheDocument();
  });
});
