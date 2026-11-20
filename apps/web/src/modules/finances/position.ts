import { isInitialPosition } from './initialPosition';
import type { InvestmentCategory, InvestmentEntry } from './types';
export const satoshis = (quantity: number) =>
  Math.round(quantity * 100_000_000);

/**
 * Modo de cálculo da posição: BTC (satoshis), USD (centavos de dólar),
 * `shares` (ações e FIIs, quantidade em 1e-8 unidade) ou apenas custo.
 */
export type PositionMode = boolean | 'USD' | 'shares';
export function positionMode(category: InvestmentCategory): PositionMode {
  return category === 'Bitcoin'
    ? true
    : category === 'Dólar (USD)'
      ? 'USD'
      : category === 'Ações' || category === 'Fundos imobiliários'
        ? 'shares'
        : false;
}

const prorate = (cost: number, quantity: number, units: number) =>
  Number(
    (BigInt(cost) * BigInt(quantity) + BigInt(Math.floor(units / 2))) /
      BigInt(units),
  );

export function position(
  entries: readonly InvestmentEntry[],
  bitcoin: PositionMode = false,
) {
  let cost = 0;
  let units = 0;
  let contributed = 0;
  let initialCost = 0;
  let withdrawn = 0;
  let costKnown = true;
  // Ações/FIIs: a quantidade só é conhecida se todas as operações a informam.
  let unitsKnown = bitcoin !== false;
  const shares = bitcoin === 'shares';
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
      if (shares && entry.quantity === undefined) unitsKnown = false;
      units += quantity;
    } else {
      withdrawn += entry.amountCents;
      if (shares && entry.quantity === undefined) {
        // Regra anterior para vendas sem quantidade, preservada.
        cost -=
          entry.costBasisCents ??
          (costKnown ? entry.amountCents : Math.min(cost, entry.amountCents));
        unitsKnown = false;
      } else if (bitcoin) {
        if (shares && !unitsKnown)
          throw new Error(
            'Informe a quantidade de todas as compras anteriores antes de vender por quantidade.',
          );
        if (!quantity || quantity > units)
          throw new Error(
            bitcoin === 'USD'
              ? 'Venda excede a quantidade de USD disponível na data.'
              : shares
                ? 'Venda excede a quantidade de cotas ou ações disponível na data.'
                : 'Venda excede a quantidade de BTC disponível na data.',
          );
        cost -= shares
          ? (entry.costBasisCents ?? prorate(cost, quantity, units))
          : prorate(cost, quantity, units);
        units -= quantity;
        if (units === 0) costKnown = true;
      } else {
        cost -=
          entry.costBasisCents ??
          (costKnown ? entry.amountCents : Math.min(cost, entry.amountCents));
      }
    }
    if (cost < 0 || !Number.isSafeInteger(cost) || !Number.isSafeInteger(units))
      throw new Error(
        'Retirada excede o custo disponível. Se o resgate inclui rendimento, informe o custo de aquisição resgatado.',
      );
  }
  return {
    cost,
    units,
    contributed,
    withdrawn,
    costKnown,
    unitsKnown,
    initialCost,
  };
}
