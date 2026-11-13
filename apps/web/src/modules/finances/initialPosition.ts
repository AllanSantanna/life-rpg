import type { InvestmentEntry } from './types';
/** Ausência do campo preserva a regra anterior; USD sem custo já era posição existente. */
export function isInitialPosition(
  entry: Pick<InvestmentEntry, 'positionInitial' | 'costUnknown'>,
) {
  return (
    entry.positionInitial === true ||
    (entry.positionInitial === undefined && entry.costUnknown === true)
  );
}
