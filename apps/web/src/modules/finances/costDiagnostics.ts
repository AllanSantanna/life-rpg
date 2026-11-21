import { position, positionMode } from './position';
import type { InvestmentCategory, InvestmentEntry } from './types';

/**
 * Vendas de ações e FIIs com quantidade devem baixar o custo pelo preço médio
 * (README de Finanças). Versões anteriores aceitavam um “custo de aquisição
 * resgatado” nessas vendas, o que pode deixar custo residual com quantidade
 * zero. Esses registros não são reinterpretados automaticamente: o diagnóstico
 * apenas compara o custo atual com o custo pelo preço médio, para revisão.
 */
export interface ShareCostIssue {
  entries: InvestmentEntry[];
  currentCost: number;
  averageCost: number;
  units: number;
}

export const isShareSaleWithCostBasis = (entry: InvestmentEntry) =>
  entry.kind === 'withdrawal' &&
  entry.quantity !== undefined &&
  entry.costBasisCents !== undefined;

export function withoutCostBasis(entry: InvestmentEntry): InvestmentEntry {
  const { costBasisCents: _ignored, ...rest } = entry;
  void _ignored;
  return rest;
}

export function shareCostIssue(
  category: InvestmentCategory,
  entries: readonly InvestmentEntry[],
): ShareCostIssue | null {
  if (positionMode(category) !== 'shares') return null;
  const flagged = entries.filter(isShareSaleWithCostBasis);
  if (!flagged.length) return null;
  try {
    const current = position(entries, 'shares');
    const average = position(
      entries.map((entry) =>
        flagged.includes(entry) ? withoutCostBasis(entry) : entry,
      ),
      'shares',
    );
    // Custo informado igual ao do preço médio não altera nada.
    if (current.cost === average.cost) return null;
    return {
      entries: flagged,
      currentCost: current.cost,
      averageCost: average.cost,
      units: current.units,
    };
  } catch {
    return null;
  }
}
