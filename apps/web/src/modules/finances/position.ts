import { isInitialPosition } from './initialPosition';
import type { InvestmentEntry } from './types';
export const satoshis = (quantity: number) =>
  Math.round(quantity * 100_000_000);
export function position(
  entries: readonly InvestmentEntry[],
  bitcoin: boolean | 'USD' = false,
) {
  let cost = 0;
  let units = 0;
  let contributed = 0;
  let initialCost = 0;
  let withdrawn = 0;
  let costKnown = true;
  for (const entry of [...entries].sort((a, b) =>
    a.date.localeCompare(b.date),
  )) {
    const quantity =
      bitcoin === 'USD'
        ? Math.round((entry.quantity ?? 0) * 100)
        : bitcoin
          ? satoshis(entry.quantity ?? 0)
          : 0;
    if (entry.kind === 'contribution') {
      if (entry.costUnknown) costKnown = false;
      cost += entry.amountCents;
      if (isInitialPosition(entry)) initialCost += entry.amountCents;
      else contributed += entry.amountCents;
      units += quantity;
    } else {
      withdrawn += entry.amountCents;
      if (bitcoin) {
        if (!quantity || quantity > units)
          throw new Error(
            bitcoin === 'USD'
              ? 'Venda excede a quantidade de USD disponível na data.'
              : 'Venda excede a quantidade de BTC disponível na data.',
          );
        cost -= Number(
          (BigInt(cost) * BigInt(quantity) + BigInt(Math.floor(units / 2))) /
            BigInt(units),
        );
        units -= quantity;
        if (units === 0) costKnown = true;
      } else {
        cost -=
          entry.costBasisCents ??
          (costKnown ? entry.amountCents : Math.min(cost, entry.amountCents));
      }
    }
    if (cost < 0 || !Number.isSafeInteger(cost) || !Number.isSafeInteger(units))
      throw new Error('Retirada excede o custo disponível.');
  }
  return { cost, units, contributed, withdrawn, costKnown, initialCost };
}
