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
import { PLAYER_STORAGE_KEY } from '../../app/playerState';
import { fetchUsdQuote } from './usdQuote';
import { fetchBitcoinQuote } from './bitcoinQuote';
vi.mock('./usdQuote', async (original) => ({
  ...(await original<typeof import('./usdQuote')>()),
  fetchUsdQuote: vi.fn(),
}));
vi.mock('./bitcoinQuote', async (original) => ({
  ...(await original<typeof import('./bitcoinQuote')>()),
  fetchBitcoinQuote: vi.fn(),
}));
afterEach(cleanup);
function input(form: HTMLElement, label: string, value: string) {
  fireEvent.change(within(form).getByLabelText(label), { target: { value } });
}
function click(form: HTMLElement, name: string) {
  fireEvent.click(within(form).getByRole('button', { name }));
}
function stored() {
  return JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data.records;
}
function open() {
  window.history.replaceState(null, '', '/financas');
  return render(<App />);
}
function account() {
  fireEvent.click(
    screen.getByText('Contas, transferências e avaliações manuais'),
  );
  const form = screen.getByRole('form', { name: 'Cadastrar saldo inicial' });
  input(form, 'Saldo inicial (R$)', '100000');
  input(form, 'Data', '2026-01-01');
  click(form, 'Cadastrar saldo inicial');
}
describe('Fluxos com moedas formatadas', () => {
  it('cadastra USD, vende parcialmente, edita valores e recupera tudo após recarga', async () => {
    vi.mocked(fetchUsdQuote).mockResolvedValue({
      rateUnits: 52000,
      updatedAt: Date.now(),
      observedAt: Date.now(),
    });
    const app = open();
    account();
    let form = screen.getByRole('form', { name: 'Cadastrar investimento' });
    input(form, 'Nome do investimento', 'Dólares');
    input(form, 'Categoria do investimento', 'Dólar (USD)');
    input(form, 'Tipo de registro do investimento', 'purchase');
    input(form, 'Quantidade em USD', '10000');
    input(form, 'Valor pago (R$, se conhecido)', '50000');
    await waitFor(() =>
      expect(form).toHaveTextContent(
        /Valor estimado da quantidade informada: R\$\s520,00/,
      ),
    );
    click(form, 'Adicionar investimento');
    await waitFor(() => expect(stored().finance.usdQuotes).toHaveLength(1));
    expect(stored().investmentEntries[0]).toMatchObject({
      quantity: 100,
      amountCents: 50000,
    });
    expect(
      screen.getByRole('region', { name: 'Cotação Dólar' }),
    ).toHaveTextContent('PTAX de venda');
    expect(
      screen.getByRole('region', { name: 'Carteira cadastrada' }),
    ).toHaveTextContent('US$ 100,00');
    form = screen.getByRole('form', { name: 'Aportes e retiradas' });
    input(form, 'Operação', 'withdrawal');
    input(form, 'Quantidade em USD', '4000');
    input(form, 'Valor da operação (R$)', '22000');
    click(form, 'Registrar operação');
    expect(stored().investmentEntries[1]).toMatchObject({
      quantity: 40,
      amountCents: 22000,
    });
    expect(stored().movements).toEqual([]);
    expect(
      screen.getByRole('region', { name: 'Carteira cadastrada' }),
    ).toHaveTextContent('US$ 60,00');
    fireEvent.click(
      screen.getAllByRole('button', { name: /Editar operação de Dólares/ })[1]!,
    );
    form = screen.getByRole('form', { name: 'Editar aporte ou retirada' });
    expect(within(form).getByLabelText('Valor da operação (R$)')).toHaveValue(
      'R$ 220,00',
    );
    input(form, 'Valor da operação (R$)', '23000');
    click(form, 'Salvar operação');
    expect(stored().investmentEntries[1].amountCents).toBe(23000);
    app.unmount();
    open();
    expect(
      screen.getByRole('region', { name: 'Carteira cadastrada' }),
    ).toHaveTextContent('US$ 60,00');
    fireEvent.click(
      screen.getAllByRole('button', {
        name: /Excluir operação de Dólares/,
      })[1]!,
    );
    expect(stored().investmentEntries).toHaveLength(1);
  });
  it('compra Bitcoin em sats, alterna unidades e conserva a quantidade e a máscara na edição', async () => {
    vi.mocked(fetchBitcoinQuote).mockResolvedValue({
      priceCents: 50000000,
      updatedAt: Date.now(),
      observedAt: Date.now(),
    });
    open();
    account();
    let form = screen.getByRole('form', { name: 'Cadastrar investimento' });
    input(form, 'Nome do investimento', 'BTC em sats');
    input(form, 'Categoria do investimento', 'Bitcoin');
    input(form, 'Tipo de registro do investimento', 'purchase');
    input(form, 'Valor aplicado inicial (R$)', '50000');
    input(form, 'Unidade de Bitcoin', 'sats');
    input(form, 'Quantidade em sats', '100000');
    input(form, 'Unidade de Bitcoin', 'BTC');
    expect(within(form).getByLabelText('Quantidade em BTC')).toHaveValue(
      '0,00100000',
    );
    click(form, 'Adicionar investimento');
    await waitFor(() => expect(stored().finance.quotes).toHaveLength(1));
    expect(stored().investmentEntries[0]).toMatchObject({
      quantity: 0.001,
      amountCents: 50000,
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Editar operação de BTC em sats/ }),
    );
    form = screen.getByRole('form', { name: 'Editar aporte ou retirada' });
    input(form, 'Unidade de Bitcoin', 'sats');
    expect(within(form).getByLabelText('Quantidade em sats')).toHaveValue(
      '100.000',
    );
    expect(within(form).getByLabelText('Valor da operação (R$)')).toHaveValue(
      'R$ 500,00',
    );
    click(form, 'Salvar operação');
    expect(stored().investmentEntries[0].quantity).toBe(0.001);
  });
  it('mostra a referência USD desatualizada após falha sem bloquear o formulário', async () => {
    vi.mocked(fetchUsdQuote).mockRejectedValue(new Error('offline'));
    open();
    account();
    const form = screen.getByRole('form', { name: 'Cadastrar investimento' });
    input(form, 'Nome do investimento', 'Posição existente');
    input(form, 'Categoria do investimento', 'Dólar (USD)');
    input(form, 'Quantidade em USD', '10000');
    click(form, 'Adicionar investimento');
    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'Cotação Dólar' }),
      ).toHaveTextContent('PTAX indisponível'),
    );
    expect(stored().investmentEntries[0]).toMatchObject({
      costUnknown: true,
      amountCents: 0,
      quantity: 100,
    });
    expect(
      screen.getByRole('region', { name: 'Carteira cadastrada' }),
    ).toHaveTextContent('Aguardando cotação');
    expect(
      screen.queryByText(/Lucro\/prejuízo não realizado/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('form', { name: 'Aportes e retiradas' }),
    ).toBeInTheDocument();
  });
});
