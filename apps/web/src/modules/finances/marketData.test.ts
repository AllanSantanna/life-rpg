import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDemoPlayerState } from '../../app/playerState';
import { applyRecordCommand, isLifeRecords } from '../records/commands';
import type { LifeRecords } from '../records/types';
import { financialSummary, investmentValue } from './ledger';
import {
  compactSeries,
  dailyChange,
  filterPeriod,
  positionHistory,
  priceHistory,
  trendOf,
} from './marketChart';
import { createMarketClient, parseMarketResponse } from './marketQuote';
import { cardFigures } from './investmentFigures';
import { money } from './calculations';
import { position } from './position';
import {
  emptyLedger,
  type InvestmentEntry,
  type MarketQuote,
  TICKER_PATTERN,
} from './types';

const today = '2026-11-13';
const buy = (
  id: string,
  date: string,
  quantity: number | undefined,
  amountCents: number,
  extra: Partial<InvestmentEntry> = {},
): InvestmentEntry => ({
  id,
  investmentId: 'vale',
  kind: 'contribution',
  date,
  amountCents,
  positionInitial: false,
  accountId: 'principal',
  ...(quantity !== undefined ? { quantity } : {}),
  ...extra,
});
const sell = (
  id: string,
  date: string,
  quantity: number | undefined,
  amountCents: number,
): InvestmentEntry => ({
  id,
  investmentId: 'vale',
  kind: 'withdrawal',
  date,
  amountCents,
  accountId: 'principal',
  ...(quantity !== undefined ? { quantity } : {}),
});
const quote = (
  priceCents: number,
  observedAt = new Date(2026, 10, 13, 12).getTime(),
): MarketQuote => ({
  ticker: 'VALE3',
  priceCents,
  previousCloseCents: 6045,
  marketTime: observedAt - 60000,
  observedAt,
});
function records(entries: InvestmentEntry[], quotes: MarketQuote[] = []) {
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
    marketQuotes: quotes,
  };
  state.records.investments = [
    { id: 'vale', name: 'Vale', category: 'Ações', ticker: 'VALE3' },
  ];
  state.records.investmentEntries = entries;
  return state.records as LifeRecords;
}

describe('posição de ações e FIIs por quantidade', () => {
  it('acumula compras e baixa o custo da venda pelo preço médio', () => {
    const holding = position(
      [
        buy('a', '2026-11-01', 2, 12000),
        buy('b', '2026-11-05', 3, 18600),
        sell('c', '2026-11-10', 1, 6500),
      ],
      'shares',
    );
    expect(holding).toMatchObject({
      units: 4e8,
      unitsKnown: true,
      // Custo médio de 30.600/5 = 6.120 por ação; restam 4 × 6.120.
      cost: 24480,
      withdrawn: 6500,
    });
  });
  it('rejeita venda maior que a quantidade e preserva registros antigos sem quantidade', () => {
    expect(() =>
      position(
        [buy('a', '2026-11-01', 2, 12000), sell('b', '2026-11-02', 3, 1)],
        'shares',
      ),
    ).toThrow('Venda excede a quantidade');
    const legacyEntries = [
      buy('a', '2026-11-01', undefined, 12000),
      sell('b', '2026-11-02', undefined, 5000),
    ];
    const legacy = position(legacyEntries, 'shares');
    // Regra anterior: custo baixa pelo valor vendido; quantidade fica incompleta.
    expect(legacy).toMatchObject({ cost: 7000, unitsKnown: false });
    expect(legacy.cost).toBe(position(legacyEntries, false).cost);
    expect(() =>
      position(
        [
          buy('a', '2026-11-01', undefined, 12000),
          sell('b', '2026-11-02', 1, 5000),
        ],
        'shares',
      ),
    ).toThrow('Informe a quantidade de todas as compras anteriores');
  });
});

describe('valor de mercado da posição', () => {
  it('usa quantidade × cotação, sem alterar custo, dinheiro disponível ou registros', () => {
    const entries = [
      buy('a', '2026-11-01', 2, 12000),
      buy('b', '2026-11-05', 3, 18600),
    ];
    const without = records(entries);
    const priced = records(entries, [quote(6120)]);
    const value = investmentValue(priced, 'vale', today);
    expect(value).toMatchObject({
      units: 5e8,
      current: 30600,
      cost: 30600,
      gain: 0,
      known: true,
      marketPriced: true,
    });
    const higher = investmentValue(
      records(entries, [quote(7000)]),
      'vale',
      today,
    );
    expect(higher).toMatchObject({ current: 35000, cost: 30600, gain: 4400 });
    const before = financialSummary(without, today);
    const after = financialSummary(records(entries, [quote(7000)]), today);
    expect(after.cash).toBe(before.cash);
    expect(after.cost).toBe(before.cost);
    expect(after.wealth! - before.wealth!).toBe(35000 - 30600);
  });
  it('não aplica cotação antes da observação nem sem quantidade completa', () => {
    const entries = [buy('a', '2026-11-01', 2, 12000)];
    const future = records(entries, [
      quote(9000, new Date(2026, 10, 20, 12).getTime()),
    ]);
    expect(investmentValue(future, 'vale', today)).toMatchObject({
      current: 12000,
      marketPriced: false,
    });
    const incomplete = records(
      [buy('a', '2026-11-01', undefined, 12000)],
      [quote(9000)],
    );
    expect(investmentValue(incomplete, 'vale', today)).toMatchObject({
      marketPriced: false,
      unitsKnown: false,
      current: 12000,
    });
  });
});

describe('comandos e persistência', () => {
  it('guarda uma cotação por ticker e dia, ignora tickers fora da carteira e limpa ao remover', () => {
    let state = records([buy('a', '2026-11-01', 2, 12000)]);
    state = applyRecordCommand(
      state,
      { type: 'saveMarketQuote', value: quote(6000) },
      today,
    );
    state = applyRecordCommand(
      state,
      { type: 'saveMarketQuote', value: quote(6120) },
      today,
    );
    expect(state.finance?.marketQuotes).toEqual([quote(6120)]);
    const ignored = applyRecordCommand(
      state,
      { type: 'saveMarketQuote', value: { ...quote(1), ticker: 'PETR4' } },
      today,
    );
    expect(ignored).toBe(state);
    const unlinked = applyRecordCommand(
      state,
      {
        type: 'saveInvestment',
        value: { id: 'vale', name: 'Vale', category: 'Ações' },
      },
      today,
    );
    expect(unlinked.finance?.marketQuotes).toEqual([]);
    expect(unlinked.investmentEntries).toEqual(state.investmentEntries);
  });
  it('valida tickers e aceita registros antigos sem ticker', () => {
    expect(TICKER_PATTERN.test('VALE3')).toBe(true);
    expect(TICKER_PATTERN.test('HGLG11')).toBe(true);
    expect(TICKER_PATTERN.test('B3SA3')).toBe(true);
    expect(TICKER_PATTERN.test('VALE')).toBe(false);
    expect(TICKER_PATTERN.test('vale3')).toBe(false);
    const valid = records([buy('a', '2026-11-01', 2, 12000)]);
    expect(isLifeRecords(valid)).toBe(true);
    expect(
      isLifeRecords({
        ...valid,
        investments: [{ id: 'vale', name: 'Vale', category: 'Ações' }],
      }),
    ).toBe(true);
    expect(
      isLifeRecords({
        ...valid,
        investments: [
          { id: 'vale', name: 'Vale', category: 'Renda fixa', ticker: 'VALE3' },
        ],
      }),
    ).toBe(false);
    expect(
      isLifeRecords({
        ...valid,
        investments: [
          { id: 'vale', name: 'Vale', category: 'Ações', ticker: 'VALE' },
        ],
      }),
    ).toBe(false);
  });
});

describe('séries dos gráficos', () => {
  const history = [
    { date: '2026-11-03', closeCents: 6000 },
    { date: '2026-11-04', closeCents: 6100 },
    { date: '2026-11-06', closeCents: 6050 },
    { date: '2026-11-07', closeCents: 6200 },
  ];
  it('usa somente pregões reais e acrescenta a cotação do dia apenas se faltar', () => {
    const points = priceHistory(history, {
      ...quote(6300),
      marketTime: Date.parse('2026-11-10T18:00:00Z'),
    });
    expect(points.map((point) => point.date)).toEqual([
      '2026-11-03',
      '2026-11-04',
      '2026-11-06',
      '2026-11-07',
      '2026-11-10',
    ]);
    expect(
      priceHistory(history, {
        ...quote(6300),
        marketTime: Date.parse('2026-11-07T18:00:00Z'),
      }),
    ).toHaveLength(4);
    expect(compactSeries(points, 3).map((point) => point.value)).toEqual([
      6050, 6200, 6300,
    ]);
    expect(trendOf(compactSeries(points))).toBe('up');
    expect(trendOf([{ value: 2 }, { value: 1 }])).toBe('down');
    expect(trendOf([{ value: 1 }])).toBe('flat');
    expect(filterPeriod(points, '7d').map((point) => point.date)).toEqual([
      '2026-11-04',
      '2026-11-06',
      '2026-11-07',
      '2026-11-10',
    ]);
    expect(filterPeriod(points, 'all')).toHaveLength(5);
  });
  it('calcula a variação diária do ativo contra o fechamento anterior', () => {
    expect(dailyChange(quote(6120))).toEqual({
      change: 75,
      percent: (75 / 6045) * 100,
    });
    const withoutClose: MarketQuote = { ...quote(6120) };
    delete withoutClose.previousCloseCents;
    expect(dailyChange(withoutClose)).toBeNull();
  });
  it('reconstrói a posição com a quantidade possuída em cada pregão', () => {
    const { points, limitation } = positionHistory(
      [buy('a', '2026-11-03', 2, 12000), buy('b', '2026-11-06', 3, 18150)],
      history,
    );
    expect(limitation).toBeNull();
    expect(
      points.map((point) => [point.date, point.units, point.value]),
    ).toEqual([
      ['2026-11-03', 2e8, 12000],
      ['2026-11-04', 2e8, 12200],
      ['2026-11-06', 5e8, 30250],
      ['2026-11-07', 5e8, 31000],
    ]);
    expect(
      positionHistory([buy('a', '2026-11-03', undefined, 12000)], history),
    ).toMatchObject({
      points: [],
      limitation: expect.stringContaining('informe a quantidade'),
    });
    expect(
      positionHistory(
        [
          buy('a', '2026-11-06', 2, 12000, {
            positionInitial: true,
            acquisitionDateUnknown: true,
          }),
        ],
        history,
      ).limitation,
    ).toContain('sem data original');
  });
});

describe('cartão de ações e FIIs', () => {
  it('mostra quantidade, cotação com variação do dia, custo e resultado', () => {
    const state = records([buy('a', '2026-11-01', 2, 12000)], [quote(6120)]);
    const figures = cardFigures(
      state.investments[0]!,
      investmentValue(state, 'vale', today),
      { btc: undefined, usd: undefined, stale: false },
    );
    expect(figures.label).toBe('Valor estimado pela cotação');
    expect(figures.value).toBe(money(12240));
    expect(figures.metrics).toEqual([
      { label: 'Quantidade', value: '2' },
      {
        label: 'Cotação · variação do dia',
        value: `${money(6120)} · +1,24%`,
      },
      { label: 'Custo da posição', value: money(12000) },
      {
        label: 'Resultado não realizado',
        value: `${money(240)} · +2,00%`,
      },
    ]);
    expect(figures.notes[0]).toContain('não a rentabilidade do investimento');
  });
});

describe('cliente de cotações do apps/api', () => {
  afterEach(() => vi.unstubAllEnvs());
  const body = {
    ticker: 'VALE3',
    name: 'Vale S.A.',
    priceCents: 6120,
    previousCloseCents: 6045,
    marketTime: 1000,
    fetchedAt: 1000,
    stale: false,
    history: [
      { date: '2026-11-07', closeCents: 6200 },
      { date: 'inválida', closeCents: 1 },
      { date: '2026-11-06', closeCents: 6050 },
    ],
  };
  const ok = () =>
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  it('valida a resposta e descarta pontos inválidos', () => {
    const data = parseMarketResponse(body, 'VALE3', 2000);
    expect(data.history).toEqual([
      { date: '2026-11-06', closeCents: 6050 },
      { date: '2026-11-07', closeCents: 6200 },
    ]);
    expect(data.quote).toEqual({
      ticker: 'VALE3',
      priceCents: 6120,
      previousCloseCents: 6045,
      marketTime: 1000,
      observedAt: 2000,
    });
    expect(() =>
      parseMarketResponse({ ...body, ticker: 'PETR4' }, 'VALE3', 1),
    ).toThrow();
  });
  it('usa cache, compartilha requisições e espera após falhas', async () => {
    vi.stubEnv('VITE_API_URL', 'http://api.local/');
    const client = createMarketClient();
    const fetcher = ok();
    const options = {
      fetcher: fetcher as unknown as typeof fetch,
      now: 10_000,
    };
    await Promise.all([
      client.fetch('VALE3', options),
      client.fetch('VALE3', options),
    ]);
    expect(fetcher).toHaveBeenCalledOnce();
    expect((fetcher.mock.calls[0] as unknown[])[0]).toBe(
      'http://api.local/market/quotes/VALE3',
    );
    await client.fetch('VALE3', { ...options, now: 10_000 + 29 * 60_000 });
    await client.fetch('VALE3', {
      ...options,
      now: 10_000 + 4 * 60_000,
      force: true,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    await client.fetch('VALE3', {
      ...options,
      now: 10_000 + 5 * 60_000,
      force: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const failing = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: 'Configure BRAPI_TOKEN no servidor.' }),
          {
            status: 502,
          },
        ),
    );
    const other = createMarketClient();
    await expect(
      other.fetch('BBAS3', {
        fetcher: failing as unknown as typeof fetch,
        now: 0,
      }),
    ).rejects.toThrow('Configure BRAPI_TOKEN no servidor.');
    await expect(
      other.fetch('BBAS3', {
        fetcher: failing as unknown as typeof fetch,
        now: 60_000,
      }),
    ).rejects.toThrow('Nova tentativa automática');
    expect(failing).toHaveBeenCalledOnce();
  });
});
