import { fetchBitcoinQuote } from './bitcoinQuote';
vi.mock('./bitcoinQuote', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./bitcoinQuote')>()),
  fetchBitcoinQuote: vi.fn(),
}));
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
import { App } from '../../app/App';
import {
  PLAYER_STORAGE_KEY,
  createDemoPlayerState,
} from '../../app/playerState';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function input(form: HTMLElement, label: string, value: string) {
  fireEvent.change(within(form).getByLabelText(label), {
    target: {
      value:
        /Valor|Saldo inicial|Preço|Custo/.test(label) && /^-?\d+$/.test(value)
          ? value + ',00'
          : value,
    },
  });
}
function click(form: HTMLElement, name: string) {
  fireEvent.click(within(form).getByRole('button', { name }));
}
function stored() {
  return JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data;
}
function open() {
  window.history.replaceState(null, '', '/financas');
  return render(<App />);
}
describe('Finanças pela interface', () => {
  it('cadastra BTC, vende parcialmente, edita, exclui e recupera posição e cotação na recarga', async () => {
    vi.mocked(fetchBitcoinQuote).mockResolvedValue({
      priceCents: 20000000,
      updatedAt: Date.now(),
      observedAt: Date.now(),
    });
    let app = open();
    let form = screen.getByRole('form', { name: 'Cadastrar saldo inicial' });
    input(form, 'Saldo inicial (R$)', '1000');
    input(form, 'Data', '2026-01-01');
    click(form, 'Cadastrar saldo inicial');
    form = screen.getByRole('form', { name: 'Cadastrar investimento' });
    input(form, 'Nome do investimento', 'Minha reserva BTC');
    input(form, 'Categoria do investimento', 'Bitcoin');
    input(form, 'Tipo de registro do investimento', 'purchase');
    input(form, 'Valor aplicado inicial (R$)', '200');
    input(form, 'Quantidade em BTC', '0.002');
    click(form, 'Adicionar investimento');
    await waitFor(() =>
      expect(stored().records.finance.quotes).toHaveLength(1),
    );
    expect(
      screen.getByRole('region', { name: 'Carteira cadastrada' }),
    ).toHaveTextContent('0.00200000 BTC');
    form = screen.getByRole('form', { name: 'Aportes e retiradas' });
    input(form, 'Operação', 'withdrawal');
    input(form, 'Valor da operação (R$)', '150');
    input(form, 'Quantidade em BTC', '0.001');
    click(form, 'Registrar operação');
    expect(
      screen.getByRole('region', { name: 'Carteira cadastrada' }),
    ).toHaveTextContent('0.00100000 BTC');
    expect(stored().records.movements).toEqual([]);
    const entries = stored().records.investmentEntries;
    expect(entries).toHaveLength(2);
    const operations = screen.getAllByRole('button', {
      name: /Editar operação de/,
    });
    fireEvent.click(operations[1]!);
    form = screen.getByRole('form', { name: 'Editar aporte ou retirada' });
    input(form, 'Valor da operação (R$)', '175');
    click(form, 'Salvar operação');
    expect(stored().records.investmentEntries[1].amountCents).toBe(17500);
    app.unmount();
    app = open();
    expect(
      screen.getByRole('region', { name: 'Carteira cadastrada' }),
    ).toHaveTextContent('0.00100000 BTC');
    expect(
      screen.getByRole('region', { name: 'Cotação Bitcoin' }),
    ).toHaveTextContent('200.000,00');
    expect(stored().records.finance.quotes).toHaveLength(1);
    fireEvent.click(
      screen.getAllByRole('button', { name: /Excluir operação de/ })[1]!,
    );
    expect(
      screen.getByRole('region', { name: 'Carteira cadastrada' }),
    ).toHaveTextContent('0.00200000 BTC');
    const graph = screen.getByRole('region', { name: 'Evolução financeira' });
    click(graph, 'Patrimônio total');
    click(graph, 'Anual');
    expect(within(graph).getByRole('img')).toHaveAccessibleName(
      /Patrimônio financeiro em reais/,
    );
  });
  it('continua atualizando a cada hora fora de Finanças sem gerar XP', async () => {
    vi.useFakeTimers();
    const state = createDemoPlayerState();
    state.records.investments = [{ id: 'b', name: 'BTC', category: 'Bitcoin' }];
    state.records.investmentEntries = [
      {
        id: 'buy',
        investmentId: 'b',
        kind: 'contribution',
        amountCents: 10000,
        quantity: 0.001,
        date: '2026-11-01',
      },
    ];
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify({ version: 2, data: state }),
    );
    vi.mocked(fetchBitcoinQuote).mockResolvedValue({
      priceCents: 20000000,
      updatedAt: Date.now(),
      observedAt: Date.now(),
    });
    open();
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(
      within(
        screen.getByRole('navigation', { name: 'Navegação principal' }),
      ).getByRole('button', { name: 'Início' }),
    );
    const xp = screen
      .getByRole('progressbar', { name: 'Experiência do jogador' })
      .getAttribute('aria-valuenow');
    vi.mocked(fetchBitcoinQuote).mockResolvedValue({
      priceCents: 21000000,
      updatedAt: Date.now() + 3600000,
      observedAt: Date.now() + 3600000,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3600000);
    });
    expect(stored().records.finance.quotes).toHaveLength(1);
    expect(stored().records.finance.quotes[0].priceCents).toBe(21000000);
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', xp!);
    cleanup();
  });
  it('exibe última cotação desatualizada quando API falha, sem impedir os registros', async () => {
    const state = createDemoPlayerState();
    state.records.investments = [{ id: 'b', name: 'BTC', category: 'Bitcoin' }];
    state.records.investmentEntries = [
      {
        id: 'buy',
        investmentId: 'b',
        kind: 'contribution',
        amountCents: 10000,
        quantity: 0.001,
        date: '2026-11-01',
      },
    ];
    state.records.finance = {
      accounts: [],
      transfers: [],
      valuations: [],
      quotes: [
        {
          priceCents: 10000000,
          updatedAt: Date.now() - 7200000,
          observedAt: Date.now() - 7200000,
        },
      ],
    };
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify({ version: 2, data: state }),
    );
    vi.mocked(fetchBitcoinQuote).mockRejectedValue(new Error('offline'));
    open();
    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'Cotação Bitcoin' }),
      ).toHaveTextContent('Cotação indisponível'),
    );
    expect(
      screen.getByRole('region', { name: 'Cotação Bitcoin' }),
    ).toHaveTextContent('Desatualizada');
    expect(stored().records.investmentEntries).toHaveLength(1);
    expect(stored().records.finance.quotes).toHaveLength(1);
  });
});
