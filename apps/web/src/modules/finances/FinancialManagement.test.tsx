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
function openAccounts() {
  fireEvent.click(
    screen.getByText('Contas, transferências e avaliações manuais'),
  );
}
function openReset() {
  fireEvent.click(screen.getByText('Configurações financeiras'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Redefinir dados financeiros' }),
  );
  return screen.getByRole('dialog', { name: 'Redefinir dados financeiros' });
}
describe('Confirmações financeiras e persistência', () => {
  it('mantém edição e permite cancelar exclusão com foco no botão seguro', () => {
    const state = seed();
    render(<App />);
    openAccounts();
    expect(
      screen.getByRole('button', { name: 'Editar conta Conta teste' }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Excluir conta Conta teste' }),
    );
    const dialog = screen.getByRole('dialog', {
      name: 'Excluir conta Conta teste',
    });
    expect(dialog).toHaveTextContent('possui registros vinculados');
    expect(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    ).toHaveFocus();
    expect(
      within(dialog).getByRole('button', {
        name: 'Excluir conta e registros vinculados',
      }),
    ).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(stored().records).toEqual(state.records);
  });
  it('exige confirmação explícita para excluir vínculos e atualiza saldo, gráfico e recarga', () => {
    seed();
    const app = render(<App />);
    openAccounts();
    fireEvent.click(
      screen.getByRole('button', { name: 'Excluir conta Conta teste' }),
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Excluir conta e registros vinculados',
      }),
    );
    expect(stored().records.movements).toEqual([]);
    expect(stored().records.finance.transfers).toEqual([]);
    expect(stored().records.finance.accounts).toHaveLength(1);
    expect(
      screen.queryByRole('button', { name: 'Excluir conta Conta teste' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Evolução financeira' }),
    ).toHaveTextContent('Nenhum registro neste período');
    app.unmount();
    render(<App />);
    openAccounts();
    expect(
      screen.getByRole('button', { name: 'Excluir conta Outra conta' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Excluir conta Conta teste' }),
    ).not.toBeInTheDocument();
  });
  it('exclui conta vazia somente após confirmação', () => {
    seed(false);
    render(<App />);
    openAccounts();
    fireEvent.click(
      screen.getByRole('button', { name: 'Excluir conta Conta teste' }),
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('não possui movimentações vinculadas');
    expect(stored().records.finance.accounts).toHaveLength(2);
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Confirmar exclusão da conta',
      }),
    );
    expect(stored().records.finance.accounts).toHaveLength(1);
  });
  it('informa investimentos compartilhados antes de excluir operações de outras contas', () => {
    const state = seed();
    state.records.investments = [
      { id: 'a', name: 'Reserva compartilhada', category: 'Renda fixa' },
    ];
    state.records.investmentEntries = [
      {
        id: 'buy',
        investmentId: 'a',
        kind: 'contribution',
        amountCents: 10000,
        date: today,
      },
      {
        id: 'sell',
        investmentId: 'a',
        kind: 'withdrawal',
        accountId: 'other',
        amountCents: 5000,
        date: today,
      },
    ];
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify({ version: 2, data: state }),
    );
    render(<App />);
    openAccounts();
    fireEvent.click(
      screen.getByRole('button', { name: 'Excluir conta Conta teste' }),
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Reserva compartilhada');
    expect(dialog).toHaveTextContent(
      '1 operações em outras contas também serão excluídas',
    );
    expect(stored().records.investmentEntries).toHaveLength(2);
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Excluir conta e registros vinculados',
      }),
    );
    expect(stored().records.investments).toEqual([]);
    expect(stored().records.investmentEntries).toEqual([]);
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
