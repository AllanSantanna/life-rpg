import { describe, expect, it } from 'vitest';
import { applyRecordCommand, isLifeRecords } from './commands';
import { emptyRecords, type RecordCommand, type LifeRecords } from './types';
import { monthlyBalance, investmentTotals } from '../finances/calculations';
import { workoutStats } from '../workouts/calculations';
import { sleepStats } from '../rest/calculations';
import { bookProgress, readingStats } from '../knowledge/calculations';
import {
  recordReward,
  projectEffortActivities,
  weeklyRecordXP,
} from './progression';
import { scorePeriod } from '../evolution/scoring';
import { legacyMissionCatalog } from '../missions/catalog';
const initialMissions = legacyMissionCatalog;
import { isDate, localDate, monthDates, daysBetween } from './dates';

const today = '2026-11-13';
const apply = (state: LifeRecords, command: RecordCommand) =>
  applyRecordCommand(state, command, today);
function financialState() {
  return apply(emptyRecords(), {
    type: 'saveMovement',
    value: {
      id: 'salary',
      kind: 'income',
      description: 'Salário',
      category: 'Trabalho',
      amountCents: 100050,
      date: today,
    },
  });
}
function bookState() {
  return apply(emptyRecords(), {
    type: 'saveBook',
    value: { id: 'book', title: 'Leitura', totalPages: 100 },
  });
}

describe('Registros reais e cálculos dos pilares', () => {
  it('cadastra, edita e exclui receitas/despesas em centavos, isolando os meses', () => {
    let state = financialState();
    state = apply(state, {
      type: 'saveMovement',
      value: {
        id: 'food',
        kind: 'expense',
        description: 'Mercado',
        category: 'Consumo',
        amountCents: 20025,
        date: today,
      },
    });
    state = apply(state, {
      type: 'saveMovement',
      value: {
        id: 'old',
        kind: 'expense',
        description: 'Anterior',
        category: 'Consumo',
        amountCents: 999,
        date: '2026-10-01',
      },
    });
    expect(monthlyBalance(state.movements, '2026-11')).toEqual({
      income: 100050,
      expense: 20025,
      balance: 80025,
    });
    expect(monthlyBalance(state.movements, '2026-10').expense).toBe(999);
    state = apply(state, {
      type: 'saveMovement',
      value: {
        id: 'food',
        kind: 'expense',
        description: 'Mercado corrigido',
        category: 'Consumo',
        amountCents: 10025,
        date: today,
      },
    });
    expect(state.movements).toHaveLength(3);
    expect(monthlyBalance(state.movements, '2026-11').balance).toBe(90025);
    state = apply(state, { type: 'deleteMovement', id: 'food' });
    expect(monthlyBalance(state.movements, '2026-11').expense).toBe(0);
  });
  it('calcula aportes e retiradas por categoria, sem afetar despesas ou receitas', () => {
    let state = financialState();
    state = apply(state, {
      type: 'saveInvestment',
      value: { id: 'asset', name: 'Ativo', category: 'Ações' },
      initialEntry: {
        id: 'initial',
        investmentId: 'asset',
        kind: 'contribution',
        amountCents: 30000,
        quantity: 3,
        purchasePriceCents: 10000,
        date: '2026-11-01',
      },
    });
    state = apply(state, {
      type: 'saveInvestmentEntry',
      value: {
        id: 'deposit',
        investmentId: 'asset',
        kind: 'contribution',
        amountCents: 10000,
        date: '2026-11-02',
      },
    });
    state = apply(state, {
      type: 'saveInvestmentEntry',
      value: {
        id: 'withdraw',
        investmentId: 'asset',
        kind: 'withdrawal',
        amountCents: 5000,
        date: today,
      },
    });
    expect(
      investmentTotals(state.investments, state.investmentEntries).total,
    ).toBe(35000);
    expect(
      investmentTotals(
        state.investments,
        state.investmentEntries,
      ).byCategory.find((item) => item.category === 'Ações')?.amountCents,
    ).toBe(35000);
    expect(monthlyBalance(state.movements, '2026-11')).toEqual({
      income: 100050,
      expense: 0,
      balance: 100050,
    });
    expect(() =>
      apply(state, {
        type: 'saveInvestmentEntry',
        value: {
          id: 'invalid',
          investmentId: 'asset',
          kind: 'withdrawal',
          amountCents: 35001,
          date: today,
        },
      }),
    ).toThrow();
    expect(() =>
      apply(state, {
        type: 'saveInvestmentEntry',
        value: {
          id: 'early',
          investmentId: 'asset',
          kind: 'withdrawal',
          amountCents: 1,
          date: '2026-10-01',
        },
      }),
    ).toThrow();
    state = apply(state, { type: 'deleteInvestmentEntry', id: 'withdraw' });
    expect(
      investmentTotals(state.investments, state.investmentEntries).total,
    ).toBe(40000);
    state = apply(state, { type: 'deleteInvestment', id: 'asset' });
    expect(state.investmentEntries).toEqual([]);
  });
  it('não publica mudanças que deixariam uma retirada descoberta ao editar ou excluir um aporte', () => {
    let state = apply(emptyRecords(), {
      type: 'saveInvestment',
      value: { id: 'a', name: 'Reserva', category: 'Renda fixa' },
      initialEntry: {
        id: 'in',
        investmentId: 'a',
        kind: 'contribution',
        amountCents: 10000,
        date: '2026-11-01',
      },
    });
    state = apply(state, {
      type: 'saveInvestmentEntry',
      value: {
        id: 'out',
        investmentId: 'a',
        kind: 'withdrawal',
        amountCents: 5000,
        date: today,
      },
    });
    const original = JSON.stringify(state);
    expect(() =>
      apply(state, { type: 'deleteInvestmentEntry', id: 'in' }),
    ).toThrow();
    expect(() =>
      apply(state, {
        type: 'saveInvestmentEntry',
        value: {
          id: 'in',
          investmentId: 'a',
          kind: 'contribution',
          amountCents: 1000,
          date: '2026-11-01',
        },
      }),
    ).toThrow();
    expect(JSON.stringify(state)).toBe(original);
  });
  it('mantém um treino por dia e permite Sim, Não e remoção', () => {
    let state = apply(emptyRecords(), {
      type: 'saveWorkout',
      value: { date: today, trained: true },
    });
    state = apply(state, {
      type: 'saveWorkout',
      value: { date: today, trained: true },
    });
    expect(state.workouts).toHaveLength(1);
    expect(workoutStats(state.workouts, today)).toEqual({
      weekly: 1,
      monthly: 1,
      total: 1,
      consistency: 8,
    });
    state = apply(state, {
      type: 'saveWorkout',
      value: { date: today, trained: false },
    });
    expect(workoutStats(state.workouts, today).total).toBe(0);
    state = apply(state, { type: 'deleteWorkout', date: today });
    expect(state.workouts).toEqual([]);
  });
  it('calcula médias de sono com decimais e consistência na meta pessoal', () => {
    let state = emptyRecords();
    for (const value of [
      { date: today, hours: 7.5 },
      { date: '2026-11-12', hours: 8.5 },
      { date: '2026-11-01', hours: 6 },
    ])
      state = apply(state, { type: 'saveSleep', value });
    const stats = sleepStats(state.sleep, today, 8);
    expect(stats.weeklyAverage).toBe(8);
    expect(stats.monthlyAverage).toBeCloseTo(22 / 3);
    expect(stats.consistency).toBe(8);
    state = apply(state, {
      type: 'saveSleep',
      value: { date: today, hours: 8.5 },
    });
    expect(state.sleep).toHaveLength(3);
    expect(sleepStats(state.sleep, today, 8).weeklyAverage).toBe(8.5);
    state = apply(state, { type: 'setSleepGoal', hours: 7 });
    expect(state.sleepGoalHours).toBe(7);
    state = apply(state, { type: 'deleteSleep', date: '2026-11-01' });
    expect(state.sleep).toHaveLength(2);
    expect(() =>
      apply(state, { type: 'saveSleep', value: { date: today, hours: 25 } }),
    ).toThrow();
  });
  it('atualiza leituras, bloqueia excesso e preserva a conclusão como histórico editável', () => {
    let state = apply(bookState(), {
      type: 'saveReading',
      value: { id: 'read', bookId: 'book', pages: 30, date: '2026-11-12' },
    });
    expect(bookProgress(state.books[0]!, state.readings)).toEqual({
      pages: 30,
      remaining: 70,
      percent: 30,
      completed: false,
    });
    expect(() =>
      apply(state, {
        type: 'saveReading',
        value: { id: 'overflow', bookId: 'book', pages: 71, date: today },
      }),
    ).toThrow('ultrapassa');
    expect(() =>
      apply(state, {
        type: 'saveBook',
        value: { id: 'book', title: 'Corrigido', totalPages: 20 },
      }),
    ).toThrow();
    state = apply(state, {
      type: 'finishBook',
      id: 'book',
      entryId: 'finish',
      date: today,
    });
    expect(bookProgress(state.books[0]!, state.readings).completed).toBe(true);
    expect(readingStats(state.books, state.readings, today)).toEqual({
      total: 100,
      weekly: 100,
      monthly: 100,
      completed: 1,
    });
    expect(
      apply(state, {
        type: 'finishBook',
        id: 'book',
        entryId: 'again',
        date: today,
      }),
    ).toBe(state);
    state = apply(state, {
      type: 'saveReading',
      value: { id: 'finish', bookId: 'book', pages: 60, date: today },
    });
    expect(bookProgress(state.books[0]!, state.readings).completed).toBe(false);
    state = apply(state, { type: 'deleteReading', id: 'finish' });
    expect(bookProgress(state.books[0]!, state.readings).pages).toBe(30);
  });
  it('valida datas, referências, duplicações e entradas numéricas', () => {
    expect(isDate('2026-02-30')).toBe(false);
    expect(monthDates('2024-02')).toHaveLength(29);
    expect(daysBetween('2026-11-13', '2026-11-12')).toBe(1);
    expect(localDate(new Date(2026, 10, 13, 0, 5))).toBe(today);
    expect(() =>
      apply(emptyRecords(), {
        type: 'saveWorkout',
        value: { date: '2026-11-14', trained: true },
      }),
    ).toThrow();
    expect(() =>
      apply(bookState(), {
        type: 'saveReading',
        value: { id: 'r', bookId: 'missing', pages: 1, date: today },
      }),
    ).toThrow();
    expect(() =>
      apply(financialState(), {
        type: 'saveMovement',
        value: {
          id: 'bad',
          kind: 'expense',
          description: 'Bad',
          category: 'Geral',
          amountCents: 1.5,
          date: today,
        },
      }),
    ).toThrow();
    expect(
      isLifeRecords({
        ...emptyRecords(),
        sleep: [{ date: today, hours: NaN }],
      }),
    ).toBe(false);
    expect(
      isLifeRecords({
        ...emptyRecords(),
        workouts: [
          { date: today, trained: true },
          { date: today, trained: false },
        ],
      }),
    ).toBe(false);
  });
});

describe('Recompensas e radar dos registros', () => {
  it('não favorece dinheiro ou atividades repetidas; edições e exclusões recalculam', () => {
    let state = financialState();
    expect(recordReward(state, initialMissions, today)).toBe(80);
    const before = scorePeriod(
      projectEffortActivities([], initialMissions, state, today),
      7,
    ).Finanças;
    state = apply(state, {
      type: 'saveMovement',
      value: {
        id: 'another',
        kind: 'income',
        description: 'Grande',
        category: 'Trabalho',
        amountCents: 100000000,
        date: today,
      },
    });
    expect(recordReward(state, initialMissions, today)).toBe(80);
    expect(
      scorePeriod(projectEffortActivities([], initialMissions, state, today), 7)
        .Finanças,
    ).toBe(before);
    state = apply(state, { type: 'deleteMovement', id: 'salary' });
    expect(recordReward(state, initialMissions, today)).toBe(80);
    state = apply(state, { type: 'deleteMovement', id: 'another' });
    expect(recordReward(state, initialMissions, today)).toBe(0);
    expect(
      scorePeriod(projectEffortActivities([], initialMissions, state, today), 7)
        .Finanças,
    ).toBe(0);
  });
  it('deduplica treino com sua missão e reverte Sim/Não sem acumular', () => {
    let state = apply(emptyRecords(), {
      type: 'saveWorkout',
      value: { date: today, trained: true },
    });
    expect(recordReward(state, initialMissions, today)).toBe(150);
    const completed = initialMissions.map((mission) =>
      mission.id === 'workout'
        ? {
            ...mission,
            completed: true,
            source: 'user' as const,
            completedOn: today,
          }
        : mission,
    );
    expect(recordReward(state, completed, today)).toBe(150);
    expect(
      scorePeriod(projectEffortActivities([], completed, state, today), 7)
        .Treinos,
    ).toBe(25);
    state = apply(state, {
      type: 'saveWorkout',
      value: { date: today, trained: false },
    });
    expect(recordReward(state, initialMissions, today)).toBe(0);
    expect(
      scorePeriod(projectEffortActivities([], initialMissions, state, today), 7)
        .Treinos,
    ).toBe(0);
  });
  it('recalcula sono e meta sem acumular XP por alterações e separa dedicação recente do XP histórico', () => {
    let state = apply(emptyRecords(), {
      type: 'saveSleep',
      value: { date: '2026-11-12', hours: 7.5 },
    });
    expect(recordReward(state, initialMissions, today)).toBe(0);
    state = apply(state, { type: 'setSleepGoal', hours: 7 });
    expect(recordReward(state, initialMissions, today)).toBe(120);
    state = apply(state, { type: 'setSleepGoal', hours: 8 });
    expect(recordReward(state, initialMissions, today)).toBe(0);
    state = apply(state, {
      type: 'saveSleep',
      value: { date: '2026-10-01', hours: 8 },
    });
    expect(recordReward(state, initialMissions, today)).toBe(120);
    expect(
      projectEffortActivities([], [], state, today).find(
        (item) => item.daysAgo === 43,
      )?.effort,
    ).toBe(1);
    expect(
      scorePeriod(projectEffortActivities([], [], state, today), 7).Descanso,
    ).toBe(14);
  });
  it('leituras e conclusão de vários livros no mesmo dia compartilham a recompensa', () => {
    let state = apply(bookState(), {
      type: 'finishBook',
      id: 'book',
      date: today,
      entryId: 'finish',
    });
    state = apply(state, {
      type: 'saveBook',
      value: { id: 'second', title: 'Outro', totalPages: 500 },
    });
    state = apply(state, {
      type: 'finishBook',
      id: 'second',
      date: today,
      entryId: 'finish2',
    });
    expect(recordReward(state, [], today)).toBe(100);
    expect(
      scorePeriod(projectEffortActivities([], [], state, today), 7)
        .Conhecimento,
    ).toBe(20);
    expect(recordReward(state, [], '2026-11-14')).toBe(100);
  });
});

describe('Tempo e gráficos de XP', () => {
  it('soma as missões e os registros uma vez no gráfico e deixa o saldo inicial fora', () => {
    const state = apply(emptyRecords(), {
      type: 'saveWorkout',
      value: { date: today, trained: true },
    });
    const weekly = weeklyRecordXP(state, initialMissions, today);
    expect(weekly).toHaveLength(7);
    expect(weekly.at(-1)?.xp).toBe(150);
    const completed = initialMissions.map((mission) =>
      mission.id === 'workout'
        ? {
            ...mission,
            completed: true,
            source: 'user' as const,
            completedOn: today,
          }
        : mission,
    );
    expect(weeklyRecordXP(state, completed, today).at(-1)?.xp).toBe(150);
    expect(weekly.slice(0, 6).every((day) => day.xp === 0)).toBe(true);
  });
  it('desloca apenas a dedicação recente ao passar dos dias, preservando o XP acumulado', () => {
    const state = apply(emptyRecords(), {
      type: 'saveWorkout',
      value: { date: today, trained: true },
    });
    expect(recordReward(state, [], '2026-12-01')).toBe(150);
    expect(
      scorePeriod(projectEffortActivities([], [], state, '2026-12-01'), 7)
        .Treinos,
    ).toBe(0);
    expect(
      scorePeriod(projectEffortActivities([], [], state, '2026-12-01'), 30)
        .Treinos,
    ).toBe(6);
  });
});
