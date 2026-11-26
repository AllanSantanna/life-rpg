import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { fetchBitcoinQuote } from './bitcoinQuote';
import type { BitcoinQuote } from './types';
vi.mock('./bitcoinQuote', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./bitcoinQuote')>()),
  fetchBitcoinQuote: vi.fn(),
}));
import { App } from '../../app/App';
import {
  createDemoPlayerState,
  PLAYER_STORAGE_KEY,
} from '../../app/playerState';
import { money } from './calculations';
import { emptyLedger } from './types';
const today = '2026-11-13';
afterEach(cleanup);
function seed(linked = true) {
  const state = createDemoPlayerState();
  state.records.finance = {
    ...emptyLedger(),
    accounts: [
      {
        id: 'principal',
        name: 'Conta teste',
        initialCents: 100000,
        date: '2026-01-01',
      },
      { id: 'other', name: 'Outra conta', initialCents: 0, date: '2026-01-01' },
    ],
    transfers: linked
      ? [
          {
            id: 't',
            fromId: 'principal',
            toId: 'other',
            amountCents: 10000,
            date: today,
          },
        ]
      : [],
  };
  state.records.movements = linked
    ? [
        {
          id: 'salary',
          kind: 'income',
          description: 'Salário',
          category: 'Geral',
          amountCents: 10000,
          date: today,
        },
      ]
    : [];
  state.records.workouts = [{ date: today, trained: true }];
  state.records.sleep = [{ date: today, hours: 8 }];
  state.records.books = [{ id: 'book', title: 'Livro', totalPages: 100 }];
  state.records.readings = [
    { id: 'r', bookId: 'book', pages: 10, date: today },
  ];
  localStorage.setItem(
    PLAYER_STORAGE_KEY,
    JSON.stringify({ version: 2, data: state }),
  );
  localStorage.setItem('unrelated-module', 'keep');
  window.history.replaceState(null, '', '/financas');
  return state;
}
function stored() {
  return JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data;
}
function overview() {
  return screen.getByRole('region', { name: 'Visão geral financeira' });
}
function summaryValue(label: string) {
  return within(overview()).getByText(label).nextElementSibling?.textContent;
}
function openReset() {
  fireEvent.click(screen.getByText('Configurações financeiras'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Redefinir dados financeiros' }),
  );
  return screen.getByRole('dialog', { name: 'Redefinir dados financeiros' });
}
describe('Confirmações financeiras e persistência', () => {
  it('carteira legada: oculta o gerenciamento de contas sem alterar registros', () => {
    const state = seed();
    render(<App />);
    // Abertura de R$ 1.000,00 + salário R$ 100,00; a transferência entre as
    // contas antigas não altera o total.
    expect(summaryValue('Saldo disponível')).toBe(money(110000));
    for (const name of [
      /Excluir conta/,
      /Editar conta/,
      /Cadastrar saldo inicial/,
      /Transferir entre contas/,
      /Contas, transferências/,
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
      expect(screen.queryByRole('form', { name })).not.toBeInTheDocument();
    }
    expect(
      screen.queryByText(/Contas, transferências/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Conta' }),
    ).not.toBeInTheDocument();
    // Abrir a página não grava nem recria a carteira.
    expect(stored().records).toEqual(state.records);
  });
  it('carteira legada: novas movimentações preservam contas, IDs e transferências', () => {
    const state = seed();
    const app = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar despesa' }));
    const form = screen.getByRole('form', { name: 'Nova movimentação' });
    expect(
      within(form).queryByRole('combobox', { name: 'Conta' }),
    ).not.toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText('Descrição'), {
      target: { value: 'Farmácia' },
    });
    fireEvent.change(within(form).getByLabelText('Valor (R$)'), {
      target: { value: '2500' },
    });
    fireEvent.click(
      within(form).getByRole('button', { name: 'Adicionar movimentação' }),
    );
    const next = stored().records;
    expect(next.finance).toEqual(state.records.finance);
    expect(next.movements.slice(0, 1)).toEqual(state.records.movements);
    expect(next.movements[1]).toMatchObject({
      kind: 'expense',
      description: 'Farmácia',
      amountCents: 2500,
    });
    expect(next.movements[1]).not.toHaveProperty('accountId');
    expect(summaryValue('Saldo disponível')).toBe(money(107500));
    app.unmount();
    render(<App />);
    expect(summaryValue('Saldo disponível')).toBe(money(107500));
    expect(
      stored().records.finance.accounts.map((a: { id: string }) => a.id),
    ).toEqual(['principal', 'other']);
  });
  it('não repõe dados quando uma cotação pendente termina depois da redefinição', async () => {
    let resolve: ((quote: BitcoinQuote) => void) | undefined;
    vi.mocked(fetchBitcoinQuote).mockReturnValue(
      new Promise<BitcoinQuote>((done) => {
        resolve = done;
      }),
    );
    const state = seed();
    state.records.investments = [{ id: 'b', name: 'BTC', category: 'Bitcoin' }];
    state.records.investmentEntries = [
      {
        id: 'buy',
        investmentId: 'b',
        kind: 'contribution',
        amountCents: 10000,
        quantity: 0.001,
        date: today,
      },
    ];
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify({ version: 2, data: state }),
    );
    render(<App />);
    const dialog = openReset();
    fireEvent.change(
      within(dialog).getByLabelText('Digite ZERAR para confirmar'),
      { target: { value: 'ZERAR' } },
    );
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Apagar todos os dados financeiros',
      }),
    );
    await act(async () => {
      resolve!({
        priceCents: 20000000,
        updatedAt: Date.now(),
        observedAt: Date.now(),
      });
      await Promise.resolve();
    });
    expect(stored().records.finance.quotes).toEqual([]);
    expect(stored().records.investments).toEqual([]);
    expect(stored().records.movements).toEqual([]);
    expect(stored().records.workouts).toEqual(state.records.workouts);
  });
  it('exige ZERAR exato, permite cancelar e redefine somente finanças de forma persistente', async () => {
    const state = seed();
    const app = render(<App />);
    let dialog = openReset();
    expect(dialog).toHaveTextContent('irreversível');
    fireEvent.change(
      within(dialog).getByLabelText('Digite ZERAR para confirmar'),
      { target: { value: 'zerar' } },
    );
    expect(
      within(dialog).getByRole('button', {
        name: 'Apagar todos os dados financeiros',
      }),
    ).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(stored().records).toEqual(state.records);
    fireEvent.click(
      screen.getByRole('button', { name: 'Redefinir dados financeiros' }),
    );
    dialog = screen.getByRole('dialog');
    fireEvent.change(
      within(dialog).getByLabelText('Digite ZERAR para confirmar'),
      { target: { value: 'ZERAR' } },
    );
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Apagar todos os dados financeiros',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    const next = stored();
    expect(next.profile).toEqual(state.profile);
    expect(next.missionCompletion).toEqual(state.missionCompletion);
    expect(next.records.movements).toEqual([]);
    expect(next.records.finance.accounts).toEqual([]);
    for (const key of ['workouts', 'sleep', 'books', 'readings'])
      expect(next.records[key]).toEqual(
        state.records[key as keyof typeof state.records],
      );
    expect(localStorage.getItem('unrelated-module')).toBe('keep');
    expect(
      screen.getByRole('region', { name: 'Evolução financeira' }),
    ).toHaveTextContent('Seu histórico começa aqui');
    app.unmount();
    render(<App />);
    expect(stored().records.finance.accounts).toEqual([]);
    expect(
      screen.getByRole('region', { name: 'Evolução financeira' }),
    ).toHaveTextContent('Seu histórico começa aqui');
  });
});
