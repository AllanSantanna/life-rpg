import { selectDate, selectOption } from '../../test/selectOption';
import {
  cardAction,
  cardDetails,
  cardMenuAction,
  confirmDeletion,
  financeTab,
  investmentCard,
  investmentHistory,
  movementHistory,
  newMovementForm,
} from '../../test/finances';
import { fetchBitcoinQuote } from './bitcoinQuote';
vi.mock('./bitcoinQuote', async (original) => ({
  ...(await original<typeof import('./bitcoinQuote')>()),
  fetchBitcoinQuote: vi.fn(),
}));
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import {
  createDemoPlayerState,
  PLAYER_STORAGE_KEY,
} from '../../app/playerState';
import { financialSummary, investmentValue, valuationBasis } from './ledger';
import { emptyLedger } from './types';

afterEach(cleanup);
const today = '2026-11-13';
const quote = {
  priceCents: 39000000,
  updatedAt: new Date(2026, 10, 13, 11, 30).getTime(),
  observedAt: new Date(2026, 10, 13, 11, 45).getTime(),
};
function seed() {
  const state = createDemoPlayerState();
  state.records.finance = {
    ...emptyLedger(),
    accounts: [
      {
        id: 'principal',
        name: 'Conta corrente',
        initialCents: 100000,
        date: '2026-01-01',
      },
      {
        id: 'other',
        name: 'Conta reserva',
        initialCents: 0,
        date: '2026-01-01',
      },
    ],
    valuations: [
      { id: 'v', investmentId: 'box', amountCents: 81078, date: '2026-11-10' },
    ],
    quotes: [quote],
  };
  state.records.investments = [
    {
      id: 'box',
      name: 'Caixa Itaú',
      category: 'Caixinhas bancárias',
      institution: 'Itaú',
    },
    { id: 'btc', name: 'Bitcoin (BTC)', category: 'Bitcoin' },
    { id: 'fii', name: 'Fundo XP', category: 'Fundos imobiliários' },
  ];
  state.records.investmentEntries = [
    {
      id: 'box-initial',
      investmentId: 'box',
      kind: 'contribution',
      amountCents: 80000,
      date: '2026-11-01',
      positionInitial: true,
    },
    {
      id: 'btc-initial',
      investmentId: 'btc',
      kind: 'contribution',
      amountCents: 23954,
      quantity: 0.00061258,
      date: '2026-11-01',
      positionInitial: true,
    },
    {
      id: 'fii-initial',
      investmentId: 'fii',
      kind: 'contribution',
      amountCents: 50000,
      date: '2026-11-01',
      positionInitial: true,
    },
  ];
  state.records.movements = [
    {
      id: 'm1',
      kind: 'income',
      description: 'Salário',
      amountCents: 300000,
      category: 'Trabalho',
      date: '2026-11-05',
      accountId: 'principal',
    },
    {
      id: 'm2',
      kind: 'expense',
      description: 'Mercado',
      amountCents: 20000,
      category: 'Casa',
      date: '2026-11-08',
      accountId: 'principal',
    },
    {
      id: 'm3',
      kind: 'expense',
      description: 'Cinema',
      amountCents: 5000,
      category: 'Lazer',
      date: '2026-11-09',
      accountId: 'other',
    },
  ];
  // Assinatura gravada por `saveValuation`, como nos registros reais.
  state.records.finance.valuations[0]!.basis = valuationBasis(
    state.records.investmentEntries,
    'box',
    '2026-11-10',
  );
  localStorage.setItem(
    PLAYER_STORAGE_KEY,
    JSON.stringify({ version: 2, data: state }),
  );
  window.history.replaceState(null, '', '/financas');
  vi.mocked(fetchBitcoinQuote).mockResolvedValue(quote);
  return state;
}
function stored() {
  return JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data.records;
}
const summary = () => financialSummary(stored(), today);
function input(form: HTMLElement, label: string, value: string) {
  const control = within(form).getByLabelText(label);
  if (control.getAttribute('aria-haspopup') === 'dialog') {
    selectDate(control, value);
    return;
  }
  if (control.getAttribute('role') === 'combobox') {
    selectOption(control, value);
    return;
  }
  fireEvent.change(control, { target: { value } });
}
function submit(form: HTMLElement, name = 'Registrar operação') {
  fireEvent.click(within(form).getByRole('button', { name }));
}

describe('Organização da página Finanças', () => {
  it('mantém a visão geral, abre áreas por abas e não exibe formulários nem históricos abertos', async () => {
    const state = seed();
    render(<App />);
    expect(
      screen.getByRole('region', { name: 'Visão geral financeira' }),
    ).toHaveTextContent('Dinheiro disponível');
    expect(
      screen.getByRole('region', { name: 'Evolução financeira' }),
    ).toBeInTheDocument();
    const movements = screen.getByRole('tab', { name: 'Movimentações' });
    expect(movements).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryAllByRole('form')).toHaveLength(
      // Somente os formulários de contas, recolhidos em “Contas...”.
      screen.queryAllByRole('form').filter((item) => item.closest('details'))
        .length,
    );
    const history = screen.getByRole('button', {
      name: 'Histórico de movimentações',
    });
    expect(history).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Mercado')).not.toBeInTheDocument();
    movements.focus();
    fireEvent.keyDown(movements, { key: 'ArrowRight' });
    const investments = screen.getByRole('tab', { name: 'Investimentos' });
    expect(investments).toHaveAttribute('aria-selected', 'true');
    expect(investments).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Investimentos');
    expect(
      screen.queryByRole('form', { name: 'Cadastrar investimento' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Histórico de investimentos' }),
    ).toHaveAttribute('aria-expanded', 'false');
    fireEvent.keyDown(investments, { key: 'Home' });
    expect(movements).toHaveFocus();
    fireEvent.keyDown(movements, { key: 'End' });
    expect(investments).toHaveFocus();
    await act(async () => {
      await Promise.resolve();
    });
    expect(stored()).toEqual(state.records);
  });

  it('abre e cancela a nova movimentação sem alterar dados, devolvendo o foco', () => {
    const state = seed();
    render(<App />);
    const opener = screen.getByRole('button', { name: 'Nova movimentação' });
    opener.focus();
    const form = newMovementForm();
    expect(
      within(form).getByRole('combobox', { name: 'Tipo de movimentação' }),
    ).toHaveFocus();
    input(form, 'Descrição', 'Rascunho');
    fireEvent.click(within(form).getByRole('button', { name: 'Cancelar' }));
    expect(
      screen.queryByRole('form', { name: 'Nova movimentação' }),
    ).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(stored().movements).toEqual(state.records.movements);
  });

  it('salva uma movimentação uma única vez, fecha o formulário e atualiza os indicadores', () => {
    seed();
    render(<App />);
    const before = summary().cash!;
    const form = newMovementForm();
    input(form, 'Tipo de movimentação', 'Receita');
    input(form, 'Descrição', 'Freelance');
    input(form, 'Valor (R$)', '150,00');
    const button = within(form).getByRole('button', {
      name: 'Adicionar movimentação',
    });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(stored().movements).toHaveLength(4);
    expect(summary().cash).toBe(before + 15000);
    expect(
      screen.queryByRole('form', { name: 'Nova movimentação' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Visão geral financeira' }),
    ).toHaveTextContent('R$ 3.150,00');
  });

  it('expande, filtra e recolhe o histórico de movimentações sem modificar registros', () => {
    const state = seed();
    render(<App />);
    const history = movementHistory();
    expect(history).toHaveTextContent('3 movimentações');
    expect(history).toHaveTextContent('Mercado');
    input(history, 'Tipo', 'Receitas');
    expect(history).toHaveTextContent('1 movimentação');
    expect(history).not.toHaveTextContent('Mercado');
    input(history, 'Tipo', 'Despesas');
    input(history, 'Conta', 'Conta reserva');
    expect(history).toHaveTextContent('Cinema');
    expect(history).not.toHaveTextContent('Mercado');
    input(history, 'Conta', 'Todas as contas');
    input(history, 'Categoria', 'Casa');
    expect(history).toHaveTextContent('Mercado');
    expect(history).not.toHaveTextContent('Cinema');
    input(history, 'Mês do histórico', '2026-10');
    expect(history).toHaveTextContent('Nenhuma movimentação neste mês.');
    expect(
      screen.getByRole('combobox', { name: 'Mês financeiro' }),
    ).toHaveTextContent('10/2026');
    fireEvent.click(
      screen.getByRole('button', { name: 'Histórico de movimentações' }),
    );
    expect(
      screen.getByRole('button', { name: 'Histórico de movimentações' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Mercado')).not.toBeInTheDocument();
    expect(stored()).toEqual(state.records);
  });

  it('exige confirmação para excluir movimentações e preserva os dados ao cancelar', () => {
    const state = seed();
    render(<App />);
    movementHistory();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Mercado' }));
    const dialog = screen.getByRole('dialog', { name: 'Excluir movimentação' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(stored().movements).toEqual(state.records.movements);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Mercado' }));
    confirmDeletion();
    expect(stored().movements.map((item: { id: string }) => item.id)).toEqual([
      'm1',
      'm3',
    ]);
  });

  it('aporta na caixinha pelo cartão: debita a conta, aumenta a posição e preserva o patrimônio', () => {
    seed();
    render(<App />);
    const before = summary();
    const form = cardAction('Caixinha Caixa Itaú', 'Aportar em Caixa Itaú');
    expect(form).toHaveAccessibleName('Aportar · Caixa Itaú');
    expect(
      within(form).queryByRole('combobox', { name: 'Operação' }),
    ).not.toBeInTheDocument();
    expect(
      within(form).queryByRole('combobox', { name: 'Investimento' }),
    ).not.toBeInTheDocument();
    expect(
      within(form).getByRole('combobox', {
        name: 'Tipo de registro do investimento',
      }),
    ).toHaveTextContent('Nova compra ou aporte');
    expect(
      within(form).getByRole('combobox', { name: 'Conta' }),
    ).toHaveTextContent('Conta corrente');
    input(form, 'Valor da operação (R$)', '100,00');
    const button = within(form).getByRole('button', {
      name: 'Registrar operação',
    });
    fireEvent.click(button);
    fireEvent.click(button);
    const records = stored();
    expect(records.investmentEntries).toHaveLength(4);
    expect(records.investmentEntries[3]).toMatchObject({
      investmentId: 'box',
      kind: 'contribution',
      positionInitial: false,
      amountCents: 10000,
      accountId: 'principal',
      date: today,
    });
    expect(records.investments).toHaveLength(3);
    expect(records.movements).toHaveLength(3);
    const after = summary();
    expect(after.cash).toBe(before.cash! - 10000);
    expect(after.investments).toBe(before.investments + 10000);
    expect(after.wealth).toBe(before.wealth);
    expect(investmentValue(records, 'box', today).current).toBe(91078);
    expect(investmentCard('Caixinha Caixa Itaú')).toHaveTextContent(
      'R$ 910,78',
    );
    expect(
      within(investmentCard('Caixinha Caixa Itaú')).queryByRole('form'),
    ).not.toBeInTheDocument();
  });

  it('retira da caixinha creditando a conta escolhida e atualiza o saldo manual sem movimentar contas', () => {
    seed();
    render(<App />);
    const before = summary();
    let form = cardAction('Caixinha Caixa Itaú', 'Retirar de Caixa Itaú');
    expect(form).toHaveAccessibleName('Retirar · Caixa Itaú');
    input(form, 'Valor da operação (R$)', '50,00');
    input(form, 'Conta', 'Conta reserva');
    submit(form);
    expect(stored().investmentEntries[3]).toMatchObject({
      kind: 'withdrawal',
      amountCents: 5000,
      accountId: 'other',
    });
    expect(summary().cash).toBe(before.cash! + 5000);
    expect(summary().wealth).toBe(before.wealth);
    const entries = stored().investmentEntries;
    const cash = summary().cash;
    form = cardAction('Caixinha Caixa Itaú', 'Atualizar saldo de Caixa Itaú');
    input(form, 'Saldo atual exibido pelo banco (R$)', '770,00');
    submit(form, 'Salvar saldo');
    expect(stored().investmentEntries).toEqual(entries);
    expect(stored().movements).toHaveLength(3);
    expect(summary().cash).toBe(cash);
    const card = investmentCard('Caixinha Caixa Itaú');
    expect(card).toHaveTextContent('R$ 770,00');
    expect(card).toHaveTextContent('Saldo atualizado sem movimentar a conta');
    expect(card).toHaveTextContent(/Custo da posição\s*R\$ 750,00/);
  });

  it('compra mais e vende Bitcoin pelo cartão, sem criar outro investimento nem receita', () => {
    seed();
    render(<App />);
    const before = summary();
    let form = cardAction(
      'Investimento Bitcoin (BTC)',
      'Comprar mais Bitcoin (BTC)',
    );
    expect(form).toHaveAccessibleName('Comprar mais · Bitcoin (BTC)');
    input(form, 'Valor da operação (R$)', '50,00');
    input(form, 'Quantidade em BTC', '0,00012821');
    submit(form);
    let records = stored();
    expect(records.investments).toHaveLength(3);
    expect(records.investmentEntries[3]).toMatchObject({
      investmentId: 'btc',
      kind: 'contribution',
      positionInitial: false,
      quantity: 0.00012821,
      amountCents: 5000,
    });
    expect(investmentValue(records, 'btc', today)).toMatchObject({
      units: 74079,
      cost: 28954,
    });
    expect(summary().cash).toBe(before.cash! - 5000);
    const card = investmentCard('Investimento Bitcoin (BTC)');
    expect(card).toHaveTextContent('0.00074079 BTC');
    form = cardAction('Investimento Bitcoin (BTC)', 'Vender Bitcoin (BTC)');
    input(form, 'Unidade de Bitcoin', 'Satoshis (sats)');
    input(form, 'Quantidade em sats', '10000');
    input(form, 'Valor da operação (R$)', '40,00');
    submit(form);
    records = stored();
    expect(records.investmentEntries[4]).toMatchObject({
      kind: 'withdrawal',
      quantity: 0.0001,
      amountCents: 4000,
    });
    expect(investmentValue(records, 'btc', today).units).toBe(64079);
    expect(summary().cash).toBe(before.cash! - 1000);
    expect(records.movements).toHaveLength(3);
    expect(card).toHaveTextContent('0.00064079 BTC');
    expect(
      cardDetails('Investimento Bitcoin (BTC)', 'Bitcoin (BTC)'),
    ).toHaveTextContent('Preço médio');
  });

  it('rejeita venda de BTC acima da quantidade disponível sem gravar', () => {
    seed();
    render(<App />);
    const before = stored().investmentEntries;
    const form = cardAction(
      'Investimento Bitcoin (BTC)',
      'Vender Bitcoin (BTC)',
    );
    input(form, 'Quantidade em BTC', '1');
    input(form, 'Valor da operação (R$)', '40,00');
    submit(form);
    expect(within(form).getByRole('alert')).toHaveTextContent(
      'não pode exceder',
    );
    expect(stored().investmentEntries).toEqual(before);
  });

  it('compra e vende FIIs pelo cartão usando quantidade/preço e valor recebido', () => {
    seed();
    render(<App />);
    const before = summary();
    let form = cardAction('Investimento Fundo XP', 'Comprar mais Fundo XP');
    input(form, 'Quantidade (opcional)', '2');
    input(form, 'Preço de compra por unidade (R$, opcional)', '105,50');
    submit(form);
    expect(stored().investmentEntries[3]).toMatchObject({
      investmentId: 'fii',
      quantity: 2,
      purchasePriceCents: 10550,
      amountCents: 21100,
    });
    form = cardAction('Investimento Fundo XP', 'Vender Fundo XP');
    expect(
      within(form).queryByLabelText('Quantidade (opcional)'),
    ).toBeInTheDocument();
    input(form, 'Valor da operação (R$)', '300,00');
    submit(form);
    expect(stored().investmentEntries[4]).toMatchObject({
      kind: 'withdrawal',
      amountCents: 30000,
    });
    expect(summary().cash).toBe(before.cash! - 21100 + 30000);
    expect(investmentCard('Investimento Fundo XP')).toHaveTextContent(
      /Custo da posição\s*R\$ 411,00/,
    );
    expect(stored().movements).toHaveLength(3);
  });

  it('atualiza a cotação respeitando o cache, sem alterar quantidade nem gerar movimentação', async () => {
    seed();
    render(<App />);
    financeTab('Investimentos');
    const entries = stored().investmentEntries;
    const refresh = () =>
      cardMenuAction(
        'Investimento Bitcoin (BTC)',
        'Atualizar cotação de Bitcoin (BTC)',
      );
    refresh();
    await waitFor(() =>
      expect(investmentCard('Investimento Bitcoin (BTC)')).toHaveTextContent(
        'Cotação em cache ainda válida',
      ),
    );
    expect(stored().finance.quotes).toEqual([quote]);
    const fresh = {
      priceCents: 40000000,
      updatedAt: quote.updatedAt + 3600000,
      observedAt: quote.observedAt + 3600000,
    };
    vi.mocked(fetchBitcoinQuote).mockResolvedValue(fresh);
    refresh();
    await waitFor(() =>
      expect(investmentCard('Investimento Bitcoin (BTC)')).toHaveTextContent(
        'Cotação atualizada',
      ),
    );
    expect(stored().finance.quotes.at(-1)).toEqual(fresh);
    expect(investmentCard('Investimento Bitcoin (BTC)')).toHaveTextContent(
      '400.000,00',
    );
    vi.mocked(fetchBitcoinQuote).mockRejectedValue(new Error('offline'));
    refresh();
    await waitFor(() =>
      expect(investmentCard('Investimento Bitcoin (BTC)')).toHaveTextContent(
        'Mantida a última cotação conhecida',
      ),
    );
    expect(stored().finance.quotes.at(-1)).toEqual(fresh);
    expect(stored().investmentEntries).toEqual(entries);
    expect(stored().movements).toHaveLength(3);
  });

  it('filtra o histórico de investimentos e exige confirmação para excluir operações', () => {
    const state = seed();
    render(<App />);
    const history = investmentHistory();
    expect(history).toHaveTextContent('3 operações encontradas');
    input(history, 'Filtrar por categoria', 'Bitcoin');
    expect(history).toHaveTextContent('1 operação encontrada');
    expect(history).toHaveTextContent('Bitcoin (BTC) · Posição inicial');
    input(history, 'Filtrar por categoria', 'Todas as categorias');
    input(history, 'Filtrar por investimento', 'Fundo XP');
    expect(history).toHaveTextContent('Fundo XP · Posição inicial');
    input(history, 'Filtrar por investimento', 'Todos os investimentos');
    input(history, 'Tipo de operação', 'Venda ou retirada');
    expect(history).toHaveTextContent(
      'Nenhuma operação com os filtros selecionados.',
    );
    input(history, 'Tipo de operação', 'Posição inicial');
    input(history, 'Período: de', '2026-11-02');
    expect(history).toHaveTextContent('0 operações encontradas');
    input(history, 'Período: de', '2026-11-01');
    expect(history).toHaveTextContent('3 operações encontradas');
    fireEvent.click(
      within(history).getAllByRole('button', {
        name: /Excluir operação de Fundo XP/,
      })[0]!,
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Cancelar',
      }),
    );
    expect(stored()).toEqual(state.records);
  });

  it('exclui investimento somente após confirmação e preserva tudo após recarga', () => {
    seed();
    const app = render(<App />);
    cardMenuAction(
      'Investimento Fundo XP',
      'Excluir investimento e operações de Fundo XP',
    );
    expect(
      screen.getByRole('dialog', { name: 'Excluir investimento' }),
    ).toHaveTextContent('1 operação será removida');
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Cancelar',
      }),
    );
    expect(stored().investments).toHaveLength(3);
    const form = cardAction('Caixinha Caixa Itaú', 'Aportar em Caixa Itaú');
    input(form, 'Valor da operação (R$)', '10,00');
    submit(form);
    const saved = localStorage.getItem(PLAYER_STORAGE_KEY);
    app.unmount();
    render(<App />);
    expect(investmentCard('Caixinha Caixa Itaú')).toHaveTextContent(
      'R$ 820,78',
    );
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(saved);
    cardMenuAction(
      'Investimento Fundo XP',
      'Excluir investimento e operações de Fundo XP',
    );
    confirmDeletion();
    expect(stored().investments.map((item: { id: string }) => item.id)).toEqual(
      ['box', 'btc'],
    );
    expect(stored().investmentEntries).toHaveLength(3);
  });

  it('usa somente os botões oficiais do Design System em todas as categorias', () => {
    seed();
    const raw = JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!);
    const extra = [
      ['stock', 'Ações'],
      ['fixed', 'Renda fixa'],
      ['usd', 'Dólar (USD)'],
      ['other', 'Outros'],
    ] as const;
    for (const [id, category] of extra) {
      raw.data.records.investments.push({ id, name: category, category });
      raw.data.records.investmentEntries.push({
        id: `${id}-initial`,
        investmentId: id,
        kind: 'contribution',
        amountCents: 10000,
        date: '2026-11-01',
        positionInitial: true,
        ...(category === 'Dólar (USD)' ? { quantity: 20 } : {}),
      });
    }
    localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(raw));
    render(<App />);
    financeTab('Investimentos');
    const cards = within(
      screen.getByRole('region', { name: 'Carteira cadastrada' }),
    ).getAllByRole('group');
    expect(cards).toHaveLength(7);
    for (const card of cards) {
      const name = card
        .getAttribute('aria-label')!
        .replace(/^(Caixinha|Investimento) /, '');
      // Visíveis: uma ação primária oficial, “Mais ações” e “Ver detalhes”.
      const buttons = within(card).getAllByRole('button');
      expect(buttons.map((button) => button.className)).toEqual([
        'action-button',
        'text-action',
        'text-action',
      ]);
      expect(buttons[1]).toHaveAccessibleName(`Mais ações de ${name}`);
      expect(buttons[1]).toHaveAttribute('aria-haspopup', 'menu');
      expect(buttons[2]).toHaveAccessibleName(`Ver detalhes de ${name}`);
      // O menu usa as opções do popup oficial e termina em Editar e Excluir.
      fireEvent.click(buttons[1]!);
      const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
      for (const item of items)
        expect(item).toHaveClass('custom-select__option');
      expect(items.slice(-2).map((item) => item.textContent)).toEqual([
        'Editar',
        'Excluir',
      ]);
      expect(items[0]).toHaveFocus();
      fireEvent.keyDown(items[0]!, { key: 'Escape' });
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(buttons[1]).toHaveFocus();
    }
  });
});
