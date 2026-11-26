import { describe, it, expect } from 'vitest';
import {
  emptyRecords,
  type LifeRecords,
  type RecordCommand,
} from '../records/types';
import { applyRecordCommand, isLifeRecords } from '../records/commands';
import {
  financialSummary,
  financialHistory,
  investmentValue,
  position,
  accountBalance,
} from './ledger';
import { monthlyBalance } from './calculations';
import { recordReward, projectEffortActivities } from '../records/progression';
import { scorePeriod } from '../evolution/scoring';
import { createLocalStateStorage } from '../../shared/storage/localStateStorage';
import {
  createDemoPlayerState,
  isPlayerState,
  migratePlayerState,
  PLAYER_STORAGE_VERSION,
} from '../../app/playerState';
const today = '2026-11-13';
const apply = (s: LifeRecords, c: RecordCommand) =>
  applyRecordCommand(s, c, today);
function base() {
  return apply(emptyRecords(), {
    type: 'saveAccount',
    value: {
      id: 'principal',
      name: 'Conta',
      initialCents: 100000,
      date: '2026-01-01',
    },
  });
}
function btc() {
  return apply(base(), {
    type: 'saveInvestment',
    value: { id: 'btc', name: 'Bitcoin', category: 'Bitcoin' },
    initialEntry: {
      id: 'buy',
      investmentId: 'btc',
      kind: 'contribution',
      amountCents: 20000,
      quantity: 0.002,
      date: '2026-11-01',
    },
  });
}
describe('Livro financeiro e compatibilidade', () => {
  it('mantém fluxo mensal separado do saldo inicial, aportes e patrimônio', () => {
    let s = apply(base(), {
      type: 'saveMovement',
      value: {
        id: 'income',
        description: 'Receita',
        category: 'Geral',
        date: today,
        kind: 'income',
        amountCents: 1000,
      },
    });
    s = apply(s, {
      type: 'saveMovement',
      value: {
        id: 'expense',
        description: 'Despesa',
        category: 'Geral',
        date: today,
        kind: 'expense',
        amountCents: 500,
      },
    });
    s = apply(s, {
      type: 'saveInvestment',
      value: { id: 'box', name: 'Caixinha', category: 'Caixinhas bancárias' },
      initialEntry: {
        id: 'deposit',
        investmentId: 'box',
        kind: 'contribution',
        amountCents: 20000,
        date: today,
      },
    });
    expect(monthlyBalance(s.movements, '2026-11')).toEqual({
      income: 1000,
      expense: 500,
      balance: 500,
    });
    expect(financialSummary(s, today)).toMatchObject({
      cash: 80500,
      investments: 20000,
      wealth: 100500,
      known: false,
    });
    s = apply(s, {
      type: 'saveValuation',
      value: {
        id: 'val',
        investmentId: 'box',
        amountCents: 21000,
        date: today,
      },
    });
    expect(financialSummary(s, today)).toMatchObject({
      wealth: 101500,
      known: true,
      cost: 20000,
    });
    s = apply(s, {
      type: 'saveInvestment',
      value: { id: 'box', name: 'Reserva', category: 'Renda fixa' },
    });
    expect(s.investments[0]?.name).toBe('Reserva');
    s = apply(s, {
      type: 'saveInvestmentEntry',
      value: { ...s.investmentEntries[0]!, amountCents: 19000 },
    });
    expect(financialSummary(s, today)).toMatchObject({
      cash: 81500,
      cost: 19000,
    });
    s = apply(s, { type: 'deleteInvestmentEntry', id: 'deposit' });
    expect(financialSummary(s, today).cash).toBe(100500);
  });
  it('transfere entre contas sem receita, despesa, XP ou duplicação de patrimônio', () => {
    let s = apply(base(), {
      type: 'saveAccount',
      value: { id: 'bank', name: 'Banco', initialCents: 0, date: '2026-01-01' },
    });
    s = apply(s, {
      type: 'saveTransfer',
      value: {
        id: 't',
        fromId: 'principal',
        toId: 'bank',
        amountCents: 20000,
        date: today,
      },
    });
    expect(accountBalance(s, 'principal', today)).toBe(80000);
    expect(accountBalance(s, 'bank', today)).toBe(20000);
    expect(financialSummary(s, today).wealth).toBe(100000);
    expect(recordReward(s, [], today)).toBe(0);
    expect(s.movements).toEqual([]);
    s = apply(s, {
      type: 'saveTransfer',
      value: { ...s.finance!.transfers[0]!, amountCents: 15000 },
    });
    expect(accountBalance(s, 'bank', today)).toBe(15000);
    s = apply(s, { type: 'deleteTransfer', id: 't' });
    expect(accountBalance(s, 'principal', today)).toBe(100000);
    expect(() =>
      apply(s, {
        type: 'saveTransfer',
        value: {
          id: 'bad',
          fromId: 'principal',
          toId: 'principal',
          amountCents: 100,
          date: today,
        },
      }),
    ).toThrow();
  });
  it('calcula vendas parciais de BTC pelo custo médio, mesmo com lucro realizado', () => {
    let s = btc();
    s = apply(s, {
      type: 'saveInvestmentEntry',
      value: {
        id: 'buy2',
        investmentId: 'btc',
        kind: 'contribution',
        quantity: 0.001,
        amountCents: 20000,
        date: '2026-11-02',
      },
    });
    s = apply(s, {
      type: 'saveInvestmentEntry',
      value: {
        id: 'sale',
        investmentId: 'btc',
        kind: 'withdrawal',
        quantity: 0.001,
        amountCents: 50000,
        date: '2026-11-03',
      },
    });
    expect(investmentValue(s, 'btc', today)).toMatchObject({
      units: 200000,
      cost: 26667,
      contributed: 40000,
      withdrawn: 50000,
      known: false,
    });
    s = apply(s, {
      type: 'saveQuote',
      value: {
        priceCents: 30000000,
        updatedAt: new Date('2026-11-13T10:00:00').getTime(),
        observedAt: new Date('2026-11-13T10:01:00').getTime(),
      },
    });
    expect(investmentValue(s, 'btc', today)).toMatchObject({
      current: 60000,
      gain: 33333,
      known: true,
    });
    expect(() =>
      apply(s, { type: 'deleteInvestmentEntry', id: 'buy' }),
    ).not.toThrow();
    expect(() =>
      apply(s, {
        type: 'saveInvestmentEntry',
        value: {
          id: 'tooMuch',
          investmentId: 'btc',
          kind: 'withdrawal',
          quantity: 0.003,
          amountCents: 100,
          date: today,
        },
      }),
    ).toThrow();
    const sale = {
      ...s.investmentEntries.find((item) => item.id === 'sale')!,
      quantity: 0.002,
    };
    s = apply(s, { type: 'saveInvestmentEntry', value: sale });
    expect(investmentValue(s, 'btc', today).units).toBe(100000);
    s = apply(s, { type: 'deleteInvestmentEntry', id: 'sale' });
    expect(investmentValue(s, 'btc', today).units).toBe(300000);
  });
  it('mantém precisão de um satoshi e rejeita quantidades abaixo da precisão suportada', () => {
    let s = btc();
    s = apply(s, {
      type: 'saveInvestmentEntry',
      value: {
        id: 'tiny',
        investmentId: 'btc',
        kind: 'withdrawal',
        quantity: 0.00000001,
        amountCents: 1,
        date: today,
      },
    });
    expect(position(s.investmentEntries, true).units).toBe(199999);
    expect(() =>
      apply(s, {
        type: 'saveInvestmentEntry',
        value: {
          id: 'invalid',
          investmentId: 'btc',
          kind: 'contribution',
          quantity: 0.000000001,
          amountCents: 1,
          date: today,
        },
      }),
    ).toThrow();
    expect(() =>
      apply(s, { type: 'deleteInvestmentEntry', id: 'buy' }),
    ).toThrow();
  });
  it('não inventa saldo inicial nem cotação anterior à observação e recalcula histórico', () => {
    let s = btc();
    // Sem registros, a carteira interna começa em zero, sem inventar saldo.
    expect(financialSummary(emptyRecords(), today)).toMatchObject({
      cash: 0,
      wealth: 0,
    });
    s = apply(s, {
      type: 'saveQuote',
      value: {
        priceCents: 20000000,
        updatedAt: new Date('2026-11-13T10:00:00').getTime(),
        observedAt: new Date('2026-11-13T10:01:00').getTime(),
      },
    });
    const history = financialHistory(s, today);
    expect(history.find((p) => p.date === '2026-11-01')).toMatchObject({
      investments: 20000,
      known: false,
      wealth: 100000,
    });
    expect(history.at(-1)).toMatchObject({
      investments: 40000,
      wealth: 120000,
      known: true,
    });
    s = apply(s, {
      type: 'saveInvestmentEntry',
      value: { ...s.investmentEntries[0]!, amountCents: 10000 },
    });
    expect(financialHistory(s, today).at(-1)?.wealth).toBe(130000);
    s = apply(s, { type: 'deleteInvestment', id: 'btc' });
    expect(financialSummary(s, today)).toMatchObject({
      investments: 0,
      wealth: 100000,
    });
  });
  it('preserva o histórico v2, migra v1 e persiste as extensões sem perder pilares', () => {
    const old = createDemoPlayerState();
    old.records.workouts = [{ date: today, trained: true }];
    expect(isPlayerState(old)).toBe(true);
    const storage = createLocalStateStorage(
      'finance-test',
      PLAYER_STORAGE_VERSION,
      isPlayerState,
      () => localStorage,
      migratePlayerState,
    );
    expect(storage.save(old)).toBe(true);
    expect(storage.load()).toEqual({
      status: 'loaded',
      data: old,
      raw: expect.any(String),
    });
    const s = btc();
    const beforeReward = recordReward(s, [], today);
    const radar = scorePeriod(projectEffortActivities([], [], s, today), 7);
    const updated = apply(s, {
      type: 'saveQuote',
      value: { priceCents: 20000000, updatedAt: 1000, observedAt: 1000 },
    });
    expect(recordReward(updated, [], today)).toBe(beforeReward);
    expect(
      scorePeriod(projectEffortActivities([], [], updated, today), 7),
    ).toEqual(radar);
    expect(
      storage.save({
        ...old,
        records: { ...updated, workouts: old.records.workouts },
      }),
    ).toBe(true);
    const loaded = storage.load();
    expect(loaded.status === 'loaded' && loaded.data.records.workouts).toEqual(
      old.records.workouts,
    );
    expect(loaded.status === 'loaded' && loaded.data.records.finance).toEqual(
      updated.finance,
    );
    expect(migratePlayerState(1, old)?.records).toEqual(emptyRecords());
    expect(
      isLifeRecords({
        ...updated,
        finance: { ...updated.finance, quotes: [{ priceCents: -1 }] },
      }),
    ).toBe(false);
  });
  it('mantém o patrimônio histórico ao abrir uma nova conta em data posterior', () => {
    const s = apply(base(), {
      type: 'saveAccount',
      value: {
        id: 'later',
        name: 'Nova conta',
        initialCents: 50000,
        date: today,
      },
    });
    expect(financialSummary(s, '2026-01-01').wealth).toBe(100000);
    expect(financialSummary(s, today).wealth).toBe(150000);
  });
  it('invalida avaliações após edições na mesma data e zera uma posição liquidada', () => {
    let s = apply(base(), {
      type: 'saveInvestment',
      value: { id: 'a', name: 'Ação', category: 'Ações' },
      initialEntry: {
        id: 'buy',
        investmentId: 'a',
        kind: 'contribution',
        amountCents: 10000,
        date: today,
      },
    });
    s = apply(s, {
      type: 'saveValuation',
      value: { id: 'v', investmentId: 'a', date: today, amountCents: 12000 },
    });
    expect(investmentValue(s, 'a', today)).toMatchObject({
      known: true,
      current: 12000,
    });
    s = apply(s, {
      type: 'saveInvestmentEntry',
      value: { ...s.investmentEntries[0]!, amountCents: 9000 },
    });
    expect(investmentValue(s, 'a', today)).toMatchObject({
      known: false,
      current: 9000,
    });
    s = apply(s, {
      type: 'saveInvestmentEntry',
      value: {
        id: 'sell',
        investmentId: 'a',
        kind: 'withdrawal',
        amountCents: 12000,
        costBasisCents: 9000,
        date: today,
      },
    });
    expect(investmentValue(s, 'a', today)).toMatchObject({
      current: 0,
      cost: 0,
    });
  });
  it('separa resgate com rendimento do custo de aquisição de ativos manuais', () => {
    let s = apply(base(), {
      type: 'saveInvestment',
      value: { id: 'bond', name: 'Título', category: 'Renda fixa' },
      initialEntry: {
        id: 'buy',
        investmentId: 'bond',
        kind: 'contribution',
        amountCents: 10000,
        date: '2026-11-01',
      },
    });
    s = apply(s, {
      type: 'saveInvestmentEntry',
      value: {
        id: 'redeem',
        investmentId: 'bond',
        kind: 'withdrawal',
        amountCents: 6000,
        costBasisCents: 5000,
        date: today,
      },
    });
    expect(financialSummary(s, today)).toMatchObject({
      cash: 96000,
      cost: 5000,
      investments: 5000,
    });
  });
});
