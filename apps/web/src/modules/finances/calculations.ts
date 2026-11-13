import type { Investment, InvestmentEntry, MoneyMovement } from './types';
import { investmentCategories } from './types';
export function monthlyBalance(
  movements: readonly MoneyMovement[],
  month: string,
) {
  const selected = movements.filter((item) =>
    item.date.startsWith(`${month}-`),
  );
  const income = selected
    .filter((item) => item.kind === 'income')
    .reduce((sum, item) => sum + item.amountCents, 0);
  const expense = selected
    .filter((item) => item.kind === 'expense')
    .reduce((sum, item) => sum + item.amountCents, 0);
  return { income, expense, balance: income - expense };
}
export function investedIn(entries: readonly InvestmentEntry[], id: string) {
  return entries
    .filter((item) => item.investmentId === id)
    .reduce(
      (sum, item) =>
        sum +
        (item.kind === 'contribution' ? item.amountCents : -item.amountCents),
      0,
    );
}
export function investmentTotals(
  investments: readonly Investment[],
  entries: readonly InvestmentEntry[],
) {
  const byCategory = investmentCategories.map((category) => ({
    category,
    amountCents: investments
      .filter((item) => item.category === category)
      .reduce((sum, item) => sum + investedIn(entries, item.id), 0),
  }));
  return {
    byCategory,
    total: byCategory.reduce((sum, item) => sum + item.amountCents, 0),
  };
}
export function money(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
