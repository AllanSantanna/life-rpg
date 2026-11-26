import { describe, expect, it } from 'vitest';
import { applyRecordCommand } from '../records/commands';
import { recordReward } from '../records/progression';
import { emptyRecords, type LifeRecords } from '../records/types';
import { budgetFor, budgetLevel, budgetProgress } from './budget';
import { confirmationDraft, occurrenceMovementId } from './recurrence';
import type { MoneyMovement, RecurringRule } from './types';

/** Dados sintéticos; nenhuma informação pessoal real. */
const today = '2026-11-26';
type Command = Parameters<typeof applyRecordCommand>[1];
const apply = (records: LifeRecords, ...commands: Command[]) =>
  commands.reduce(
    (state, command) => applyRecordCommand(state, command, today),
    records,
  );
const expense = (
  id: string,
  category: string,
  amountCents: number,
  date = '2026-11-10',
): MoneyMovement => ({
  id,
  kind: 'expense',
  description: `Gasto ${id}`,
  amountCents,
  category,
  date,
});
const limit = (
  category: string,
  limitCents: number,
  month = '2026-11',
): Command => ({
  type: 'setBudget',
  id: `b-${category}-${month}`,
  category,
  limitCents,
  month,
});
const progressOf = (records: LifeRecords, month = '2026-11') =>
  budgetProgress(records.finance?.budgets ?? [], records.movements, month);

describe('orçamento mensal por categoria', () => {
  it('cria, edita e remove limites sem gerar XP', () => {
    let records = apply(emptyRecords(), limit('Alimentação', 60000));
    expect(records.finance!.budgets).toEqual([
      {
        id: 'b-Alimentação-2026-11',
        category: 'Alimentação',
        limitCents: 60000,
        from: '2026-11',
      },
    ]);
    expect(recordReward(records, [], today)).toBe(0);
    records = apply(records, limit('Alimentação', 65000));
    expect(records.finance!.budgets).toHaveLength(1);
    expect(records.finance!.budgets![0]!.limitCents).toBe(65000);
    records = apply(records, {
      type: 'removeBudget',
      category: 'Alimentação',
      month: '2026-11',
    });
    expect(records.finance!.budgets).toEqual([]);
  });

  it('calcula por categoria e por mês, somente com despesas reais', () => {
    const records = apply(
      emptyRecords(),
      limit('Alimentação', 60000),
      limit('Transporte', 25000),
      { type: 'saveMovement', value: expense('a1', 'Alimentação', 30000) },
      {
        type: 'saveMovement',
        value: expense('a2', 'Alimentação', 12000, '2026-11-20'),
      },
      {
        type: 'saveMovement',
        value: expense('a3', 'Alimentação', 50000, '2026-10-20'),
      },
      { type: 'saveMovement', value: expense('t1', 'Transporte', 5000) },
      {
        type: 'saveMovement',
        value: { ...expense('r1', 'Alimentação', 9000), kind: 'income' },
      },
    );
    expect(
      progressOf(records).map((item) => [
        item.budget.category,
        item.spentCents,
        item.remainingCents,
        item.percent,
        item.level,
      ]),
    ).toEqual([
      ['Alimentação', 42000, 18000, 70, 'normal'],
      ['Transporte', 5000, 20000, 20, 'normal'],
    ]);
  });

  it('aplica os níveis de 80% e 100% e mostra o excedente', () => {
    expect(budgetLevel(47999, 60000)).toBe('normal');
    expect(budgetLevel(48000, 60000)).toBe('attention');
    expect(budgetLevel(59999, 60000)).toBe('attention');
    expect(budgetLevel(60000, 60000)).toBe('exceeded');
    const records = apply(emptyRecords(), limit('Lazer', 20000), {
      type: 'saveMovement',
      value: expense('l1', 'Lazer', 26000),
    });
    const [item] = progressOf(records);
    expect(item).toMatchObject({
      spentCents: 26000,
      remainingCents: -6000,
      percent: 130,
      level: 'exceeded',
    });
  });

  it('atualiza o consumo ao editar ou excluir uma despesa, sem bloquear gastos', () => {
    let records = apply(emptyRecords(), limit('Lazer', 20000), {
      type: 'saveMovement',
      value: expense('l1', 'Lazer', 15000),
    });
    records = apply(records, {
      type: 'saveMovement',
      value: expense('l1', 'Lazer', 25000),
    });
    expect(progressOf(records)[0]!.spentCents).toBe(25000);
    records = apply(records, {
      type: 'saveMovement',
      value: expense('l1', 'Outra categoria', 25000),
    });
    expect(progressOf(records)[0]!.spentCents).toBe(0);
    records = apply(records, { type: 'deleteMovement', id: 'l1' });
    expect(progressOf(records)[0]!.spentCents).toBe(0);
  });

  it('considera recorrências somente depois de confirmadas', () => {
    const rule: RecurringRule = {
      id: 'r-academia',
      kind: 'expense',
      description: 'Academia',
      amountCents: 9000,
      category: 'Saúde',
      frequency: 'monthly',
      startDate: '2026-11-10',
      status: 'active',
    };
    let records = apply(emptyRecords(), limit('Saúde', 10000), {
      type: 'saveRecurrence',
      rule,
    });
    expect(progressOf(records)[0]!.spentCents).toBe(0);
    records = apply(records, {
      type: 'confirmRecurrence',
      value: {
        ...confirmationDraft(rule, '2026-11-10', today),
        id: occurrenceMovementId(rule.id, '2026-11-10'),
      },
    });
    expect(progressOf(records)[0]).toMatchObject({
      spentCents: 9000,
      level: 'attention',
    });
  });

  it('não conta aportes vinculados à Carteira como consumo', () => {
    const records = apply(
      emptyRecords(),
      limit('Investimentos', 10000),
      {
        type: 'saveMovement',
        value: { ...expense('s1', 'Salário', 100000), kind: 'income' },
      },
      {
        type: 'saveInvestment',
        value: { id: 'cx', name: 'Reserva', category: 'Caixinhas bancárias' },
        initialEntry: {
          id: 'e1',
          investmentId: 'cx',
          kind: 'contribution',
          amountCents: 20000,
          date: '2026-11-15',
          positionInitial: false,
          walletLinked: true,
        },
      },
    );
    expect(progressOf(records)[0]!.spentCents).toBe(0);
  });

  it('preserva categorias personalizadas pelo texto exato gravado', () => {
    const records = apply(
      emptyRecords(),
      limit('Pet: ração & vet', 30000),
      { type: 'saveMovement', value: expense('p1', 'Pet: ração & vet', 12000) },
      { type: 'saveMovement', value: expense('p2', 'pet: ração & vet', 99999) },
    );
    expect(progressOf(records)[0]).toMatchObject({
      budget: { category: 'Pet: ração & vet' },
      spentCents: 12000,
    });
  });

  it('altera o limite para meses futuros sem reescrever meses anteriores', () => {
    let records = apply(emptyRecords(), limit('Alimentação', 60000, '2026-11'));
    records = applyRecordCommand(
      records,
      limit('Alimentação', 70000, '2027-01'),
      '2027-01-05',
    );
    const budgets = records.finance!.budgets!;
    expect(budgetFor(budgets, 'Alimentação', '2026-11')!.limitCents).toBe(
      60000,
    );
    expect(budgetFor(budgets, 'Alimentação', '2026-12')!.limitCents).toBe(
      60000,
    );
    expect(budgetFor(budgets, 'Alimentação', '2027-01')!.limitCents).toBe(
      70000,
    );
    expect(budgetFor(budgets, 'Alimentação', '2030-06')!.limitCents).toBe(
      70000,
    );
    expect(budgets).toEqual([
      expect.objectContaining({
        from: '2026-11',
        to: '2026-12',
        limitCents: 60000,
      }),
      expect.objectContaining({ from: '2027-01', limitCents: 70000 }),
    ]);
    // Remover a partir de março mantém novembro a fevereiro intactos.
    records = applyRecordCommand(
      records,
      { type: 'removeBudget', category: 'Alimentação', month: '2027-03' },
      '2027-03-01',
    );
    const after = records.finance!.budgets!;
    expect(budgetFor(after, 'Alimentação', '2026-11')!.limitCents).toBe(60000);
    expect(budgetFor(after, 'Alimentação', '2027-02')!.limitCents).toBe(70000);
    expect(budgetFor(after, 'Alimentação', '2027-03')).toBeUndefined();
  });

  it('recusa limites inválidos ou versões sobrepostas importadas', () => {
    expect(() => apply(emptyRecords(), limit('Lazer', 0))).toThrow();
    expect(() =>
      apply(emptyRecords(), limit('Lazer', 100, '2026-13')),
    ).toThrow();
    const records = apply(emptyRecords(), limit('Lazer', 100));
    const overlapping = {
      ...records,
      finance: {
        ...records.finance!,
        budgets: [
          ...records.finance!.budgets!,
          { id: 'outro', category: 'Lazer', limitCents: 200, from: '2027-01' },
        ],
      },
    };
    expect(() =>
      applyRecordCommand(
        overlapping,
        { type: 'setSleepGoal', hours: 8 },
        today,
      ),
    ).toThrow();
  });
});
