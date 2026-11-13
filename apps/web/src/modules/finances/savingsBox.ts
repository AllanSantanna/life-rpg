import { isInitialPosition } from './initialPosition';
import type { InvestmentEntry, InvestmentValuation } from './types';
/** Saldo real + movimentos registrados, nunca juros presumidos ou uma estimativa CDI. */
export function projectBoxBalance(
  entries: readonly InvestmentEntry[],
  valuation: InvestmentValuation | undefined,
) {
  if (!valuation?.basis) return null;
  let basis: unknown;
  try {
    basis = JSON.parse(valuation.basis);
  } catch {
    return null;
  }
  if (!Array.isArray(basis)) return null;
  const snapshot = new Map<string, string>();
  for (const row of basis) {
    if (!Array.isArray(row) || typeof row[0] !== 'string') return null;
    snapshot.set(row[0], JSON.stringify(row));
  }
  const rowFor = (item: InvestmentEntry) =>
    JSON.stringify([
      item.id,
      item.kind,
      item.date,
      item.amountCents,
      item.quantity ?? null,
      item.costBasisCents ?? null,
    ]);
  if (
    [...snapshot].some(
      ([id, row]) =>
        !entries.some((item) => item.id === id && rowFor(item) === row),
    )
  )
    return null;
  const added = entries.filter((item) => !snapshot.has(item.id));
  if (
    added.some((item) => item.date < valuation.date || isInitialPosition(item))
  )
    return null;
  const amount =
    valuation.amountCents +
    added.reduce(
      (sum, item) =>
        sum +
        (item.kind === 'contribution' ? item.amountCents : -item.amountCents),
      0,
    );
  if (amount < 0 || !Number.isSafeInteger(amount)) return null;
  return { amount, estimated: added.length > 0 };
}
