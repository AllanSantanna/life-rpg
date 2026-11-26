import { describe, expect, it } from 'vitest';
import { applyRecordCommand, isLifeRecords } from '../records/commands';
import {
  emptyRecords,
  type LifeRecords,
  type RecordCommand,
} from '../records/types';
import { accountDeletionImpact } from './management';
import { financialHistory, financialSummary, accountBalance } from './ledger';
import { recordReward, projectEffortActivities } from '../records/progression';
import { scorePeriod } from '../evolution/scoring';
const today = '2026-11-13';
const apply = (state: LifeRecords, command: RecordCommand) =>
  applyRecordCommand(state, command, today);
function fixture(): LifeRecords {
  return {
    ...emptyRecords(),
    finance: {
      accounts: [
        {
          id: 'principal',
          name: 'Principal',
          date: '2026-01-01',
          initialCents: 100000,
        },
        { id: 'other', name: 'Outra', date: '2026-01-01', initialCents: 50000 },
        { id: 'empty', name: 'Vazia', date: '2026-01-01', initialCents: 0 },
      ],
      transfers: [
        {
          id: 't',
          fromId: 'principal',
          toId: 'other',
          date: today,
          amountCents: 10000,
        },
      ],
      valuations: [
        { id: 'v', investmentId: 'a', date: today, amountCents: 21000 },
      ],
      quotes: [{ priceCents: 20000000, observedAt: 1000, updatedAt: 1000 }],
    },
    movements: [
      {
        id: 'old',
        kind: 'income',
        description: 'Receita legada',
        category: 'Geral',
        date: today,
        amountCents: 10000,
      },
      {
        id: 'keep',
        accountId: 'other',
        kind: 'expense',
        description: 'Despesa',
        category: 'Geral',
        date: today,
        amountCents: 5000,
      },
    ],
    investments: [
      { id: 'b', name: 'BTC compartilhado', category: 'Bitcoin' },
      { id: 'a', name: 'Reserva', category: 'Renda fixa' },
    ],
    investmentEntries: [
      {
        id: 'buy',
        investmentId: 'b',
        kind: 'contribution',
        date: '2026-11-01',
        amountCents: 10000,
        quantity: 0.001,
      },
      {
        id: 'sell',
        investmentId: 'b',
        accountId: 'other',
        kind: 'withdrawal',
        date: '2026-11-02',
        amountCents: 5000,
        quantity: 0.0002,
      },
      {
        id: 'save',
        investmentId: 'a',
        accountId: 'other',
        kind: 'contribution',
        date: today,
        amountCents: 20000,
      },
    ],
    workouts: [{ date: today, trained: true }],
    sleep: [{ date: today, hours: 8 }],
    sleepGoalHours: 8,
    books: [{ id: 'book', title: 'Livro', totalPages: 100 }],
    readings: [{ id: 'reading', bookId: 'book', date: today, pages: 10 }],
  };
}
describe('Exclusão de contas e redefinição financeira', () => {
  it('exige confirmação e não modifica os dados ao rejeitar a operação', () => {
    const state = fixture();
    const before = structuredClone(state);
    expect(() =>
      apply(state, {
        type: 'deleteAccount',
        id: 'principal',
        confirmed: false,
      }),
    ).toThrow(/Confirme/);
    expect(() =>
      apply(state, { type: 'deleteAccount', id: 'missing', confirmed: true }),
    ).toThrow(/encontrada/);
    for (const confirmation of ['', 'zerar', 'ZERAR '])
      expect(() =>
        apply(state, { type: 'resetFinances', confirmation }),
      ).toThrow(/ZERAR/);
    expect(state).toEqual(before);
  });
  it('exclui conta sem vínculos preservando todos os registros', () => {
    const state = fixture();
    const next = apply(state, {
      type: 'deleteAccount',
      id: 'empty',
      confirmed: true,
    });
    expect(next.finance!.accounts).toHaveLength(2);
    expect(next.movements).toEqual(state.movements);
    expect(next.investmentEntries).toEqual(state.investmentEntries);
    expect(financialSummary(next, today)).toEqual(
      financialSummary(state, today),
    );
  });
  it('inclui vínculos legados, investimentos compartilhados e transferências sem deixar órfãos', () => {
    const state = fixture();
    expect(isLifeRecords(state)).toBe(true);
    const impact = accountDeletionImpact(state, 'principal');
    expect(impact.movements).toHaveLength(1);
    expect(impact.entries).toHaveLength(2);
    expect(impact.sharedEntries).toHaveLength(1);
    const next = apply(state, {
      type: 'deleteAccount',
      id: 'principal',
      confirmed: true,
    });
    expect(isLifeRecords(next)).toBe(true);
    expect(next.finance!.accounts.map((a) => a.id)).toEqual(['other', 'empty']);
    expect(next.finance!.transfers).toEqual([]);
    expect(next.finance!.quotes).toEqual([]);
    expect(next.investments.map((i) => i.id)).toEqual(['a']);
    expect(next.investmentEntries.map((i) => i.id)).toEqual(['save']);
    expect(next.movements.map((i) => i.id)).toEqual(['keep']);
    expect(next.finance!.valuations).toHaveLength(1);
    expect(accountBalance(next, 'other', today)).toBe(25000);
    expect(financialSummary(next, today).wealth).toBe(46000);
    expect(financialHistory(next, today).at(-1)?.wealth).toBe(46000);
    expect(state.finance!.transfers).toHaveLength(1);
    expect(recordReward(state, [], today) - recordReward(next, [], today)).toBe(
      160,
    );
    expect(next.workouts).toEqual(state.workouts);
  });
  it('remove avaliações vinculadas e preserva BTC independente da conta excluída', () => {
    const state = fixture();
    state.investmentEntries[1]!.accountId = 'principal';
    const next = apply(state, {
      type: 'deleteAccount',
      id: 'other',
      confirmed: true,
    });
    expect(next.finance!.valuations).toEqual([]);
    expect(next.investments.map((i) => i.id)).toEqual(['b']);
    expect(next.finance!.quotes).toEqual(state.finance!.quotes);
  });
  it('zera apenas Finanças, recalcula XP/Radar e impede cotação atrasada de repor o histórico', () => {
    const state = fixture();
    const next = apply(state, { type: 'resetFinances', confirmation: 'ZERAR' });
    expect(isLifeRecords(next)).toBe(true);
    expect(next.movements).toEqual([]);
    expect(next.investments).toEqual([]);
    expect(next.investmentEntries).toEqual([]);
    expect(next.finance).toEqual({
      accounts: [],
      transfers: [],
      valuations: [],
      quotes: [],
    });
    // A carteira interna volta a zero, sem abertura nem registros.
    expect(financialSummary(next, today)).toMatchObject({
      cash: 0,
      wealth: 0,
      investments: 0,
    });
    expect(financialHistory(next, today)).toEqual([]);
    for (const key of [
      'workouts',
      'sleep',
      'sleepGoalHours',
      'books',
      'readings',
    ] as const)
      expect(next[key]).toEqual(state[key]);
    expect(recordReward(state, [], today) - recordReward(next, [], today)).toBe(
      240,
    );
    const activities = projectEffortActivities([], [], next, today);
    expect(activities.some((item) => item.area === 'Finanças')).toBe(false);
    expect(scorePeriod(activities, 7)).toEqual(
      scorePeriod(
        projectEffortActivities(
          [],
          [],
          {
            ...emptyRecords(),
            workouts: state.workouts,
            sleep: state.sleep,
            books: state.books,
            readings: state.readings,
          },
          today,
        ),
        7,
      ),
    );
    expect(
      apply(next, { type: 'saveQuote', value: state.finance!.quotes[0]! }),
    ).toBe(next);
    expect(
      apply(next, { type: 'resetFinances', confirmation: 'ZERAR' }),
    ).toEqual(next);
  });
});
