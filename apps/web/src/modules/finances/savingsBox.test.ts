import { describe, it, expect } from 'vitest';
import {
  emptyRecords,
  type LifeRecords,
  type RecordCommand,
} from '../records/types';
import { applyRecordCommand, isLifeRecords } from '../records/commands';
import { financialSummary, financialHistory, investmentValue } from './ledger';
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
function box(initial = true) {
  return apply(
    {
      ...emptyRecords(),
      finance: {
        accounts: [
          {
            id: 'principal',
            name: 'Banco',
            initialCents: 200000,
            date: '2026-01-01',
          },
        ],
        transfers: [],
        valuations: [],
        quotes: [],
      },
    },
    {
      type: 'saveInvestment',
      value: {
        id: 'box',
        name: 'Reserva',
        category: 'Caixinhas bancárias',
        institution: 'Itaú',
        cdiPercentBasisPoints: 10000,
      },
      initialEntry: {
        id: 'first',
        investmentId: 'box',
        amountCents: 100000,
        kind: 'contribution',
        date: '2026-11-01',
        positionInitial: initial,
      },
      initialValuation: {
        id: 'v',
        investmentId: 'box',
        amountCents: 100800,
        date: '2026-11-02',
        movementsComplete: true,
      },
    },
  );
}
describe('Caixinhas e avaliação manual', () => {
  it('cadastra posição preexistente com saldo/rendimento sem débito e sem XP', () => {
    const s = box();
    expect(isLifeRecords(s)).toBe(true);
    expect(investmentValue(s, 'box', today)).toMatchObject({
      cost: 100000,
      current: 100800,
      gain: 800,
      boxBalanceValid: true,
    });
    expect(financialSummary(s, today)).toMatchObject({
      cash: 200000,
      investments: 100800,
      wealth: 300800,
    });
    expect(s.movements).toEqual([]);
    expect(recordReward(s, [], today)).toBe(0);
  });
  it('debita um novo aporte e ajusta saldo/custo depois da avaliação sem inventar juros', () => {
    let s = box(false);
    expect(financialSummary(s, today).cash).toBe(100000);
    s = apply(s, {
      type: 'saveInvestmentEntry',
      value: {
        id: 'new',
        investmentId: 'box',
        kind: 'contribution',
        amountCents: 50000,
        date: '2026-11-03',
      },
    });
    expect(investmentValue(s, 'box', today)).toMatchObject({
      cost: 150000,
      current: 150800,
      gain: 800,
      balanceEstimated: true,
    });
    s = apply(s, {
      type: 'saveInvestmentEntry',
      value: {
        id: 'out',
        investmentId: 'box',
        kind: 'withdrawal',
        amountCents: 30000,
        date: '2026-11-04',
      },
    });
    expect(investmentValue(s, 'box', today)).toMatchObject({
      cost: 120000,
      current: 120800,
      gain: 800,
      contributed: 150000,
      withdrawn: 30000,
    });
    expect(financialSummary(s, today)).toMatchObject({
      cash: 80000,
      wealth: 200800,
    });
    expect(s.movements).toEqual([]);
  });
  it('mantém rendimento remanescente mesmo após resgatar todo o principal', () => {
    const s = apply(box(), {
      type: 'saveInvestmentEntry',
      value: {
        id: 'redeem',
        investmentId: 'box',
        kind: 'withdrawal',
        date: today,
        amountCents: 100000,
      },
    });
    expect(investmentValue(s, 'box', today)).toMatchObject({
      current: 800,
      cost: 0,
      gain: 800,
      boxBalanceValid: true,
    });
  });
  it('atualiza patrimônio/gráficos mantendo conta, receitas, despesas e XP/Radar', () => {
    const before = box(false);
    const after = apply(before, {
      type: 'saveValuation',
      value: {
        id: 'v2',
        investmentId: 'box',
        date: today,
        amountCents: 101500,
        movementsComplete: true,
      },
    });
    expect(investmentValue(after, 'box', today)).toMatchObject({
      cost: 100000,
      current: 101500,
      gain: 1500,
    });
    expect(financialSummary(after, today).cash).toBe(
      financialSummary(before, today).cash,
    );
    expect(financialHistory(after, today).at(-1)?.wealth).toBe(201500);
    expect(wealthChartModel(after, today, 30, 'cash').currentValue).toBe(
      100000,
    );
    expect(recordReward(after, [], today)).toBe(
      recordReward(before, [], today),
    );
    expect(projectEffortActivities([], [], after, today)).toEqual(
      projectEffortActivities([], [], before, today),
    );
    expect(after.investmentEntries).toEqual(before.investmentEntries);
    expect(after.movements).toEqual([]);
    const zero = apply(after, {
      type: 'saveValuation',
      value: { id: 'v2', investmentId: 'box', date: today, amountCents: 0 },
    });
    expect(investmentValue(zero, 'box', today)).toMatchObject({
      current: 0,
      gain: -100000,
    });
  });
  it('suporta múltiplas caixinhas sem misturar bancos ou saldos', () => {
    let s = box();
    s = apply(s, {
      type: 'saveInvestment',
      value: {
        id: 'b2',
        name: 'Viagem',
        category: 'Caixinhas bancárias',
        institution: 'Nubank',
        cdiPercentBasisPoints: 11050,
      },
      initialEntry: {
        id: 'p2',
        investmentId: 'b2',
        kind: 'contribution',
        positionInitial: true,
        date: today,
        amountCents: 50000,
      },
      initialValuation: {
        id: 'v2',
        investmentId: 'b2',
        amountCents: 50500,
        date: today,
      },
    });
    expect(s.investments).toHaveLength(2);
    expect(financialSummary(s, today)).toMatchObject({
      cash: 200000,
      investments: 151300,
    });
    expect(investmentValue(s, 'box', today).current).toBe(100800);
    expect(investmentValue(s, 'b2', today).current).toBe(50500);
  });
  it('invalida avaliação em edições retroativas e preserva/edita/exclui histórico', () => {
    let s = box();
    s = apply(s, {
      type: 'saveInvestmentEntry',
      value: { ...s.investmentEntries[0]!, amountCents: 90000 },
    });
    expect(investmentValue(s, 'box', today)).toMatchObject({
      boxBalanceValid: false,
      current: 90000,
      known: false,
    });
    expect(s.finance!.valuations).toHaveLength(1);
    s = apply(s, {
      type: 'saveValuation',
      value: { ...s.finance!.valuations[0]!, amountCents: 90800 },
    });
    expect(investmentValue(s, 'box', today)).toMatchObject({
      boxBalanceValid: true,
      gain: 800,
    });
    s = apply(s, { type: 'deleteValuation', id: 'v' });
    expect(investmentValue(s, 'box', today).current).toBe(90000);
    s = apply(s, { type: 'deleteInvestment', id: 'box' });
    expect(s.finance!.valuations).toEqual([]);
    expect(s.investmentEntries).toEqual([]);
  });
  it('ajusta movimentos novos na mesma data e rejeita saldos anteriores à aplicação atomicamente', () => {
    let s = box();
    s = apply(s, {
      type: 'saveInvestmentEntry',
      value: {
        id: 'same',
        investmentId: 'box',
        date: '2026-11-02',
        kind: 'contribution',
        amountCents: 10000,
      },
    });
    expect(investmentValue(s, 'box', today)).toMatchObject({
      current: 110800,
      cost: 110000,
      gain: 800,
      balanceEstimated: true,
    });
    const original = structuredClone(s);
    expect(() =>
      apply(s, {
        type: 'saveValuation',
        value: {
          id: 'invalid',
          investmentId: 'box',
          date: '2025-01-01',
          amountCents: 100,
        },
      }),
    ).toThrow();
    expect(() =>
      apply(s, {
        type: 'saveInvestment',
        value: { id: 'bad', name: 'Inválida', category: 'Caixinhas bancárias' },
        initialEntry: {
          id: 'e',
          investmentId: 'bad',
          kind: 'contribution',
          date: today,
          amountCents: 100,
        },
        initialValuation: {
          id: 'vbad',
          investmentId: 'bad',
          amountCents: 101,
          date: '2026-01-01',
        },
      }),
    ).toThrow();
    expect(s).toEqual(original);
  });
  it('persiste metadados e saldos em v2, aceita caixinhas antigas e preserva outros pilares', () => {
    const state = createDemoPlayerState();
    state.records = box();
    state.records.workouts = [{ date: today, trained: true }];
    const storage = createLocalStateStorage(
      'box-test',
      PLAYER_STORAGE_VERSION,
      isPlayerState,
      () => localStorage,
      migratePlayerState,
    );
    expect(storage.save(state)).toBe(true);
    expect(storage.load()).toEqual({
      status: 'loaded',
      data: state,
      raw: expect.any(String),
    });
    const legacy = structuredClone(state);
    delete legacy.records.investments[0]!.institution;
    delete legacy.records.investments[0]!.cdiPercentBasisPoints;
    delete legacy.records.finance!.valuations[0]!.movementsComplete;
    expect(isPlayerState(legacy)).toBe(true);
    expect(migratePlayerState(1, legacy)?.records).toEqual(emptyRecords());
    expect(() =>
      apply(state.records, {
        type: 'saveInvestment',
        value: { ...state.records.investments[0]!, cdiPercentBasisPoints: -1 },
      }),
    ).toThrow();
    expect(state.records.workouts).toEqual([{ date: today, trained: true }]);
  });
});
