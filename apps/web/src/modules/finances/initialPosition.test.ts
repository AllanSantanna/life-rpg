import { describe, it, expect } from 'vitest';
import { applyRecordCommand, isLifeRecords } from '../records/commands';
import {
  emptyRecords,
  type LifeRecords,
  type RecordCommand,
} from '../records/types';
import { financialSummary, financialHistory, investmentValue } from './ledger';
import { investmentCategories } from './types';
import { recordReward, projectEffortActivities } from '../records/progression';
import { wealthChartModel } from './chartModel';
import {
  createDemoPlayerState,
  isPlayerState,
  PLAYER_STORAGE_VERSION,
  migratePlayerState,
} from '../../app/playerState';
import { createLocalStateStorage } from '../../shared/storage/localStateStorage';
const today = '2026-11-13';
const apply = (s: LifeRecords, c: RecordCommand) =>
  applyRecordCommand(s, c, today);
function base() {
  return apply(emptyRecords(), {
    type: 'saveAccount',
    value: {
      id: 'principal',
      name: 'Conta',
      initialCents: 20000,
      date: '2026-01-01',
    },
  });
}
function btc(initial = true) {
  return apply(base(), {
    type: 'saveInvestment',
    value: { id: 'b', name: 'BTC antigo', category: 'Bitcoin' },
    initialEntry: {
      id: 'original',
      investmentId: 'b',
      kind: 'contribution',
      date: '2026-11-01',
      quantity: 0.00061258,
      amountCents: 23954,
      ...(initial ? { positionInitial: true } : {}),
    },
  });
}
function priced(initial = true) {
  return apply(btc(initial), {
    type: 'saveQuote',
    value: {
      priceCents: 38999000,
      updatedAt: new Date(today + 'T12:00:00').getTime(),
      observedAt: new Date(today + 'T12:00:00').getTime(),
    },
  });
}
describe('Posições iniciais e compras reais', () => {
  it('cumpre o exemplo de R$200 e BTC já existente com custo R$239,54 e valor R$238,90', () => {
    const s = priced();
    expect(investmentValue(s, 'b', today)).toMatchObject({
      units: 61258,
      cost: 23954,
      current: 23890,
      gain: -64,
      initialCost: 23954,
      contributed: 0,
    });
    expect(financialSummary(s, today)).toMatchObject({
      cash: 20000,
      investments: 23890,
      wealth: 43890,
    });
    expect(s.movements).toEqual([]);
    expect(recordReward(s, [], today)).toBe(0);
    expect(projectEffortActivities([], [], s, today)).toEqual([]);
  });
  it('debita somente a compra posterior de R$50 e preserva custo médio e patrimônio', () => {
    const before = priced();
    const s = apply(before, {
      type: 'saveInvestmentEntry',
      value: {
        id: 'new',
        investmentId: 'b',
        accountId: 'principal',
        kind: 'contribution',
        amountCents: 5000,
        quantity: 0.00012821,
        date: today,
        positionInitial: false,
      },
    });
    expect(investmentValue(s, 'b', today)).toMatchObject({
      units: 74079,
      cost: 28954,
      contributed: 5000,
      initialCost: 23954,
    });
    expect(financialSummary(s, today)).toMatchObject({
      cash: 15000,
      investments: 28890,
      wealth: 43890,
    });
    expect(recordReward(s, [], today)).toBe(80);
    expect(s.movements).toEqual([]);
    const cash = wealthChartModel(s, today, 30, 'cash');
    const wealth = wealthChartModel(s, today, 30, 'wealth');
    expect(cash.currentValue).toBe(15000);
    expect(wealth.currentValue).toBe(43890);
  });
  it('corrige compra antiga somente após confirmação, revertendo débito sem duplicar ativos', () => {
    const old = priced(false);
    expect(financialSummary(old, today).cash).toBe(-3954);
    expect(() =>
      apply(old, {
        type: 'convertToInitialPosition',
        id: 'original',
        confirmed: false,
      }),
    ).toThrow(/Confirme/);
    const next = apply(old, {
      type: 'convertToInitialPosition',
      id: 'original',
      confirmed: true,
    });
    expect(financialSummary(next, today)).toMatchObject({
      cash: 20000,
      wealth: 43890,
    });
    expect(next.investmentEntries).toEqual([
      { ...old.investmentEntries[0], positionInitial: true },
    ]);
    expect(next.investments).toEqual(old.investments);
    expect(next.movements).toEqual([]);
    expect(recordReward(old, [], today)).toBe(80);
    expect(recordReward(next, [], today)).toBe(0);
    expect(
      apply(next, {
        type: 'convertToInitialPosition',
        id: 'original',
        confirmed: true,
      }),
    ).toEqual(next);
    expect(old.investmentEntries[0]!.positionInitial).toBeUndefined();
  });
  it('preserva vendas posteriores e custo médio ao converter e permite desfazer pela edição', () => {
    let old = priced(false);
    old = apply(old, {
      type: 'saveInvestmentEntry',
      value: {
        id: 'sale',
        investmentId: 'b',
        kind: 'withdrawal',
        date: '2026-11-02',
        quantity: 0.0001,
        amountCents: 4000,
      },
    });
    const holding = investmentValue(old, 'b', today);
    let next = apply(old, {
      type: 'convertToInitialPosition',
      id: 'original',
      confirmed: true,
    });
    expect(investmentValue(next, 'b', today)).toMatchObject({
      units: holding.units,
      cost: holding.cost,
      current: holding.current,
    });
    expect(next.investmentEntries[1]).toEqual(old.investmentEntries[1]);
    expect(
      financialSummary(next, today).cash! - financialSummary(old, today).cash!,
    ).toBe(23954);
    next = apply(next, {
      type: 'saveInvestmentEntry',
      value: { ...next.investmentEntries[0]!, positionInitial: false },
    });
    expect(financialSummary(next, today).cash).toBe(
      financialSummary(old, today).cash,
    );
    expect(() =>
      apply(next, {
        type: 'saveInvestmentEntry',
        value: { ...next.investmentEntries[0]!, positionInitial: true },
      }),
    ).toThrow(/Confirme/);
  });
  it.each(investmentCategories)(
    'posição inicial em %s independe da data/conta e não altera despesas ou XP',
    (category) => {
      const state = apply(base(), {
        type: 'saveInvestment',
        value: { id: 'a', name: category, category },
        initialEntry: {
          id: 'initial',
          investmentId: 'a',
          kind: 'contribution',
          date: today,
          amountCents: 10000,
          positionInitial: true,
          ...(category === 'Bitcoin'
            ? { quantity: 0.001 }
            : category === 'Dólar (USD)'
              ? { quantity: 20 }
              : {}),
        },
      });
      expect(isLifeRecords(state)).toBe(true);
      expect(financialSummary(state, today).cash).toBe(20000);
      expect(recordReward(state, [], today)).toBe(0);
      expect(state.movements).toEqual([]);
    },
  );
  it('não exige conta principal para um ativo preexistente e não usa quantidade/custo desconhecidos como valores fictícios', () => {
    const s = apply(
      {
        ...base(),
        finance: {
          ...base().finance!,
          accounts: [
            {
              id: 'other',
              name: 'Conta',
              initialCents: 20000,
              date: '2026-01-01',
            },
          ],
        },
      },
      {
        type: 'saveInvestment',
        value: { id: 'a', name: 'Ações antigas', category: 'Ações' },
        initialEntry: {
          id: 'old',
          investmentId: 'a',
          kind: 'contribution',
          date: today,
          positionInitial: true,
          acquisitionDateUnknown: true,
          amountCents: 0,
          costUnknown: true,
          quantity: 10,
        },
      },
    );
    expect(financialSummary(s, today)).toMatchObject({
      cash: 20000,
      wealth: null,
      costKnown: false,
    });
    expect(financialHistory(s, today).map((point) => point.date)).toEqual([
      '2026-01-01',
      today,
    ]);
    expect(wealthChartModel(s, today, 30, 'cash').points.at(-1)?.value).toBe(
      20000,
    );
  });
  it('cotação altera somente patrimônio e mantém dinheiro disponível, sem cotações históricas inventadas', () => {
    const state = priced();
    const next = apply(state, {
      type: 'saveQuote',
      value: {
        priceCents: 40000000,
        updatedAt: new Date(today + 'T13:00:00').getTime(),
        observedAt: new Date(today + 'T13:00:00').getTime(),
      },
    });
    expect(wealthChartModel(state, today, 30, 'cash').currentValue).toBe(
      wealthChartModel(next, today, 30, 'cash').currentValue,
    );
    expect(wealthChartModel(state, today, 30, 'wealth').currentValue).not.toBe(
      wealthChartModel(next, today, 30, 'wealth').currentValue,
    );
    expect(
      financialHistory(state, today).find((p) => p.date === '2026-11-01'),
    ).toMatchObject({ known: false, investments: 23954 });
  });
  it('mantém registros legados sem alteração automática, salva v2 e preserva outros pilares', () => {
    const state = createDemoPlayerState();
    state.records = priced(false);
    state.records.workouts = [{ date: today, trained: true }];
    const storage = createLocalStateStorage(
      'initial-test',
      PLAYER_STORAGE_VERSION,
      isPlayerState,
      () => localStorage,
      migratePlayerState,
    );
    expect(storage.save(state)).toBe(true);
    expect(storage.load()).toEqual({ status: 'loaded', data: state });
    state.records = apply(state.records, {
      type: 'convertToInitialPosition',
      id: 'original',
      confirmed: true,
    });
    expect(storage.save(state)).toBe(true);
    expect(storage.load()).toEqual({ status: 'loaded', data: state });
    expect(state.records.workouts).toEqual([{ date: today, trained: true }]);
    expect(migratePlayerState(1, state)?.records).toEqual(emptyRecords());
  });
});
