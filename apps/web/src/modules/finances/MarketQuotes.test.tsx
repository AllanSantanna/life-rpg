import { selectDate, selectOption } from '../../test/selectOption';
import {
  cardAction,
  cardDetails,
  cardMenuAction,
  investmentCard,
  newInvestmentForm,
} from '../../test/finances';
import { marketClient, type MarketData } from './marketQuote';
vi.mock('./marketQuote', async (original) => {
  const actual = await original<typeof import('./marketQuote')>();
  return {
    ...actual,
    marketClient: { fetch: vi.fn(), search: vi.fn(), cached: vi.fn() },
  };
});
import {
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
import { money as currency } from './calculations';
// Texto visível normalizado (toHaveTextContent troca o espaço inseparável).
const money = (cents: number) => currency(cents).replace(/\u00a0/g, ' ');
import { financialSummary, investmentValue } from './ledger';
import { emptyLedger } from './types';

afterEach(cleanup);
const today = '2026-11-13';
// Cotação e histórico simulados: os testes não consultam o mercado real.
function market(
  ticker: string,
  priceCents: number,
  observedAt = Date.now(),
): MarketData {
  return {
    quote: {
      ticker,
      priceCents,
      previousCloseCents: 6045,
      marketTime: observedAt - 60_000,
      observedAt,
    },
    name: ticker === 'VALE3' ? 'Vale S.A.' : 'CGHG Logística',
    history: [
      { date: '2026-11-03', closeCents: 6000 },
      { date: '2026-11-04', closeCents: 6050 },
      { date: '2026-11-05', closeCents: 5980 },
      { date: '2026-11-06', closeCents: 6010 },
      { date: '2026-11-07', closeCents: 6100 },
      { date: '2026-11-10', closeCents: 6080 },
      { date: '2026-11-11', closeCents: 6030 },
      { date: '2026-11-12', closeCents: 6045 },
    ],
    stale: false,
  };
}
function seed({ ticker = true } = {}) {
  const state = createDemoPlayerState();
  state.records.finance = {
    ...emptyLedger(),
    accounts: [
      {
        id: 'principal',
        name: 'Conta',
        initialCents: 100000,
        date: '2026-01-01',
      },
    ],
  };
  state.records.investments = [
    {
      id: 'vale',
      name: 'Vale',
      category: 'Ações',
      ...(ticker ? { ticker: 'VALE3' } : {}),
    },
  ];
  state.records.investmentEntries = [
    {
      id: 'buy',
      investmentId: 'vale',
      kind: 'contribution',
      amountCents: 12000,
      quantity: 2,
      date: '2026-11-03',
      accountId: 'principal',
      positionInitial: false,
    },
  ];
  localStorage.setItem(
    PLAYER_STORAGE_KEY,
    JSON.stringify({ version: 2, data: state }),
  );
  window.history.replaceState(null, '', '/financas');
  vi.mocked(marketClient.fetch).mockImplementation(async (code) =>
    market(code, 6120),
  );
  vi.mocked(marketClient.search).mockResolvedValue([
    { ticker: 'VALE3', name: 'Vale S.A.', type: 'stock' },
    { ticker: 'HGLG11', name: 'CGHG Logística', type: 'fund' },
  ]);
  return state;
}
const stored = () =>
  JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data.records;
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
const submit = (form: HTMLElement, name = 'Registrar operação') =>
  fireEvent.click(within(form).getByRole('button', { name }));
function home() {
  fireEvent.click(
    within(
      screen.getByRole('navigation', { name: 'Navegação principal' }),
    ).getByRole('button', { name: 'Início' }),
  );
}

describe('Cotações de ações e FIIs na carteira', () => {
  it('mostra cotação, variação, valor estimado e gráfico compacto no mesmo padrão de cartão', async () => {
    seed();
    render(<App />);
    await waitFor(() => expect(stored().finance.marketQuotes).toHaveLength(1));
    const card = investmentCard('Investimento Vale');
    expect(card).toHaveTextContent('VALE3 · Ações');
    expect(card).toHaveTextContent('Valor estimado pela cotação');
    expect(card).toHaveTextContent(money(12240));
    expect(card).toHaveTextContent(`${money(6120)} · +1,24%`);
    expect(card).toHaveTextContent(`${money(240)} · +2,00%`);
    expect(
      within(card).getByRole('img', {
        name: /Cotação de VALE3 nos últimos 7 pregões/,
      }),
    ).toBeInTheDocument();
    // Mesmos controles oficiais dos cartões de BTC e caixinhas.
    expect(
      within(card)
        .getAllByRole('button')
        .map((button) => button.className),
    ).toEqual(['action-button', 'text-action', 'text-action']);
    expect(marketClient.fetch).toHaveBeenCalledWith('VALE3', { force: false });
    expect(marketClient.fetch).toHaveBeenCalledTimes(1);
    // Os dados de mercado ficam somente na área de investimentos.
    home();
    expect(screen.queryByText(/VALE3/)).not.toBeInTheDocument();
  });

  it('compra e vende por quantidade preservando custo médio, dinheiro livre e XP', async () => {
    seed();
    render(<App />);
    await waitFor(() => expect(stored().finance.marketQuotes).toHaveLength(1));
    home();
    const xp = () =>
      screen
        .getByRole('progressbar', { name: 'Experiência do jogador' })
        .getAttribute('aria-valuenow');
    const before = xp();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Finanças' }));
    // Uma nova cotação muda o valor estimado, mas não gera XP nem movimentação.
    vi.mocked(marketClient.fetch).mockResolvedValue(market('VALE3', 6500));
    cardMenuAction('Investimento Vale', 'Atualizar cotação de Vale');
    await waitFor(() =>
      expect(stored().finance.marketQuotes[0].priceCents).toBe(6500),
    );
    home();
    expect(xp()).toBe(before);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Finanças' }));
    vi.mocked(marketClient.fetch).mockResolvedValue(market('VALE3', 6120));
    cardMenuAction('Investimento Vale', 'Atualizar cotação de Vale');
    await waitFor(() =>
      expect(stored().finance.marketQuotes[0].priceCents).toBe(6120),
    );
    const cash = financialSummary(stored(), today).cash!;
    let form = cardAction('Investimento Vale', 'Comprar mais Vale');
    input(form, 'Quantidade (opcional)', '3');
    input(form, 'Valor da operação (R$)', '183,60');
    submit(form);
    expect(stored().investmentEntries[1]).toMatchObject({
      quantity: 3,
      amountCents: 18360,
      kind: 'contribution',
    });
    expect(financialSummary(stored(), today).cash).toBe(cash - 18360);
    expect(investmentValue(stored(), 'vale', today)).toMatchObject({
      units: 5e8,
      cost: 30360,
      current: 30600,
    });
    form = cardAction('Investimento Vale', 'Vender Vale');
    input(form, 'Quantidade vendida (opcional)', '1');
    input(form, 'Valor da operação (R$)', '65,00');
    submit(form);
    // Custo médio 30.360/5 = 6.072; restam 4 ações.
    expect(investmentValue(stored(), 'vale', today)).toMatchObject({
      units: 4e8,
      cost: 24288,
      current: 24480,
    });
    expect(financialSummary(stored(), today).cash).toBe(cash - 18360 + 6500);
    expect(stored().movements).toEqual([]);
    expect(investmentCard('Investimento Vale')).toHaveTextContent(money(24480));
    form = cardAction('Investimento Vale', 'Vender Vale');
    input(form, 'Quantidade vendida (opcional)', '5');
    input(form, 'Valor da operação (R$)', '300,00');
    submit(form);
    expect(within(form).getByRole('alert')).toBeInTheDocument();
    expect(stored().investmentEntries).toHaveLength(3);
  });

  it('exibe gráfico detalhado com períodos, preço e posição por quantidade possuída', async () => {
    seed();
    render(<App />);
    await waitFor(() => expect(stored().finance.marketQuotes).toHaveLength(1));
    const card = cardDetails('Investimento Vale', 'Vale');
    const chart = within(card).getByRole('group', { name: 'Gráfico de VALE3' });
    expect(within(chart).getByRole('img')).toHaveAccessibleName(
      /Preço de VALE3 em reais; 9 pregões/,
    );
    fireEvent.click(within(chart).getByRole('button', { name: '7 dias' }));
    expect(
      within(chart).getByRole('button', { name: '7 dias' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(within(chart).getByRole('img')).toHaveAccessibleName(
      /5 pregões de 07\/11\/2026/,
    );
    fireEvent.click(within(chart).getByRole('button', { name: '1 ano' }));
    expect(chart).toHaveTextContent(
      'A fonte disponibilizou pregões somente desde',
    );
    fireEvent.click(
      within(chart).getByRole('button', { name: 'Valor da posição' }),
    );
    const point = within(chart).getByRole('button', {
      name: `03/11/2026: posição ${currency(12000)}`,
    });
    fireEvent.focus(point);
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Quantidade possuída',
    );
    fireEvent.keyDown(point, { key: 'End' });
    expect(chart).toHaveTextContent('Saltos podem vir de compras ou vendas');
    expect(card).toHaveTextContent('não a rentabilidade do investimento');
  });

  it('preserva a última cotação e informa a falha da fonte', async () => {
    const state = seed();
    state.records.finance!.marketQuotes = [market('VALE3', 5900).quote];
    state.records.finance!.marketQuotes[0]!.observedAt = new Date(
      2026,
      10,
      12,
      12,
    ).getTime();
    state.records.finance!.marketQuotes[0]!.marketTime =
      state.records.finance!.marketQuotes[0]!.observedAt - 1000;
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify({ version: 2, data: state }),
    );
    vi.mocked(marketClient.fetch).mockRejectedValue(
      new Error('Fonte de cotações indisponível.'),
    );
    render(<App />);
    const card = investmentCard('Investimento Vale');
    await waitFor(() =>
      expect(card).toHaveTextContent('Fonte de cotações indisponível.'),
    );
    expect(card).toHaveTextContent(money(11800));
    expect(within(card).getByText('Sem histórico')).toBeInTheDocument();
    expect(stored().finance.marketQuotes).toEqual(
      state.records.finance!.marketQuotes,
    );
    vi.mocked(marketClient.fetch).mockResolvedValue(market('VALE3', 6120));
    cardMenuAction('Investimento Vale', 'Atualizar cotação de Vale');
    await waitFor(() => expect(card).toHaveTextContent('Cotação atualizada'));
    expect(marketClient.fetch).toHaveBeenLastCalledWith('VALE3', {
      force: true,
    });
    expect(stored().investmentEntries).toEqual(state.records.investmentEntries);
  });

  it('vincula ticker a um investimento antigo sem alterar operações', async () => {
    const state = seed({ ticker: false });
    render(<App />);
    expect(investmentCard('Investimento Vale')).toHaveTextContent(
      'Sem avaliação atual; referência pelo custo',
    );
    expect(marketClient.fetch).not.toHaveBeenCalled();
    const form = cardAction('Investimento Vale', 'Editar investimento Vale');
    input(form, 'Ticker B3 (opcional)', 'vale3');
    expect(within(form).getByLabelText('Ticker B3 (opcional)')).toHaveValue(
      'VALE3',
    );
    fireEvent.click(
      within(form).getByRole('button', { name: 'Verificar ticker' }),
    );
    await waitFor(() =>
      expect(form).toHaveTextContent('VALE3 · Vale S.A. (ação).'),
    );
    submit(form, 'Salvar investimento');
    expect(stored().investments[0]).toEqual({
      id: 'vale',
      name: 'Vale',
      category: 'Ações',
      ticker: 'VALE3',
    });
    expect(stored().investmentEntries).toEqual(state.records.investmentEntries);
    await waitFor(() =>
      expect(investmentCard('Investimento Vale')).toHaveTextContent(
        money(12240),
      ),
    );
  });

  it('cadastra FII com ticker validado e rejeita códigos inválidos', async () => {
    seed();
    render(<App />);
    const form = newInvestmentForm();
    input(form, 'Nome do investimento', 'Fundo logístico');
    input(form, 'Categoria do investimento', 'Fundos imobiliários');
    input(form, 'Ticker B3 (opcional)', 'HGLG');
    input(form, 'Tipo de registro do investimento', 'Nova compra ou aporte');
    input(form, 'Quantidade (opcional)', '10');
    input(form, 'Valor aplicado inicial (R$)', '1600,00');
    submit(form, 'Adicionar investimento');
    expect(within(form).getByRole('alert')).toHaveTextContent(
      'Ticker inválido',
    );
    expect(stored().investments).toHaveLength(1);
    input(form, 'Ticker B3 (opcional)', 'HGLG11');
    submit(form, 'Adicionar investimento');
    expect(stored().investments[1]).toMatchObject({
      category: 'Fundos imobiliários',
      ticker: 'HGLG11',
    });
    expect(stored().investmentEntries[1]).toMatchObject({
      quantity: 10,
      amountCents: 160000,
    });
    await waitFor(() =>
      expect(marketClient.fetch).toHaveBeenCalledWith('HGLG11', {
        force: false,
      }),
    );
  });
});
