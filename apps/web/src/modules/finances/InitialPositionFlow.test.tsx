import {
  cardAction,
  investmentHistory,
  newInvestmentForm,
} from '../../test/finances';
import { selectDate, selectOption } from '../../test/selectOption';
import {
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
  createDemoPlayerState,
  PLAYER_STORAGE_KEY,
} from '../../app/playerState';
import { emptyLedger } from './types';
import { fetchBitcoinQuote } from './bitcoinQuote';
import { FinancialChart } from './FinancialChart';
vi.mock('./bitcoinQuote', async (original) => ({
  ...(await original<typeof import('./bitcoinQuote')>()),
  fetchBitcoinQuote: vi.fn(),
}));
afterEach(cleanup);
const today = '2026-11-13';
function seed(purchase = false) {
  const state = createDemoPlayerState();
  state.records.finance = {
    ...emptyLedger(),
    accounts: [
      {
        id: 'principal',
        name: 'Conta',
        date: '2026-01-01',
        initialCents: 20000,
      },
    ],
  };
  if (purchase) {
    state.records.investments = [
      { id: 'b', name: 'BTC anterior', category: 'Bitcoin' },
    ];
    state.records.investmentEntries = [
      {
        id: 'buy',
        investmentId: 'b',
        kind: 'contribution',
        amountCents: 23954,
        quantity: 0.00061258,
        date: '2026-11-01',
      },
    ];
  }
  localStorage.setItem(
    PLAYER_STORAGE_KEY,
    JSON.stringify({ version: 2, data: state }),
  );
  window.history.replaceState(null, '', '/financas');
  return state;
}
function stored() {
  return JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data.records;
}
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
  fireEvent.change(within(form).getByLabelText(label), { target: { value } });
}
describe('Posições iniciais na interface', () => {
  it('cadastra BTC preexistente, conserva os R$200 e permite compra real posterior', async () => {
    vi.mocked(fetchBitcoinQuote).mockResolvedValue({
      priceCents: 38999000,
      updatedAt: Date.now(),
      observedAt: Date.now(),
    });
    seed();
    render(<App />);
    let form = newInvestmentForm();
    input(form, 'Nome do investimento', 'BTC anterior');
    input(form, 'Categoria do investimento', 'Bitcoin');
    expect(
      within(form).getByLabelText('Tipo de registro do investimento'),
    ).toHaveTextContent('Investimento que já possuo');
    expect(within(form).queryByLabelText('Conta')).not.toBeInTheDocument();
    input(form, 'Custo de aquisição (R$, se conhecido)', '23954');
    input(form, 'Quantidade em BTC', '0,00061258');
    input(form, 'Data original de aquisição (opcional)', '2026-11-01');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Adicionar investimento' }),
    );
    await waitFor(() => expect(stored().finance.quotes).toHaveLength(1));
    expect(stored().investmentEntries[0]).toMatchObject({
      positionInitial: true,
      amountCents: 23954,
      quantity: 0.00061258,
    });
    const chart = screen.getByRole('region', { name: 'Evolução financeira' });
    expect(
      within(chart).getByRole('button', { name: 'Dinheiro disponível' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(chart).toHaveTextContent('R$ 200,00');
    fireEvent.click(
      within(chart).getByRole('button', { name: 'Patrimônio total' }),
    );
    expect(chart).toHaveTextContent('R$ 438,90');
    form = cardAction('Investimento BTC anterior', 'Comprar mais BTC anterior');
    expect(
      within(form).getByLabelText('Tipo de registro do investimento'),
    ).toHaveTextContent('Nova compra ou aporte');
    input(form, 'Valor da operação (R$)', '5000');
    input(form, 'Quantidade em BTC', '0,00012821');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Registrar operação' }),
    );
    fireEvent.click(
      within(chart).getByRole('button', { name: 'Dinheiro disponível' }),
    );
    expect(chart).toHaveTextContent('R$ 150,00');
    expect(stored().movements).toEqual([]);
  });
  it('converte uma compra somente após confirmação e conserva quantidade, custo e recarga', async () => {
    vi.mocked(fetchBitcoinQuote).mockResolvedValue({
      priceCents: 38999000,
      updatedAt: Date.now(),
      observedAt: Date.now(),
    });
    const state = seed(true);
    const app = render(<App />);
    investmentHistory();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Corrigir como posição inicial de BTC anterior',
      }),
    );
    expect(stored().investmentEntries[0].positionInitial).toBeUndefined();
    let dialog = screen.getByRole('dialog', {
      name: 'Converter em posição inicial',
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(stored().investmentEntries[0].positionInitial).toBeUndefined();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Corrigir como posição inicial de BTC anterior',
      }),
    );
    dialog = screen.getByRole('dialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Confirmar conversão' }),
    );
    expect(stored().investmentEntries).toEqual([
      { ...state.records.investmentEntries[0], positionInitial: true },
    ]);
    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'Evolução financeira' }),
      ).toHaveTextContent('R$ 200,00'),
    );
    app.unmount();
    render(<App />);
    expect(stored().investmentEntries).toHaveLength(1);
    expect(
      screen.getByRole('region', { name: 'Evolução financeira' }),
    ).toHaveTextContent('R$ 200,00');
  });
  it('editar uma compra para posição inicial pede confirmação e registra data desconhecida honestamente', async () => {
    vi.mocked(fetchBitcoinQuote).mockResolvedValue({
      priceCents: 38999000,
      updatedAt: Date.now(),
      observedAt: Date.now(),
    });
    seed(true);
    render(<App />);
    investmentHistory();
    fireEvent.click(
      screen.getByRole('button', { name: /Editar operação de BTC anterior/ }),
    );
    const form = screen.getByRole('form', {
      name: 'Editar aporte ou retirada',
    });
    input(
      form,
      'Tipo de registro do investimento',
      'Investimento que já possuo',
    );
    input(form, 'Data original de aquisição (opcional)', '');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Salvar operação' }),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(stored().investmentEntries[0].positionInitial).toBeUndefined();
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Confirmar conversão',
      }),
    );
    expect(stored().investmentEntries[0]).toMatchObject({
      positionInitial: true,
      acquisitionDateUnknown: true,
      date: today,
      quantity: 0.00061258,
      amountCents: 23954,
    });
  });
  it('alterna um único gráfico entre saldos e patrimônio com os três filtros', () => {
    const state = seed(true);
    state.records.investmentEntries[0]!.positionInitial = true;
    render(<FinancialChart records={state.records} today={today} />);
    expect(screen.getByRole('button', { name: 'Mensal' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('img')).toHaveAccessibleName(
      /Dinheiro disponível em reais/,
    );
    for (const period of ['Semanal', 'Anual', 'Mensal']) {
      fireEvent.click(screen.getByRole('button', { name: period }));
      expect(screen.getByRole('button', { name: period })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    }
    fireEvent.click(screen.getByRole('button', { name: 'Patrimônio total' }));
    expect(screen.getByRole('img')).toHaveAccessibleName(
      /Patrimônio financeiro em reais/,
    );
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });
});
