import type { CategoryBudget, MoneyMovement } from './types';

/**
 * Orçamento mensal por categoria de despesa. O limite é recorrente: vale do
 * mês `from` em diante até `to` (inclusive) ou até a próxima versão. Alterar ou
 * remover a partir de um mês cria/encerra versões, preservando os meses
 * anteriores. Somente despesas reais (`MoneyMovement` do tipo despesa) entram
 * no consumo, pela data da movimentação; receitas, recorrências não
 * confirmadas e operações de investimento ficam fora. A categoria é comparada
 * pelo texto exato gravado no registro (o identificador real da categoria).
 */
export const BUDGET_ATTENTION_PERCENT = 80;

export function isMonth(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value) &&
    Number(value.slice(0, 4)) >= 1
  );
}
export function shiftMonth(month: string, offset: number) {
  const [year, value] = month.split('-').map(Number) as [number, number];
  const index = year * 12 + (value - 1) + offset;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

const covers = (budget: CategoryBudget, month: string) =>
  budget.from <= month && (budget.to === undefined || month <= budget.to);

/** Versão do limite vigente para a categoria no mês. */
export function budgetFor(
  budgets: readonly CategoryBudget[],
  category: string,
  month: string,
) {
  return budgets.find(
    (item) => item.category === category && covers(item, month),
  );
}

/**
 * Define o limite da categoria a partir de `month`. A versão anterior é
 * encerrada no mês anterior; uma versão iniciada no mesmo mês é substituída.
 * Versões futuras já planejadas continuam valendo a partir de seus meses.
 */
export function setBudget(
  budgets: readonly CategoryBudget[],
  value: { id: string; category: string; limitCents: number; month: string },
): CategoryBudget[] {
  const { id, category, limitCents, month } = value;
  const current = budgetFor(budgets, category, month);
  const nextStart = budgets
    .filter((item) => item.category === category && item.from > month)
    .map((item) => item.from)
    .sort()[0];
  const to = current ? current.to : nextStart && shiftMonth(nextStart, -1);
  const rest = budgets.flatMap((item) => {
    if (item !== current) return [item];
    if (item.from === month) return [];
    return [{ ...item, to: shiftMonth(month, -1) }];
  });
  return [
    ...rest,
    {
      id: current?.from === month ? current.id : id,
      category,
      limitCents,
      from: month,
      ...(to ? { to } : {}),
    },
  ];
}

/** Remove o limite da categoria a partir de `month` (meses anteriores ficam). */
export function removeBudget(
  budgets: readonly CategoryBudget[],
  category: string,
  month: string,
): CategoryBudget[] {
  return budgets.flatMap((item) => {
    if (item.category !== category) return [item];
    if (item.from >= month) return [];
    if (covers(item, month)) return [{ ...item, to: shiftMonth(month, -1) }];
    return [item];
  });
}

export type BudgetLevel = 'normal' | 'attention' | 'exceeded';
export function budgetLevel(spentCents: number, limitCents: number) {
  if (spentCents >= limitCents) return 'exceeded';
  // Comparação inteira: 80% de atenção sem arredondamento de ponto flutuante.
  return spentCents * 100 >= limitCents * BUDGET_ATTENTION_PERCENT
    ? 'attention'
    : 'normal';
}

export interface BudgetProgress {
  budget: CategoryBudget;
  spentCents: number;
  remainingCents: number;
  percent: number;
  level: BudgetLevel;
}

/** Consumo do mês por categoria com limite vigente, em ordem alfabética. */
export function budgetProgress(
  budgets: readonly CategoryBudget[],
  movements: readonly MoneyMovement[],
  month: string,
): BudgetProgress[] {
  const spent = new Map<string, number>();
  for (const item of movements)
    if (item.kind === 'expense' && item.date.startsWith(`${month}-`))
      spent.set(
        item.category,
        (spent.get(item.category) ?? 0) + item.amountCents,
      );
  return budgets
    .filter((item) => covers(item, month))
    .sort((a, b) => a.category.localeCompare(b.category, 'pt-BR'))
    .map((budget) => {
      const spentCents = spent.get(budget.category) ?? 0;
      return {
        budget,
        spentCents,
        remainingCents: budget.limitCents - spentCents,
        percent: Math.floor((spentCents * 100) / budget.limitCents),
        level: budgetLevel(spentCents, budget.limitCents),
      };
    });
}
