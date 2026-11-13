import { describe, it, expect, vi } from 'vitest';
import { applyRecordCommand, isLifeRecords } from '../records/commands';
import {
  emptyRecords,
  type LifeRecords,
  type RecordCommand,
} from '../records/types';
import { financialSummary, financialHistory, investmentValue } from './ledger';
import { recordReward, projectEffortActivities } from '../records/progression';
import { createUsdQuoteClient, usdQuoteUrl } from './usdQuote';
import { QUOTE_TTL } from './bitcoinQuote';
import {
  createDemoPlayerState,
  isPlayerState,
  PLAYER_STORAGE_VERSION,
  migratePlayerState,
} from '../../app/playerState';
import { createLocalStateStorage } from '../../shared/storage/localStateStorage';
const today = '2026-11-13';
const now = new Date('2026-11-13T18:00:00Z').getTime();
const apply = (s: LifeRecords, c: RecordCommand) =>
  applyRecordCommand(s, c, today);
function bought() {
  let s = apply(emptyRecords(), {
    type: 'saveAccount',
    value: {
      id: 'principal',
      name: 'Conta',
      date: '2026-01-01',
      initialCents: 100000,
    },
  });
  s = apply(s, {
    type: 'saveInvestment',
    value: { id: 'usd', name: 'Reserva USD', category: 'Dólar (USD)' },
    initialEntry: {
      id: 'buy',
      investmentId: 'usd',
      quantity: 100,
      amountCents: 50000,
      kind: 'contribution',
      date: '2026-11-01',
    },
  });
  return s;
}
describe('Dólar, patrimônio e compatibilidade', () => {
  it('cadastra, avalia e vende USD por custo médio sem criar receita/despesa', () => {
    let s = bought();
    const reward = recordReward(s, [], today),
      radar = projectEffortActivities([], [], s, today);
    s = apply(s, {
      type: 'saveUsdQuote',
      value: { rateUnits: 52034, updatedAt: now - 3600000, observedAt: now },
    });
    expect(investmentValue(s, 'usd', today)).toMatchObject({
      units: 10000,
      cost: 50000,
      current: 52034,
      gain: 2034,
    });
    expect(financialSummary(s, today)).toMatchObject({
      cash: 50000,
      investments: 52034,
      wealth: 102034,
    });
    expect(recordReward(s, [], today)).toBe(reward);
    expect(projectEffortActivities([], [], s, today)).toEqual(radar);
    s = apply(s, {
      type: 'saveInvestmentEntry',
      value: {
        id: 'sell',
        investmentId: 'usd',
        quantity: 40,
        amountCents: 22000,
        kind: 'withdrawal',
        date: today,
      },
    });
    expect(investmentValue(s, 'usd', today)).toMatchObject({
      units: 6000,
      cost: 30000,
      current: 31220,
      gain: 1220,
    });
    expect(financialSummary(s, today)).toMatchObject({
      cash: 72000,
      wealth: 103220,
    });
    expect(s.movements).toEqual([]);
    expect(() =>
      apply(s, {
        type: 'saveInvestmentEntry',
        value: {
          id: 'over',
          investmentId: 'usd',
          quantity: 61,
          amountCents: 100,
          kind: 'withdrawal',
          date: today,
        },
      }),
    ).toThrow();
    s = apply(s, {
      type: 'saveInvestmentEntry',
      value: { ...s.investmentEntries[1]!, quantity: 50 },
    });
    expect(investmentValue(s, 'usd', today).cost).toBe(25000);
    s = apply(s, { type: 'deleteInvestmentEntry', id: 'sell' });
    expect(investmentValue(s, 'usd', today).units).toBe(10000);
    expect(
      financialHistory(s, today).find((p) => p.date === '2026-11-01'),
    ).toMatchObject({ known: false, investments: 50000 });
    expect(financialHistory(s, today).at(-1)?.wealth).toBe(102034);
  });
  it('representa custo desconhecido sem débito fictício, lucro inventado ou cotação retroativa', () => {
    let s = bought();
    s = apply(s, {
      type: 'saveInvestmentEntry',
      value: { ...s.investmentEntries[0]!, costUnknown: true, amountCents: 0 },
      confirmInitial: true,
    });
    expect(financialSummary(s, today)).toMatchObject({
      cash: 100000,
      wealth: null,
      unpriced: true,
      costKnown: false,
    });
    s = apply(s, {
      type: 'saveUsdQuote',
      value: { rateUnits: 52000, updatedAt: now, observedAt: now },
    });
    expect(financialSummary(s, today)).toMatchObject({
      cash: 100000,
      wealth: 152000,
    });
    expect(investmentValue(s, 'usd', today)).toMatchObject({
      current: 52000,
      costKnown: false,
    });
    expect(isLifeRecords(s)).toBe(true);
    s = apply(s, { type: 'resetFinances', confirmation: 'ZERAR' });
    expect(s.finance?.usdQuotes).toBeUndefined();
    expect(
      apply(s, {
        type: 'saveUsdQuote',
        value: { rateUnits: 52000, updatedAt: now, observedAt: now },
      }),
    ).toBe(s);
  });
  it('persiste USD como extensão opcional v2 e mantém migração v1', () => {
    const state = createDemoPlayerState();
    expect(isPlayerState(state)).toBe(true);
    expect(migratePlayerState(1, state)?.records).toEqual(emptyRecords());
    const storage = createLocalStateStorage(
      'usd-test',
      PLAYER_STORAGE_VERSION,
      isPlayerState,
      () => localStorage,
      migratePlayerState,
    );
    state.records = bought();
    state.records.workouts = [{ date: today, trained: true }];
    state.records = apply(state.records, {
      type: 'saveUsdQuote',
      value: { rateUnits: 52000, updatedAt: now, observedAt: now },
    });
    expect(storage.save(state)).toBe(true);
    expect(storage.load()).toEqual({ status: 'loaded', data: state });
    expect(() =>
      apply(state.records, {
        type: 'saveInvestmentEntry',
        value: {
          id: 'bad',
          investmentId: 'usd',
          kind: 'contribution',
          amountCents: 1,
          quantity: 0.001,
          date: today,
        },
      }),
    ).toThrow();
  });
});
describe('Cliente PTAX', () => {
  const response = (body: unknown, ok = true) =>
    ({ ok, json: async () => body }) as Response;
  it('consulta fechamento USD, retém quatro casas e compartilha requisições/cache por 60 minutos', async () => {
    const fetchQuote = createUsdQuoteClient();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        value: [
          {
            cotacaoVenda: 5.2034,
            dataHoraCotacao: '2026-11-13 13:05:00.000',
          },
        ],
      }),
    );
    const [a, b] = await Promise.all([
      fetchQuote(undefined, fetcher, now),
      fetchQuote(undefined, fetcher, now),
    ]);
    expect(a).toEqual(b);
    expect(a.rateUnits).toBe(52034);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = new URL(usdQuoteUrl(now));
    expect(url.searchParams.get('@moeda')).toBe("'USD'");
    expect(url.searchParams.get('$filter')).toBe("tipoBoletim eq 'Fechamento'");
    expect(await fetchQuote(a, fetcher, now + QUOTE_TTL - 1)).toEqual(a);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await fetchQuote(a, fetcher, now + QUOTE_TTL);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const reloaded = createUsdQuoteClient();
    expect(await reloaded(a, fetcher, now + 100)).toEqual(a);
  });
  it('mantém referência anterior em falha e limita novas tentativas', async () => {
    const fetchQuote = createUsdQuoteClient();
    const previous = {
      rateUnits: 52000,
      updatedAt: now - QUOTE_TTL,
      observedAt: now - QUOTE_TTL,
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('offline'));
    await expect(fetchQuote(previous, fetcher, now)).rejects.toThrow('offline');
    await expect(fetchQuote(previous, fetcher, now + 1)).rejects.toThrow(
      'próxima',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(previous.rateUnits).toBe(52000);
  });
  it.each([
    {},
    { value: [] },
    { value: [{ cotacaoVenda: -1, dataHoraCotacao: '2026-11-13 13:00:00' }] },
    { value: [{ cotacaoVenda: 5.2, dataHoraCotacao: 'bad' }] },
  ])('rejeita resposta inválida', async (body) => {
    await expect(
      createUsdQuoteClient()(
        undefined,
        vi.fn<typeof fetch>().mockResolvedValue(response(body)),
        now,
      ),
    ).rejects.toThrow();
  });
});
